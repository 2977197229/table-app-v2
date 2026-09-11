let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET
    })
  });
  const data = await res.json();
  if (!data.tenant_access_token) throw new Error('获取token失败');
  cachedToken = data.tenant_access_token;
  tokenExpiry = Date.now() + (data.expire - 300) * 1000;
  return cachedToken;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const fileKey = req.query.file_key;
    if (!fileKey) return res.status(400).json({ error: '缺少file_key参数' });
    const accessToken = await getAccessToken();
    const downloadRes = await fetch('https://open.feishu.cn/open-apis/drive/v1/files/' + fileKey + '/download', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    if (!downloadRes.ok) throw new Error('下载失败: ' + downloadRes.status);
    const contentType = downloadRes.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = downloadRes.headers.get('content-disposition') || '';
    res.setHeader('Content-Type', contentType);
    if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
    const buffer = Buffer.from(await downloadRes.arrayBuffer());
    res.status(200).send(buffer);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: err.message });
  }
};
