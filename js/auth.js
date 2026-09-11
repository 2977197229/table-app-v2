// ===== Authentication =====
function setLoginError(message = '') {
  if (!els.loginError) return;
  els.loginError.textContent = message;
  els.loginError.style.display = message ? 'block' : 'none';
  // 有错误时显示重试按钮
  if (els.btnFeishuRetry) {
    els.btnFeishuRetry.style.display = message ? 'block' : 'none';
  }
}

function showLogin() {
  document.querySelectorAll('.app-shell').forEach(el => {
    el.hidden = true;
  });
  if (els.loginScreen) els.loginScreen.hidden = false;
}

function showApp() {
  if (els.loginScreen) els.loginScreen.hidden = true;
  document.querySelectorAll('.app-shell').forEach(el => {
    el.hidden = false;
  });
  if (els.currentUser) {
    const name = currentUser?.name || '';
    els.currentUser.textContent = name ? `${name}` : '';
  }
}

function getAuthHeaders(extraHeaders = {}) {
  return {
    ...extraHeaders,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
  };
}

async function apiFetch(url, options = {}) {
  const headers = getAuthHeaders(options.headers || {});
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    authToken = '';
    showLogin();
    throw new Error('登录已过期，请重新登录');
  }
  return res;
}

async function parseApiJson(res, fallbackMessage = '接口返回异常') {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('未连接到后端服务，请用 npm start 启动项目');
  }
  try {
    return await res.json();
  } catch (err) {
    throw new Error(fallbackMessage);
  }
}

async function checkSession() {
  if (!authToken) return false;
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const userJson = localStorage.getItem('table-app-current-user');
      if (userJson) currentUser = JSON.parse(userJson);
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

function setFeishuStatus(text) {
  if (els.feishuStatusText) els.feishuStatusText.textContent = text;
  // 失败时隐藏加载动画
  const statusDiv = document.getElementById('feishu-login-status');
  if (statusDiv && (text.includes('失败') || text.includes('错误'))) {
    const spinner = statusDiv.querySelector('.feishu-spinner');
    if (spinner) spinner.style.display = 'none';
  }
}

// 飞书应用配置（部署时替换为你的企业自建应用 App ID）
const FEISHU_APP_ID = window.FEISHU_CONFIG?.appId || '';

// 用授权码直接在前端获取用户信息（纯前端模式，不需要后端）
async function exchangeCodeForToken(code) {
  setFeishuStatus('正在登录...');
  // 纯前端模式：用授权码作为本地token，用户信息从JS-SDK获取
  authToken = 'local_' + code;
  currentUser = { name: '飞书用户', user_id: code };
  localStorage.setItem(AUTH_STORAGE_KEY, authToken);
  localStorage.setItem('table-app-current-user', JSON.stringify(currentUser));
  // 清除 URL 中的 code 参数
  if (window.location.search.includes('code=')) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  showApp();
  await startAppOnce();
}

// 飞书免登录：支持飞书客户端内 + 外部浏览器两种场景
async function feishuLogin(isRetry = false) {
  setLoginError('');
  try {
    // 1. 先检查是否已有有效会话（纯前端：检查localStorage）
    if (await checkSession()) {
      showApp();
      await startAppOnce();
      return;
    }

    // 2. 检查 URL 中是否有飞书回调的授权码（外部浏览器 OAuth 跳转回来）
    const urlParams = new URLSearchParams(window.location.search);
    const callbackCode = urlParams.get('code');
    if (callbackCode && !isRetry) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setFeishuStatus('正在验证授权...');
      try {
        await exchangeCodeForToken(callbackCode);
        return;
      } catch (err) {
        console.error('URL code 换取失败:', err.message);
        setLoginError('授权验证失败：' + err.message + '。请点击下方按钮重试。');
        setFeishuStatus('授权失败');
        return;
      }
    }

    // 3. 判断是否在飞书客户端内（未配置appId时直接走本地模式）
    const inFeishu = FEISHU_APP_ID && ((typeof window.h5sdk !== 'undefined') || (typeof window.tt !== 'undefined'));

    if (inFeishu) {
      // 飞书客户端内：通过 H5-JS-SDK requestAuthCode 获取授权码
      setFeishuStatus('飞书客户端授权中...');
      const code = await new Promise((resolve, reject) => {
        const h5sdk = window.h5sdk;
        const tt = window.tt;

        const doRequest = () => {
          if (tt && typeof tt.requestAuthCode === 'function') {
            tt.requestAuthCode({
              appId: FEISHU_APP_ID,
              success(res) {
                const c = res.code || res.authCode || '';
                console.log('[Feishu SDK] requestAuthCode 成功, code=', c.slice(0, 8) + '...');
                resolve(c);
              },
              fail(err) {
                console.error('[Feishu SDK] requestAuthCode 失败:', err);
                reject(new Error(err.errMsg || err.errmsg || JSON.stringify(err) || '获取授权码失败'));
              }
            });
          } else {
            reject(new Error('飞书 SDK 不支持 requestAuthCode，请更新飞书客户端'));
          }
        };

        if (h5sdk && typeof h5sdk.ready === 'function') {
          h5sdk.ready(doRequest);
          if (typeof h5sdk.error === 'function') {
            h5sdk.error(err => reject(new Error(`SDK初始化异常: ${JSON.stringify(err)}`)));
          }
        } else {
          doRequest();
        }
      });

      if (!code) throw new Error('未获取到飞书授权码');
      await exchangeCodeForToken(code);
    } else {
      // 外部浏览器：跳转到飞书 OAuth 授权页
      if (!FEISHU_APP_ID) {
        // 未配置App ID，进入本地免登录模式
        setFeishuStatus('本地模式');
        authToken = 'local_demo';
        currentUser = { name: '本地用户', user_id: 'local' };
        localStorage.setItem(AUTH_STORAGE_KEY, authToken);
        localStorage.setItem('table-app-current-user', JSON.stringify(currentUser));
        showApp();
        await startAppOnce();
        return;
      }
      setFeishuStatus('正在跳转至飞书授权...');
      const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
      const feishuAuthUrl = `https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=${FEISHU_APP_ID}&response_type=code&redirect_uri=${redirectUri}&state=feishu_login`;
      window.location.href = feishuAuthUrl;
    }
  } catch (err) {
    setLoginError(err.message || '飞书登录失败');
    setFeishuStatus('登录失败，请重试');
  }
}

async function handleLogout() {
  // 纯前端模式：直接清理本地登录态
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem('table-app-current-user');
  authToken = '';
  currentUser = null;
  location.reload();
}

function bindAuthEvents() {
  els.btnLogout?.addEventListener('click', handleLogout);
}

async function startAppOnce() {
  if (appInitialized) return;
  appInitialized = true;
  await init();
}

