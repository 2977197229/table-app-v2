let cachedToken = null;
let tokenExpiry = 0;
let cachedFolderToken = null;

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
  if (!data.tenant_access_token) throw new Error('获取飞书token失败: ' + JSON.stringify(data));
  cachedToken = data.tenant_access_token;
  tokenExpiry = Date.now() + (data.expire - 300) * 1000;
  return cachedToken;
}

async function getOrCreateFolder(accessToken) {
  if (cachedFolderToken) return cachedFolderToken;
  const rootRes = await fetch('https://open.feishu.cn/open-apis/drive/explorer/v2/root_folder/meta', {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  const rootData = await rootRes.json();
  const rootToken = rootData.data?.token;
  if (!rootToken) throw new Error('获取根目录失败');
  const listRes = await fetch('https://open.feishu.cn/open-apis/drive/v1/files?folder_token=' + rootToken + '&page_size=200', {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  const listData = await listRes.json();
  const files = listData.data?.files || [];
  const existing = files.find(f => f.name === '项目文件存储' && f.type === 'folder');
  if (existing) {
    cachedFolderToken = existing.token;
    return cachedFolderToken;
  }
  const createRes = await fetch('https://open.feishu.cn/open-apis/drive/v1/files/create_folder', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '项目文件存储', folder_token: rootToken })
  });
  const createData = await createRes.json();
  if (createData.code === 0 && createData.data?.token) {
    cachedFolderToken = createData.data.token;
    return cachedFolderToken;
  }
  cachedFolderToken = rootToken;
  return cachedFolderToken;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { fileName, fileSize, fileType, fileData } = req.body;
    if (!fileName || !fileData) return res.status(400).json({ error: '缺少文件名或文件数据' });
    const accessToken = await getAccessToken();
    const folderToken = await getOrCreateFolder(accessToken);
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const buffer = Buffer.from(base64Data, 'base64');
    const formData = new FormData();
    formData.append('file_name', fileName);
    formData.append('parent_type', 'explorer');
    formData.append('parent_node', folderToken);
    formData.append('size', String(buffer.length));
    formData.append('file', new Blob([buffer]), fileName);
    const uploadRes = await fetch('https://open.feishu.cn/open-apis/drive/v1/files/upload_all', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + accessToken },
      body: formData
    });
    const uploadData = await uploadRes.json();
    if (uploadData.code !== 0) throw new Error(uploadData.msg || '上传失败');
    const fileKey = uploadData.data?.file_token;
    res.status(200).json({
      fileKey: fileKey,
      url: '/api/download?file_key=' + fileKey,
      name: fileName,
      size: fileSize
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
};
