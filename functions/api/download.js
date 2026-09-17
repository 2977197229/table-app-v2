let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken(env) {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: env.FEISHU_APP_ID,
      app_secret: env.FEISHU_APP_SECRET
    })
  });
  const data = await res.json();
  if (!data.tenant_access_token) throw new Error('获取token失败');
  cachedToken = data.tenant_access_token;
  tokenExpiry = Date.now() + (data.expire - 300) * 1000;
  return cachedToken;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  try {
    const url = new URL(request.url);
    const fileKey = url.searchParams.get('file_key');
    if (!fileKey) return new Response(JSON.stringify({ error: '缺少file_key参数' }), { status: 400, headers: corsHeaders });
    const accessToken = await getAccessToken(env);
    const downloadRes = await fetch('https://open.feishu.cn/open-apis/drive/v1/files/' + fileKey + '/download', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    if (!downloadRes.ok) throw new Error('下载失败: ' + downloadRes.status);
    const contentType = downloadRes.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = downloadRes.headers.get('content-disposition') || '';
    const arrayBuffer = await downloadRes.arrayBuffer();
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': contentType
    };
    if (contentDisposition) responseHeaders['Content-Disposition'] = contentDisposition;
    return new Response(arrayBuffer, { status: 200, headers: responseHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
