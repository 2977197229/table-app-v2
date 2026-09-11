// ===== Global State =====
let projects = [];
let projectDetails = {};
let activeProjectDetailKey = '';
let currentSheet = '在坐标这边生活';

const SHEETS = [
  '在坐标这边生活',
  '字节单',
  '暂停+回声+频率',
  '小红书',
  '快手+视频号',
  '🌟娱乐社+八妹+番茄+小歪+果子',
  '🌟小圆子+野生+贝壳+小涡+小赵',
  '📦 停滞项目',
  '✅ 已发布合集'
];

// 自动归纳表格配置
const AUTO_SHEETS = {
  '📦 停滞项目': {
    title: '停滞项目（接单日期超过2个月未发布）',
    filter: (p) => {
      if (!p.date || p.status === '已发布') return false;
      if (AUTO_SHEETS_NAMES.includes(p.sheet)) return false; // 不重复归纳
      const orderDate = new Date(p.date);
      if (isNaN(orderDate)) return false;
      const diffDays = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 60;
    }
  },
  '✅ 已发布合集': {
    title: '已发布项目合集',
    filter: (p) => {
      if (p.status !== '已发布') return false;
      if (AUTO_SHEETS_NAMES.includes(p.sheet)) return false;
      return true;
    }
  }
};
const AUTO_SHEETS_NAMES = Object.keys(AUTO_SHEETS);

// 自动归纳表格的列定义
const AUTO_SHEET_FIELDS = [
  { key: 'erp', label: 'ERP', type: 'checkbox', width: '60px' },
  { key: 'platform', label: '平台', type: 'select', width: '90px' },
  { key: 'name', label: '项目名字', type: 'text', width: '180px' },
  { key: 'date', label: '接单日期', type: 'date', width: '120px' },
  { key: 'publishDate', label: '发布日期', type: 'date', width: '120px' },
  { key: 'business', label: '下单人', type: 'text', width: '90px' },
  { key: 'title', label: '标题', type: 'text', width: '180px' },
  { key: 'orderType', label: '订单类型', type: 'select', width: '100px' },
  { key: 'brandTaskId', label: '品牌任务ID', type: 'text', width: '120px' },
  { key: 'account', label: '账号名', type: 'text', width: '130px' },
  { key: 'link', label: '发布链接', type: 'text', width: '260px' },
  { key: 'assignee', label: '接单人', type: 'text', width: '90px' },
  { key: 'editor', label: '剪辑', type: 'text', width: '90px' }
];

const STATUS_OPTIONS = ['已发布','脚本制作中','脚本送审','图文送审','视频制作中','视频送审','定时发布','项目暂停','大纲','已给压缩包'];
const PLATFORM_OPTIONS = ['抖音','快手','小红书','视频号','B站','星图','磁力','蒲公英','花火'];
const ORDER_TYPE_OPTIONS = ['娱乐水下单','星图21-60S','星图60S+','互选60s+','互选60s内','快手磁力','字节单','小红书站内','小红书蒲公英'];
const TABLE_FIELDS = ['status', 'platform', 'name', 'date', 'publishDate', 'business', 'title', 'orderType', 'brandTaskId', 'account', 'link', 'assignee', 'editor', 'remark'];

// 子表默认订单类型映射
const SHEET_DEFAULT_ORDER_TYPE = {
  '字节单': '字节单',
  '小红书': '小红书站内单'
};
function getDefaultOrderType(sheetName) {
  return SHEET_DEFAULT_ORDER_TYPE[sheetName] || '';
}

// 子表默认平台映射
const SHEET_DEFAULT_PLATFORM = {
  '小红书': '小红书',
  '字节单': '抖音'
};
function getDefaultPlatform(sheetName) {
  return SHEET_DEFAULT_PLATFORM[sheetName] || '';
}

// 智能识别订单类型：根据输入文本中的关键词和视频时长推断
function inferOrderType(text) {
  if (!text) return '';
  const fullText = String(text);
  const lower = fullText.toLowerCase();

  // 提取视频时长
  let duration = 0;
  const durMatch = fullText.match(/(\d+)\s*[-~～至]\s*(\d+)\s*s/i);
  if (durMatch) {
    duration = parseInt(durMatch[2]);
  } else {
    const singleDur = fullText.match(/(\d+)\s*s/i);
    if (singleDur) duration = parseInt(singleDur[1]);
  }

  // 检测关键词并推断订单类型
  // 互选
  if (/互选/.test(fullText)) {
    if (duration > 0 && duration <= 60) return '互选60s内';
    if (duration > 60) return '互选60s+';
    // 没有时长信息，看是否有"内"字
    if (/60s?内|30.?60s?内|内/.test(fullText)) return '互选60s内';
    return '互选60s+';
  }

  // 星图
  if (/星图/.test(fullText)) {
    if (duration > 0 && duration <= 60) return '星图21-60S';
    if (duration > 60) return '星图60S+';
    if (/60s?\+|60s?以上|大于60/.test(fullText)) return '星图60S+';
    return '星图21-60S';
  }

  // 快手磁力
  if (/磁力/.test(fullText)) {
    return '快手磁力';
  }

  // 小红书蒲公英
  if (/小红书/.test(fullText) && /蒲公英/.test(fullText)) {
    return '小红书蒲公英';
  }

  // 小红书站内
  if (/小红书/.test(fullText)) {
    return '小红书站内';
  }

  // 字节
  if (/字节|抖音/.test(fullText)) {
    return '字节单';
  }

  // 娱乐水下单（默认）
  if (/水单|水下|娱乐水/.test(fullText)) {
    return '娱乐水下单';
  }

  // 无法确定
  return '';
}
const AUTH_STORAGE_KEY = 'table-app-auth-token';
const HISTORY_STORAGE_KEY = 'table-app-operation-history';
const PROJECT_DETAILS_STORAGE_KEY = 'table-app-project-details';
const GROUP_BY_OPTIONS = {
  name: { label: '项目名', empty: '(未命名项目)' },
  date: { label: '接单日期', empty: '(未填写接单日期)' },
  publishDate: { label: '发布日期', empty: '(未填写发布日期)' },
  assignee: { label: '接单人', empty: '(未填写接单人)' },
  status: { label: '项目进度', empty: '(未填写项目进度)' }
};
let currentGroupBy = 'status';
let currentGroupValue = '__all__';
let operationHistory = [];
let undoStack = [];
let selectedAll = false;
let selectedRows = new Set();
let lastTablePasteAt = 0;
let cellSelection = null;
let isSelectingCells = false;
let draggedSelection = null;

const STATUS_MAP = {
  '已发布': 'status-published',
  '脚本制作中': 'status-making',
  '脚本送审': 'status-script-review',
  '图文送审': 'status-image-review',
  '视频制作中': 'status-video-making',
  '视频送审': 'status-video-review',
  '脚本送审': 'status-review-script',
  '视频送审': 'status-review-video',
  '定时发布': 'status-scheduled',
  '项目暂停': 'status-paused',
  '大纲': 'status-outline',
  '已给压缩包': 'status-package'
};

const STATUS_LABEL = {
  '已发布': '已发布',
  '脚本送审': '脚本送审',
  '视频送审': '视频送审',
  '定时发布': '定时发布',
  '项目暂停': '暂停',
  '大纲': '大纲',
  '已给压缩包': '已给包'
};

// ===== DOM Elements =====
const els = {
  btnAddRow: document.getElementById('btn-add-row'),
  btnSaveLocal: document.getElementById('btn-save-local'),
  btnWriteFeishu: document.getElementById('btn-write-feishu'),
  btnCopyCommand: document.getElementById('btn-copy-command'),
  projectSearch: document.getElementById('project-search'),
  groupBySelect: document.getElementById('group-by-select'),
  groupValueSelect: document.getElementById('group-value-select'),
  historyDate: document.getElementById('history-date'),
  btnHistoryView: document.getElementById('btn-history-view'),
  btnHistoryToday: document.getElementById('btn-history-today'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  tableWrapper: document.getElementById('table-wrapper'),
  tableBody: document.getElementById('table-body'),
  previewContent: document.getElementById('preview-content'),
  projectCount: document.getElementById('project-count'),
  emptySheetName: document.getElementById('empty-sheet-name'),
  sheetTabs: document.getElementById('sheet-tabs'),
  todayBadge: document.getElementById('today-badge'),
  modalFeishu: document.getElementById('modal-feishu'),
  modalClose: document.getElementById('modal-close'),
  feishuCommand: document.getElementById('feishu-command'),
  modalHistory: document.getElementById('modal-history'),
  historyModalClose: document.getElementById('history-modal-close'),
  historyTitle: document.getElementById('history-title'),
  historySummary: document.getElementById('history-summary'),
  historyContent: document.getElementById('history-content'),
  modalProjectDetail: document.getElementById('modal-project-detail'),
  projectDetailClose: document.getElementById('project-detail-close'),
  projectDetailTitle: document.getElementById('project-detail-title'),
  projectDetailSummary: document.getElementById('project-detail-summary'),
  detailOrderInfo: document.getElementById('detail-order-info'),
  detailReferenceLink: document.getElementById('detail-reference-link'),
  detailReferenceNote: document.getElementById('detail-reference-note'),
  detailAccountList: document.getElementById('detail-account-list'),
  btnProjectDetailSave: document.getElementById('btn-project-detail-save'),
  btnProjectDetailRefresh: document.getElementById('btn-project-detail-refresh'),
  btnProjectDetailCopyLink: document.getElementById('btn-project-detail-copy-link'),
  toast: document.getElementById('toast'),
  loginScreen: document.getElementById('login-screen'),
  loginError: document.getElementById('login-error'),
  btnLogout: document.getElementById('btn-logout'),
  currentUser: document.getElementById('current-user'),
  feishuStatusText: document.getElementById('feishu-status-text'),
  btnFeishuRetry: document.getElementById('btn-feishu-retry'),
  // Smart entry
  btnSmartInput: document.getElementById('btn-smart-input'),
  modalSmart: document.getElementById('modal-smart'),
  smartModalClose: document.getElementById('smart-modal-close'),
  smartInput: document.getElementById('smart-input'),
  smartResult: document.getElementById('smart-result'),
  smartCount: document.getElementById('smart-count'),
  btnSmartParse: document.getElementById('btn-smart-parse'),
  btnSmartClear: document.getElementById('btn-smart-clear'),
  btnSmartSample: document.getElementById('btn-smart-sample'),
  btnSmartAdd: document.getElementById('btn-smart-add'),
  btnFilterHandover: document.getElementById('btn-filter-handover'),
  shiftBadge: document.getElementById('shift-badge'),
  // Schedule
  primaryDuty: document.getElementById('primary-duty'),
  modalSchedule: document.getElementById('modal-schedule'),
  orderStatsContent: document.getElementById('order-stats-content'),
  orderStatsWeek: document.getElementById('order-stats-week')
};

let authToken = localStorage.getItem(AUTH_STORAGE_KEY) || '';
let appInitialized = false;
let currentUser = null;

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
  console.log('[DEBUG] feishuLogin start, appId=', JSON.stringify(FEISHU_APP_ID), 'h5sdk=', typeof window.h5sdk, 'tt=', typeof window.tt);
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
    console.log('[DEBUG] inFeishu=', inFeishu, 'FEISHU_APP_ID=', JSON.stringify(FEISHU_APP_ID));

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
        console.log('[DEBUG] entering local mode');
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

// ===== Init =====
async function init() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  els.todayBadge.textContent = `📅 今天：${month}月${day}日`;
  if (els.historyDate) els.historyDate.value = getTodayDateString();
  if (els.groupBySelect) els.groupBySelect.value = currentGroupBy;

  bindEvents();
  initShiftBadge();
  loadScheduleData();
  renderPrimaryDuty();
  loadOperationHistory();
  await loadProjectDetails();
  await loadProjects();
  // 初始化时恢复正确的表头（确保HTML中的旧样式被覆盖）
  if (!AUTO_SHEETS[currentSheet]) {
    restoreDefaultTableHeader();
  }
  recordOperationHistory('打开页面快照');
  renderAccountFilterBar();
  renderProjects();
  renderOrderStatistics();
  initTaskView();
  // 刷新页面时清除URL中的detail参数，不自动弹出项目详情
  const detailKey = new URLSearchParams(window.location.search).get('detail');
  if (detailKey) {
    const url = new URL(window.location.href);
    url.searchParams.delete('detail');
    history.replaceState(null, '', url.toString());
  }
}

// ===== Event Binding =====
// 搜索防抖定时器
let searchDebounceTimer = null;

function bindEvents() {
  els.btnAddRow.addEventListener('click', addEmptyRow);
  els.btnSaveLocal.addEventListener('click', saveToLocal);
  els.btnWriteFeishu.addEventListener('click', generateFeishuCommand);
  els.btnCopyCommand.addEventListener('click', copyCommand);
  els.projectSearch.addEventListener('input', () => {
    selectedAll = false;
    selectedRows.clear();
    // 300ms 防抖自动触发搜索
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      renderProjects();
    }, 300);
  });
  els.projectSearch.addEventListener('keydown', (e) => {
    // 回车立即触发搜索
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      renderProjects();
    }
  });
  els.groupBySelect?.addEventListener('change', () => {
    currentGroupBy = els.groupBySelect.value || 'name';
    currentGroupValue = '__all__';
    if (els.groupValueSelect) els.groupValueSelect.value = '__all__';
    selectedAll = false;
    selectedRows.clear();
    collapsedGroups.clear();
    renderProjects();
  });
  els.groupValueSelect?.addEventListener('change', () => {
    currentGroupValue = els.groupValueSelect.value || '__all__';
    selectedAll = false;
    selectedRows.clear();
    collapsedGroups.clear();
    renderProjects();
  });
  els.btnHistoryView?.addEventListener('click', () => openHistoryModal(els.historyDate.value || getTodayDateString()));
  els.btnHistoryToday?.addEventListener('click', () => {
    els.historyDate.value = getTodayDateString();
    openHistoryModal(els.historyDate.value);
  });
  els.historyDate?.addEventListener('change', () => openHistoryModal(els.historyDate.value || getTodayDateString()));
  els.btnClearSearch.addEventListener('click', () => {
    els.projectSearch.value = '';
    selectedAll = false;
    selectedRows.clear();
    renderProjects();
    els.projectSearch.focus();
  });
  els.modalClose.addEventListener('click', closeModal);
  els.modalFeishu.querySelector('.modal-overlay').addEventListener('click', closeModal);
  els.historyModalClose?.addEventListener('click', closeHistoryModal);
  els.modalHistory?.querySelector('.modal-overlay')?.addEventListener('click', closeHistoryModal);
  els.projectDetailClose?.addEventListener('click', closeProjectDetailModal);
  els.modalProjectDetail?.querySelector('.modal-overlay')?.addEventListener('click', closeProjectDetailModal);
  els.btnProjectDetailSave?.addEventListener('click', saveCurrentProjectDetailFromModal);
  els.btnProjectDetailCopyLink?.addEventListener('click', copyCurrentProjectDetailLink);
  els.btnProjectDetailRefresh?.addEventListener('click', () => {
    if (!activeProjectDetailKey) return;
    const rows = getProjectsByDetailKey(activeProjectDetailKey);
    const detail = ensureProjectDetail(rows[0]);
    syncProjectDetailAccounts(detail, rows);
    projectDetails[activeProjectDetailKey] = detail;
    renderProjectDetailModal();
    saveProjectDetails('同步项目详情账号');
    showToast('已同步当前项目账号');
  });

  // Smart entry events
  els.btnSmartInput.addEventListener('click', openSmartModal);
  document.getElementById('btn-order-stats')?.addEventListener('click', openOrderStatsModal);
  els.smartModalClose.addEventListener('click', closeSmartModal);
  els.modalSmart.querySelector('.modal-overlay').addEventListener('click', closeSmartModal);
  els.btnSmartParse.addEventListener('click', () => parseSmartInput());
  els.btnSmartClear.addEventListener('click', () => {
    els.smartInput.value = '';
    els.smartResult.innerHTML = `
      <div class="smart-empty">
        <div class="smart-empty-icon">🤖</div>
        <p>粘贴文本后点击「解析」</p>
        <p class="smart-empty-sub">解析器会自动识别字段、展开账号分组</p>
      </div>`;
    els.smartCount.textContent = '0 条';
    els.btnSmartAdd.disabled = true;
  });
  els.btnSmartSample.addEventListener('click', fillSample);
  els.btnSmartAdd.addEventListener('click', addParsedProjects);

  // 交接筛选按钮
  els.btnFilterHandover?.addEventListener('click', toggleHandoverFilter);

  // 账号映射配置按钮
  document.getElementById('btn-account-config')?.addEventListener('click', openAccountConfigModal);
  // 配置弹窗 tab 切换
  document.querySelectorAll('.account-config-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.account-config-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderAccountConfigEditor(tab.dataset.configSheet);
    });
  });
  // 配置弹窗：新增映射行
  document.getElementById('btn-account-config-add-row')?.addEventListener('click', () => {
    const editor = document.getElementById('account-config-editor');
    if (!editor) return;
    const tbody = editor.querySelector('tbody');
    const tr = document.createElement('tr');
    tr.className = 'config-row';
    tr.innerHTML = `<td><input type="text" class="config-alias" placeholder="简称"></td>
      <td><input type="text" class="config-fullname" placeholder="完整账号名"></td>
      <td><button class="btn btn-secondary btn-sm config-del-btn" onclick="this.closest('tr').remove()">✕</button></td>`;
    tbody.appendChild(tr);
  });
  // 配置弹窗：保存
  document.getElementById('btn-account-config-save')?.addEventListener('click', saveAccountConfig);

  // 来源列显示/隐藏切换
  document.getElementById('btn-toggle-source')?.addEventListener('click', toggleAutoSheetSource);

  // 批量编辑栏
  els.batchEditBar = document.getElementById('batch-edit-bar');
  els.batchEditInfo = document.getElementById('batch-edit-info');
  els.batchEditInput = document.getElementById('batch-edit-input');
  document.getElementById('btn-batch-fill')?.addEventListener('click', executeBatchFill);
  document.getElementById('btn-batch-clear')?.addEventListener('click', () => {
    clearTableSelection();
  });
  document.getElementById('btn-batch-cancel')?.addEventListener('click', () => {
    clearCellSelection();
    updateBatchEditBar();
  });
  els.batchEditInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeBatchFill();
    } else if (e.key === 'Escape') {
      clearCellSelection();
      updateBatchEditBar();
    }
  });

  // Auto-parse on input (debounced)
  let parseTimer = null;
  els.smartInput.addEventListener('input', () => {
    clearTimeout(parseTimer);
    parseTimer = setTimeout(() => parseSmartInput(), 600);
  });

  // Sheet tabs
  els.sheetTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.sheet-tab');
    if (!tab) return;
    switchSheet(tab.dataset.sheet);
  });

  // Global keyboard shortcuts
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('paste', handleTablePaste);
}

// ===== Global Keyboard Shortcuts =====
function handleGlobalKeydown(e) {
  // Don't trigger when inside modals or smart input
  if (els.modalFeishu.classList.contains('show') || els.modalSmart.classList.contains('show') || els.modalHistory?.classList.contains('show') || els.modalProjectDetail?.classList.contains('show') || document.getElementById('modal-account-config')?.classList.contains('show') || els.modalSchedule?.classList.contains('show')) {
    if (e.key === 'Escape') {
      closeModal();
      closeSmartModal();
      closeHistoryModal();
      closeProjectDetailModal();
      closeAccountConfigModal();
      closeScheduleModal();
      e.preventDefault();
    }
    return;
  }

  const isCtrl = e.ctrlKey || e.metaKey;
  const isEditing = document.activeElement && (
    document.activeElement.isContentEditable ||
    document.activeElement.tagName === 'INPUT' ||
    document.activeElement.tagName === 'SELECT' ||
    document.activeElement.tagName === 'TEXTAREA'
  );

  // Ctrl+F：聚焦搜索框
  if (isCtrl && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    els.projectSearch.focus();
    els.projectSearch.select();
    return;
  }

  // Ctrl+方向键：在单元格之间移动，编辑状态下也可用
  if (isCtrl && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    navigateTableCells(e);
    return;
  }

  // Ctrl+C：复制当前单元格；全选状态下复制当前子表可见数据
  if (isCtrl && e.key.toLowerCase() === 'c') {
    const selectedText = window.getSelection().toString();
    if (!selectedText) {
      e.preventDefault();
      copyTableSelection();
    }
    return;
  }

  // Ctrl+V：粘贴到当前单元格；支持从 Excel/表格复制的多行多列文本
  if (isCtrl && e.key.toLowerCase() === 'v') {
    const pasteInfo = getPasteTargetInfo();
    if (pasteInfo) {
      scheduleShortcutPasteFallback(pasteInfo);
    }
    return;
  }

  // Ctrl+A：全选当前子表可见单元格
  if (isCtrl && e.key.toLowerCase() === 'a') {
    const activeInfo = getActiveCellInfo();
    if (!isEditing && activeInfo) {
      e.preventDefault();
      selectAllVisibleCells();
    }
    return;
  }

  // Delete/Backspace：清空当前单元格；全选后清空所有可见单元格
  if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing) {
    e.preventDefault();
    clearTableSelection();
    return;
  }

  // Alt+↑ / Alt+↓：当前行上下移动
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    moveCurrentRow(e.key === 'ArrowUp' ? -1 : 1);
    return;
  }

  // Ctrl+N: Add empty row (when not editing)
  if (isCtrl && e.key.toLowerCase() === 'n' && !isEditing) {
    e.preventDefault();
    addEmptyRow();
    return;
  }

  // Ctrl+S: Save to local (when not editing)
  if (isCtrl && e.key.toLowerCase() === 's' && !isEditing) {
    e.preventDefault();
    saveToLocal();
    return;
  }

  // Ctrl+D: Delete current focused row (when not editing)
  if (isCtrl && e.key.toLowerCase() === 'd' && !isEditing) {
    e.preventDefault();
    const focusedRow = document.activeElement?.closest('tr[data-id]');
    if (focusedRow) {
      const id = Number(focusedRow.dataset.id);
      if (confirm('确定删除此行？')) {
        deleteProject(id);
      }
    }
    return;
  }

  // Ctrl+Z：撤销上一步操作
  if (isCtrl && e.key.toLowerCase() === 'z' && !isEditing) {
    e.preventDefault();
    undoLastAction();
    return;
  }

  // Ctrl+/：显示/隐藏快捷键帮助
  if (isCtrl && e.key === '/') {
    e.preventDefault();
    toggleKeyboardHelp();
    return;
  }

  // Escape: close help, clear cell selection, or close modals
  if (e.key === 'Escape') {
    const help = document.getElementById('keyboard-help');
    if (help && help.classList.contains('show')) {
      help.classList.remove('show');
      e.preventDefault();
      return;
    }
    // 清除单元格选择
    if (cellSelection) {
      clearCellSelection();
      e.preventDefault();
      return;
    }
  }

  // Arrow keys navigation (when not editing)
  if (!isEditing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    navigateTableCells(e);
  }
}

function toggleKeyboardHelp() {
  let help = document.getElementById('keyboard-help');
  if (!help) {
    help = document.createElement('div');
    help.id = 'keyboard-help';
    help.className = 'keyboard-help';
    help.innerHTML = `
      <div class="keyboard-help-content">
        <div class="keyboard-help-header">
          <h3>⌨️ 快捷键</h3>
          <button class="keyboard-help-close" onclick="this.closest('.keyboard-help').classList.remove('show')">&times;</button>
        </div>
        <div class="keyboard-help-body">
          <div class="kb-row"><kbd>Ctrl</kbd>+<kbd>C</kbd><span>复制当前单元格 / 已选区域</span></div>
          <div class="kb-row"><kbd>Ctrl</kbd>+<kbd>V</kbd><span>粘贴到当前单元格，支持多行多列</span></div>
          <div class="kb-row"><kbd>Ctrl</kbd>+<kbd>A</kbd><span>全选当前子表可见内容</span></div>
          <div class="kb-row"><kbd>Ctrl</kbd>+<kbd>F</kbd><span>搜索筛选当前子表</span></div>
          <div class="kb-row"><kbd>Delete</kbd><span>清空当前单元格 / 已选区域</span></div>
          <div class="kb-sep"></div>
          <div class="kb-row"><kbd>Ctrl</kbd>+<kbd>Z</kbd><span>撤销上一步操作</span></div>
          <div class="kb-row"><kbd>Ctrl</kbd>+<kbd>N</kbd><span>添加空行</span></div>
          <div class="kb-row"><kbd>Ctrl</kbd>+<kbd>S</kbd><span>保存到本地</span></div>
          <div class="kb-row"><kbd>Ctrl</kbd>+<kbd>D</kbd><span>删除当前行</span></div>
          <div class="kb-row"><kbd>Ctrl</kbd>+<kbd>/</kbd><span>显示/隐藏快捷键帮助</span></div>
          <div class="kb-sep"></div>
          <div class="kb-row"><kbd>Tab</kbd><span>下一单元格</span></div>
          <div class="kb-row"><kbd>Shift</kbd>+<kbd>Tab</kbd><span>上一单元格</span></div>
          <div class="kb-row"><kbd>Enter</kbd><span>确认编辑并跳到下一格</span></div>
          <div class="kb-row"><kbd>Ctrl</kbd>+<kbd>方向键</kbd><span>移动单元格焦点</span></div>
          <div class="kb-row"><kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd><span>当前行上移/下移</span></div>
          <div class="kb-row"><kbd>Esc</kbd><span>取消编辑 / 关闭弹窗</span></div>
        </div>
      </div>
    `;
    document.body.appendChild(help);
    help.addEventListener('click', (e) => {
      if (e.target === help) help.classList.remove('show');
    });
  }
  help.classList.toggle('show');
}

// Navigate table cells with arrow keys
function navigateTableCells(e) {
  const table = els.tableBody;
  const rows = table.querySelectorAll('tr[data-id]');
  if (rows.length === 0) return;

  let currentTd = document.activeElement?.closest('td');
  let currentTr = currentTd?.closest('tr[data-id]');

  // If no cell is focused, focus the first editable in first row
  if (!currentTr) {
    const firstEditable = rows[0].querySelector('[contenteditable], input, select');
    if (firstEditable) firstEditable.focus();
    e.preventDefault();
    return;
  }

  const allCells = Array.from(currentTr.querySelectorAll('td'));
  const cellIndex = allCells.indexOf(currentTd);

  const currentRowIndex = Array.from(rows).indexOf(currentTr);

  if (e.key === 'ArrowUp' && currentRowIndex > 0) {
    e.preventDefault();
    const prevRow = rows[currentRowIndex - 1];
    focusCell(prevRow, cellIndex);
  } else if (e.key === 'ArrowDown' && currentRowIndex < rows.length - 1) {
    e.preventDefault();
    const nextRow = rows[currentRowIndex + 1];
    focusCell(nextRow, cellIndex);
  } else if (e.key === 'ArrowLeft' && cellIndex > 0) {
    e.preventDefault();
    focusCell(currentTr, cellIndex - 1);
  } else if (e.key === 'ArrowRight' && cellIndex < allCells.length - 1) {
    e.preventDefault();
    focusCell(currentTr, cellIndex + 1);
  }
}

function focusCell(row, cellIndex) {
  const cells = row.querySelectorAll('td[data-field]');
  if (cells[cellIndex]) {
    const editable = cells[cellIndex].querySelector('[contenteditable], input, select');
    if (editable) {
      editable.focus();
      markActiveCell(cells[cellIndex]);
      if (editable.tagName === 'INPUT') {
        editable.select();
      } else if (editable.tagName !== 'SELECT') {
        // Select all text for quick editing
        const range = document.createRange();
        range.selectNodeContents(editable);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }
}

function markActiveCell(td) {
  document.querySelectorAll('.cell-active').forEach(cell => cell.classList.remove('cell-active'));
  if (td) td.classList.add('cell-active');
  if (selectedAll) {
    selectedAll = false;
    document.querySelectorAll('.cell-selected').forEach(cell => cell.classList.remove('cell-selected'));
  }
  if (selectedRows.size > 0) {
    selectedRows.clear();
    document.querySelectorAll('.row-selected, .group-selected').forEach(row => row.classList.remove('row-selected', 'group-selected'));
  }
}

function clearCellSelection() {
  cellSelection = null;
  document.querySelectorAll('.cell-selected, .cell-selection-start, .cell-drop-target').forEach(cell => {
    cell.classList.remove('cell-selected', 'cell-selection-start', 'cell-drop-target');
  });
  updateBatchEditBar();
}

function getVisibleDataRows() {
  return Array.from(els.tableBody.querySelectorAll('tr[data-id]:not(.hidden)'));
}

function getCellInfoFromTd(td) {
  const tr = td?.closest?.('tr[data-id]');
  if (!td || !tr || !td.dataset.field) return null;
  return {
    td,
    tr,
    id: Number(tr.dataset.id),
    field: td.dataset.field,
    cellIndex: Array.from(tr.querySelectorAll('td[data-field]')).indexOf(td),
    rowIndex: getVisibleDataRows().indexOf(tr)
  };
}

function normalizeCellSelection(selection) {
  if (!selection) return null;
  return {
    startRow: Math.min(selection.startRow, selection.endRow),
    endRow: Math.max(selection.startRow, selection.endRow),
    startCol: Math.min(selection.startCol, selection.endCol),
    endCol: Math.max(selection.startCol, selection.endCol)
  };
}

function applyCellSelectionClasses() {
  document.querySelectorAll('.cell-selected, .cell-selection-start').forEach(cell => {
    cell.classList.remove('cell-selected', 'cell-selection-start');
  });
  const range = normalizeCellSelection(cellSelection);
  if (!range) return;
  const rows = getVisibleDataRows();
  rows.forEach((row, rowIndex) => {
    if (rowIndex < range.startRow || rowIndex > range.endRow) return;
    const cells = Array.from(row.querySelectorAll('td[data-field]'));
    cells.forEach((cell, cellIndex) => {
      if (cellIndex < range.startCol || cellIndex > range.endCol) return;
      cell.classList.add('cell-selected');
      if (rowIndex === cellSelection.startRow && cellIndex === cellSelection.startCol) {
        cell.classList.add('cell-selection-start');
      }
    });
  });
}

function setCellSelection(startInfo, endInfo = startInfo) {
  if (!startInfo || !endInfo || startInfo.rowIndex < 0 || endInfo.rowIndex < 0) return;
  selectedAll = false;
  selectedRows.clear();
  document.querySelectorAll('.row-selected, .group-selected').forEach(row => row.classList.remove('row-selected', 'group-selected'));
  cellSelection = {
    startRow: startInfo.rowIndex,
    startCol: startInfo.cellIndex,
    endRow: endInfo.rowIndex,
    endCol: endInfo.cellIndex
  };
  applyCellSelectionClasses();
  updateBatchEditBar();
}

function getCellSelectionMatrix() {
  const range = normalizeCellSelection(cellSelection);
  if (!range) return [];
  const rows = getVisibleDataRows();
  const matrix = [];
  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex++) {
    const row = rows[rowIndex];
    const project = projects.find(p => p.id === Number(row?.dataset.id));
    if (!project) continue;
    const values = [];
    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex++) {
      const field = TABLE_FIELDS[colIndex];
      values.push(getCellValueByField(project, field));
    }
    matrix.push(values);
  }
  return matrix;
}

function getCellSelectionText() {
  return getCellSelectionMatrix().map(row => row.join('\t')).join('\n');
}

function getCellSelectionSize() {
  const range = normalizeCellSelection(cellSelection);
  if (!range) return 0;
  return (range.endRow - range.startRow + 1) * (range.endCol - range.startCol + 1);
}

function getPasteTargetInfo() {
  const range = normalizeCellSelection(cellSelection);
  if (range) {
    const row = getVisibleDataRows()[range.startRow];
    const td = row?.querySelectorAll('td[data-field]')?.[range.startCol];
    return getCellInfoFromTd(td);
  }
  return getActiveCellInfo();
}

function getActiveCellInfo() {
  const active = document.activeElement;
  const td = active?.closest?.('td[data-field]');
  const tr = td?.closest('tr[data-id]');
  if (!td || !tr) return null;
  return {
    td,
    tr,
    id: Number(tr.dataset.id),
    field: td.dataset.field,
    cellIndex: Array.from(tr.querySelectorAll('td[data-field]')).indexOf(td),
    rowIndex: getVisibleDataRows().indexOf(tr)
  };
}

function getCellValueByField(project, field) {
  return project?.[field] || '';
}

function setProjectField(project, field, value) {
  if (!project || !field) return;
  if (field === 'platform' && value && !PLATFORM_OPTIONS.includes(value)) return;
  if (field === 'status' && value && !STATUS_OPTIONS.includes(value)) return;
  project[field] = value;
  if (field === 'link') {
    applyPublishLinkSideEffects(project, value);
  }
}

async function copyTableSelection() {
  const visibleRows = Array.from(els.tableBody.querySelectorAll('tr[data-id]:not(.hidden)'));
  let text = '';

  if (cellSelection) {
    text = getCellSelectionText();
  } else if (selectedRows.size > 0) {
    text = visibleRows
      .filter(row => selectedRows.has(Number(row.dataset.id)))
      .map(row => {
        const project = projects.find(p => p.id === Number(row.dataset.id));
        return TABLE_FIELDS.map(field => getCellValueByField(project, field)).join('\t');
      }).join('\n');
  } else if (selectedAll) {
    text = visibleRows.map(row => {
      const project = projects.find(p => p.id === Number(row.dataset.id));
      return TABLE_FIELDS.map(field => getCellValueByField(project, field)).join('\t');
    }).join('\n');
  } else {
    const info = getActiveCellInfo();
    if (!info) return;
    const project = projects.find(p => p.id === info.id);
    text = getCellValueByField(project, info.field);
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast(cellSelection ? `已复制 ${getCellSelectionSize()} 个单元格` : (selectedRows.size > 0 ? `已复制选中 ${selectedRows.size} 行` : (selectedAll ? '已复制当前子表可见内容' : '已复制当前单元格')));
  } catch (err) {
    showToast('复制失败，请使用浏览器授权剪贴板', 'error');
  }
}

async function pasteIntoTable() {
  const info = getPasteTargetInfo();
  if (!info) return;

  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch (err) {
    showToast('粘贴失败，请使用浏览器授权剪贴板', 'error');
    return;
  }
  if (!text) return;

  const rows = text.replace(/\r/g, '').split('\n').filter(row => row.length > 0);
  const visibleRows = Array.from(els.tableBody.querySelectorAll('tr[data-id]:not(.hidden)'));
  let changed = 0;

  rows.forEach((rowText, rOffset) => {
    const targetRow = visibleRows[info.rowIndex + rOffset];
    if (!targetRow) return;
    const targetProject = projects.find(p => p.id === Number(targetRow.dataset.id));
    if (!targetProject) return;

    const values = rowText.split('\t');
    values.forEach((value, cOffset) => {
      const field = TABLE_FIELDS[info.cellIndex + cOffset];
      if (!field) return;
      setProjectField(targetProject, field, value.trim());
      changed++;
    });
  });

  if (changed > 0) {
    saveProjects(`粘贴 ${changed} 个单元格`);
    renderProjects();
    showToast(`已粘贴 ${changed} 个单元格`);
  }
}

function handleTablePaste(e) {
  // 智能录入弹窗打开时，不拦截粘贴事件，让文本框正常粘贴
  if (els.modalSmart.classList.contains('show')) return;
  // 排班设置弹窗打开时同样不拦截
  if (els.modalSchedule?.classList.contains('show')) return;
  // 账号映射配置弹窗打开时同样不拦截
  if (document.getElementById('modal-account-config')?.classList.contains('show')) return;

  const text = e.clipboardData?.getData('text/plain') || '';
  if (!text) return;

  const active = document.activeElement;
  const isEditingText = active && (
    active.matches?.('[contenteditable="true"]') ||
    active.tagName === 'INPUT' ||
    active.tagName === 'TEXTAREA'
  );
  const isTablePaste = text.includes('\t') || String(text).replace(/\r/g, '').split('\n').filter(row => row.length > 0).length > 1;
  const selectionSize = cellSelection ? getCellSelectionSize() : 0;
  // 当用户正在编辑文本单元格、只选了一个单元格、且不是多行/多列表格粘贴时，
  // 让浏览器原生粘贴生效（保留光标位置和部分粘贴功能）
  if (isEditingText && selectionSize <= 1 && !isTablePaste) {
    return;
  }

  // 如果是表格粘贴且没有选中单元格，自动定位到第一个可见数据行的第一个数据列
  let info = getPasteTargetInfo();
  if (!info && isTablePaste) {
    const firstRow = getVisibleDataRows()[0];
    if (firstRow) {
      const firstTd = firstRow.querySelectorAll('td[data-field]')[0];
      if (firstTd) {
        info = getCellInfoFromTd(firstTd);
      }
    }
  }
  if (!info) return;

  lastTablePasteAt = Date.now();
  e.preventDefault();
  pasteTextIntoTable(info, text);
}

function scheduleShortcutPasteFallback(info) {
  const shortcutAt = Date.now();
  const beforeValue = getCellValueByField(projects.find(p => p.id === info.id), info.field);

  window.setTimeout(async () => {
    if (lastTablePasteAt >= shortcutAt) return;

    const currentInfo = getPasteTargetInfo();
    if (!currentInfo || currentInfo.id !== info.id || currentInfo.field !== info.field) return;

    const currentProject = projects.find(p => p.id === info.id);
    const currentValue = getCellValueByField(currentProject, info.field);
    const active = document.activeElement;
    const visualValue = active?.matches?.('[contenteditable="true"]')
      ? active.textContent
      : (active?.matches?.('input') ? active.value : currentValue);

    if (String(visualValue || '') !== String(beforeValue || '')) {
      updateProjectField(info.id, info.field, String(visualValue || '').trim());
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text) pasteTextIntoTable(info, text);
    } catch (err) {
      showToast('快捷粘贴失败，请点进单元格后再按 Ctrl+V', 'error');
    }
  }, 180);
}

function pasteTextIntoTable(info, text) {
  const cleanText = String(text || '').replace(/\r/g, '');
  if (!cleanText) return;

  const isTablePaste = cleanText.includes('\t') || cleanText.split('\n').filter(row => row.length > 0).length > 1;
  if (!isTablePaste) {
    const value = cleanText.trim();
    const targetEditable = info.td?.querySelector('[contenteditable], input, select');
    if (targetEditable?.matches?.('[contenteditable="true"]')) {
      targetEditable.textContent = value;
    } else if (targetEditable?.matches?.('input, select')) {
      targetEditable.value = value;
    }
    updateProjectField(info.id, info.field, value);
    showToast('已粘贴到当前单元格');
    return;
  }

  const rows = cleanText.split('\n').filter(row => row.length > 0);
  const visibleRows = Array.from(els.tableBody.querySelectorAll('tr[data-id]:not(.hidden)'));
  let changed = 0;

  rows.forEach((rowText, rOffset) => {
    let targetRow = visibleRows[info.rowIndex + rOffset];
    let targetProject;

    // 如果目标行不存在，自动创建新行
    if (!targetRow) {
      targetProject = addEmptyRow();
      if (!targetProject) return;
      // 重新获取可见行列表
      const updatedRows = Array.from(els.tableBody.querySelectorAll('tr[data-id]:not(.hidden)'));
      targetRow = updatedRows[info.rowIndex + rOffset];
    } else {
      targetProject = projects.find(p => p.id === Number(targetRow.dataset.id));
    }
    if (!targetProject) return;

    const values = rowText.split('\t');
    values.forEach((value, cOffset) => {
      const field = TABLE_FIELDS[info.cellIndex + cOffset];
      if (!field) return;
      setProjectField(targetProject, field, value.trim());
      changed++;
    });
  });

  if (changed > 0) {
    saveProjects(`粘贴 ${changed} 个单元格`);
    renderProjects();
    showToast(`已粘贴 ${changed} 个单元格`);
  }
}

function selectAllVisibleCells() {
  selectedAll = true;
  selectedRows.clear();
  cellSelection = null;
  document.querySelectorAll('.group-item-row td[data-field]').forEach(td => {
    if (!td.closest('tr').classList.contains('hidden')) {
      td.classList.add('cell-selected');
    }
  });
  showToast('已全选当前子表可见内容');
}

function clearTableSelection() {
  if (cellSelection) {
    const range = normalizeCellSelection(cellSelection);
    const visibleRows = getVisibleDataRows();
    let changed = 0;
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex++) {
      const project = projects.find(p => p.id === Number(visibleRows[rowIndex]?.dataset.id));
      if (!project) continue;
      for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex++) {
        const field = TABLE_FIELDS[colIndex];
        setProjectField(project, field, '');
        changed++;
      }
    }
    clearCellSelection();
    saveProjects(`清空选区 ${changed} 个单元格`);
    renderProjects();
    showToast(`已清空 ${changed} 个单元格`);
    return;
  }

  if (selectedRows.size > 0) {
    const rows = Array.from(els.tableBody.querySelectorAll('tr[data-id]:not(.hidden)'))
      .filter(row => selectedRows.has(Number(row.dataset.id)));
    rows.forEach(row => {
      const project = projects.find(p => p.id === Number(row.dataset.id));
      TABLE_FIELDS.forEach(field => setProjectField(project, field, ''));
    });
    const count = selectedRows.size;
    selectedRows.clear();
    saveProjects(`清空选中 ${count} 行`);
    renderProjects();
    showToast(`已清空选中的 ${count} 行`);
    return;
  }

  if (selectedAll) {
    const visibleRows = Array.from(els.tableBody.querySelectorAll('tr[data-id]:not(.hidden)'));
    visibleRows.forEach(row => {
      const project = projects.find(p => p.id === Number(row.dataset.id));
      TABLE_FIELDS.forEach(field => setProjectField(project, field, ''));
    });
    selectedAll = false;
    saveProjects('清空当前子表可见内容');
    renderProjects();
    showToast('已清空当前子表可见内容');
    return;
  }

  const info = getActiveCellInfo();
  if (!info) return;
  updateProjectField(info.id, info.field, '');
  renderProjects();
  showToast('已清空当前单元格');
}

function moveCurrentRow(direction) {
  const info = getActiveCellInfo();
  if (!info) return;
  const visibleRows = Array.from(els.tableBody.querySelectorAll('tr[data-id]:not(.hidden)'));
  const currentIndex = visibleRows.findIndex(row => Number(row.dataset.id) === info.id);
  const targetRow = visibleRows[currentIndex + direction];
  if (!targetRow) return;

  projects.forEach((p, index) => {
    if (typeof p.order !== 'number') p.order = index;
  });

  const currentProject = projects.find(p => p.id === info.id);
  const targetProject = projects.find(p => p.id === Number(targetRow.dataset.id));
  if (!currentProject || !targetProject) return;

  const tmp = currentProject.order;
  currentProject.order = targetProject.order;
  targetProject.order = tmp;
  saveProjects('调整行顺序');
  renderProjects();

  setTimeout(() => {
    const movedRow = els.tableBody.querySelector(`tr[data-id="${currentProject.id}"]`);
    if (movedRow) focusCell(movedRow, info.cellIndex);
  }, 30);
  showToast(direction < 0 ? '当前行已上移' : '当前行已下移');
}

// ===== Render Projects as Editable Table (grouped by project name) =====
function renderProjects() {
  // 清除单元格选择（表格重新渲染后选中状态失效）
  if (cellSelection) {
    cellSelection = null;
    document.querySelectorAll('.cell-selected, .cell-selection-start').forEach(cell => {
      cell.classList.remove('cell-selected', 'cell-selection-start');
    });
    updateBatchEditBar();
  }
  // 如果是自动归纳表格，使用专门的渲染逻辑
  if (AUTO_SHEETS[currentSheet]) {
    renderAutoSheet(currentSheet);
    return;
  }
  // 非自动归纳表格时隐藏来源切换按钮
  const btnSource = document.getElementById('btn-toggle-source');
  if (btnSource) btnSource.style.display = 'none';
  const sheetProjects = projects.filter(p => p.sheet === currentSheet);
  sheetProjects.forEach((p, index) => {
    if (typeof p.order !== 'number') p.order = index;
  });
  const groupBy = GROUP_BY_OPTIONS[currentGroupBy] ? currentGroupBy : 'name';
  refreshGroupValueFilterOptions(sheetProjects, groupBy);

  const keyword = (els.projectSearch?.value || '').trim().toLowerCase();
  const todayDateKey = getShiftDateKey();
  const filtered = sheetProjects.filter(p => {
    const matchesKeyword = keyword ? projectMatchesKeyword(p, keyword) : true;
    const matchesGroupValue = currentGroupValue && currentGroupValue !== '__all__'
      ? getProjectGroupKey(p, groupBy) === currentGroupValue
      : true;
    // 交接筛选：只显示今天早班有交接标记的项目
    const matchesHandover = handoverFilterActive
      ? (p.handover && Object.entries(p.handover).some(([key, v]) => key.startsWith(todayDateKey + '|') && v.shift === 'morning'))
      : true;
    // 账号快捷筛选：仅显示选中账号的项目
    const matchesAccount = accountFilterValue
      ? (String(p.account || '').trim() === accountFilterValue)
      : true;
    return matchesKeyword && matchesGroupValue && matchesHandover && matchesAccount;
  });
  const count = filtered.length;
  const isFiltered = Boolean(keyword) || (currentGroupValue && currentGroupValue !== '__all__') || handoverFilterActive || Boolean(accountFilterValue);
  els.projectCount.textContent = isFiltered ? `${count}/${sheetProjects.length} 个项目` : `${count} 个项目`;

  if (count === 0) {
    els.tableWrapper.style.display = 'none';
    els.previewContent.style.display = 'flex';
    els.emptySheetName.textContent = currentSheet;
    const emptyText = els.previewContent.querySelector('.empty-state p');
    const emptySub = els.previewContent.querySelector('.empty-sub');
    if (emptyText) emptyText.innerHTML = isFiltered ? `当前子表「<span id="empty-sheet-name">${escapeHtml(currentSheet)}</span>」没有匹配结果` : `当前子表「<span id="empty-sheet-name">${escapeHtml(currentSheet)}</span>」暂无项目`;
    if (emptySub) emptySub.textContent = isFiltered ? '请调整筛选项、换个关键词，或清空搜索恢复全部内容' : '点击「添加空行」或「智能录入」开始录入';
    return;
  }

  els.tableWrapper.style.display = 'block';
  els.previewContent.style.display = 'none';

  const groups = {};
  filtered.forEach(p => {
    const key = getProjectGroupKey(p, groupBy);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  const groupKeys = sortGroupKeys(Object.keys(groups), groupBy);

  const tbody = els.tableBody;
  tbody.innerHTML = '';

  groupKeys.forEach((groupName, gi) => {
    const items = groups[groupName];
    // Sort within group by manual order first, then date desc
    items.sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.date) - new Date(a.date);
    });

    const collapsedKey = getCollapsedGroupKey(groupBy, groupName);
    const collapsed = collapsedGroups.has(collapsedKey);
    const groupIds = items.map(p => p.id);
    const isGroupSelected = groupIds.length > 0 && groupIds.every(id => selectedRows.has(id));

    // Group header row
    const groupTr = document.createElement('tr');
    groupTr.className = 'group-header-row' + (isGroupSelected ? ' group-selected' : '');
    groupTr.dataset.group = groupName;
    groupTr.dataset.groupBy = groupBy;
    const groupTd = document.createElement('td');
    groupTd.colSpan = TABLE_FIELDS.length + 3;
    groupTd.className = 'group-header-cell';
    // 分组业务进度文本：取首条项目状态，空则显示"未填写项目进度"
    const rawStatus = items[0]?.status || '';
    const groupStatusText = rawStatus || '未填写项目进度';
    const groupStatusClass = rawStatus ? (STATUS_MAP[rawStatus] || 'status-outline') : 'status-outline';
    groupTd.innerHTML = `
      <span class="group-toggle ${collapsed ? 'collapsed' : ''}">${collapsed ? '▶' : '▼'}</span>
      <button class="group-status-badge ${groupStatusClass}" title="选中该分组" aria-label="选中该分组" onclick="event.stopPropagation(); selectProjectGroup('${encodeURIComponent(groupName)}')">${escapeHtml(groupStatusText)}</button>
      <span class="group-meta">${items.length} 项</span>
      <button class="group-del-btn" title="删除该分组" aria-label="删除该分组" onclick="event.stopPropagation(); deleteProjectGroup('${encodeURIComponent(groupName)}')">🗑️</button>
    `;
    groupTr.appendChild(groupTd);
    groupTr.addEventListener('click', () => toggleGroup(groupName));
    tbody.appendChild(groupTr);

    // Item rows
    items.forEach((p, ri) => {
      const tr = document.createElement('tr');
      const needsVideoReminder = needsVideoFileReminder(p);
      tr.className = 'group-item-row' + (collapsed ? ' hidden' : '') + (selectedRows.has(p.id) ? ' row-selected' : '') + getTodayHandoverRowClass(p) + (needsVideoReminder ? ' video-file-reminder-row' : '');
      tr.dataset.id = p.id;
      tr.dataset.group = groupName;
      tr.dataset.groupBy = groupBy;
      if (needsVideoReminder) {
        tr.title = '⚠️ 该项目进入视频制作阶段，请填写终版视频压缩包和工程文件';
      }

      // 进度（第一列）
      tr.appendChild(createSelectCell(p, 'status', p.status, STATUS_OPTIONS));
      // 平台
      tr.appendChild(createSelectCell(p, 'platform', p.platform, PLATFORM_OPTIONS));
      // 项目名字
      tr.appendChild(createEditableCell(p, 'name', p.name));
      // 接单日期
      tr.appendChild(createEditableCell(p, 'date', p.date, 'date'));
      // 发布日期
      tr.appendChild(createEditableCell(p, 'publishDate', p.publishDate, 'date'));
      // 下单人
      tr.appendChild(createEditableCell(p, 'business', p.business));
      // 标题
      tr.appendChild(createEditableCell(p, 'title', p.title));
      // 订单类型（下拉选择）
      tr.appendChild(createSelectCell(p, 'orderType', p.orderType, ORDER_TYPE_OPTIONS));
      // 品牌任务ID（订单为品牌时手动填写）
      tr.appendChild(createEditableCell(p, 'brandTaskId', p.brandTaskId));
      // 账号名
      tr.appendChild(createEditableCell(p, 'account', p.account));
      // 发布链接（手动填写）
      tr.appendChild(createEditableCell(p, 'link', p.link));
      // 接单人（手动填写）
      tr.appendChild(createEditableCell(p, 'assignee', p.assignee));
      // 剪辑（手动填写）
      tr.appendChild(createEditableCell(p, 'editor', p.editor));
      // 备注（手动填写）
      tr.appendChild(createEditableCell(p, 'remark', p.remark));
      // 交接标记
      tr.appendChild(createHandoverCell(p));
      // 项目详情（最右边，操作之前）
      const tdDetail = document.createElement('td');
      tdDetail.className = 'detail-link-cell';
      const reminderBadge = needsVideoFileReminder(p) ? '<span class="video-reminder-badge" title="终版视频信息未填写">⚠️</span>' : '';
      tdDetail.innerHTML = `${reminderBadge}<button class="detail-link-btn" title="打开项目详情" onclick="openProjectDetail(${p.id})">详情</button>`;
      tr.appendChild(tdDetail);
      // Actions
      const tdAction = document.createElement('td');
      tdAction.innerHTML = `<button class="row-del-btn" title="删除" onclick="deleteProject(${p.id})">🗑️</button>`;
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    });
  });
  renderOrderStatistics();
}

// ===== 自动归纳表格渲染 =====
function renderAutoSheet(sheetName) {
  const config = AUTO_SHEETS[sheetName];
  if (!config) return;

  // 显示来源切换按钮
  const btnSource = document.getElementById('btn-toggle-source');
  if (btnSource) {
    btnSource.style.display = 'inline-flex';
    btnSource.textContent = autoSheetSourceVisible ? '🙈 隐藏来源' : '👁️ 显示来源';
  }

  // 筛选所有符合条件的项目
  const allAutoProjects = projects.filter(config.filter);

  // 应用搜索关键词过滤
  const keyword = (els.projectSearch?.value || '').trim().toLowerCase();
  const autoProjects = keyword
    ? allAutoProjects.filter(p => projectMatchesKeyword(p, keyword))
    : allAutoProjects;

  const isFiltered = Boolean(keyword);

  // 按接单日期降序排列
  autoProjects.sort((a, b) => new Date(b.date) - new Date(a.date));

  const count = autoProjects.length;
  els.projectCount.textContent = isFiltered ? `${count}/${allAutoProjects.length} 个项目（自动归纳）` : `${count} 个项目（自动归纳）`;

  // 动态切换表头
  const thead = document.querySelector('#data-table thead tr');
  if (thead) {
    thead.innerHTML = '';
    AUTO_SHEET_FIELDS.forEach(f => {
      const th = document.createElement('th');
      th.style.width = f.width;
      th.textContent = f.label;
      thead.appendChild(th);
    });
    // 来源列（默认隐藏）
    const thSource = document.createElement('th');
    thSource.style.width = '120px';
    thSource.textContent = '来源';
    thSource.className = 'source-col' + (autoSheetSourceVisible ? '' : ' col-hidden');
    thead.appendChild(thSource);
  }

  if (count === 0) {
    els.tableWrapper.style.display = 'none';
    els.previewContent.style.display = 'flex';
    els.emptySheetName.textContent = sheetName;
    const emptyText = els.previewContent.querySelector('.empty-state p');
    const emptySub = els.previewContent.querySelector('.empty-sub');
    if (emptyText) emptyText.innerHTML = isFiltered ? `「<span>${escapeHtml(sheetName)}</span>」没有匹配搜索关键词的项目` : `「<span>${escapeHtml(sheetName)}</span>」暂无符合条件的项目`;
    if (emptySub) emptySub.textContent = isFiltered ? '请调整关键词，或清空搜索恢复全部内容' : config.title;
    return;
  }

  els.tableWrapper.style.display = 'block';
  els.previewContent.style.display = 'none';

  const tbody = els.tableBody;
  tbody.innerHTML = '';

  autoProjects.forEach((p) => {
    const tr = document.createElement('tr');
    tr.className = 'group-item-row auto-sheet-row' + getTodayHandoverRowClass(p);
    tr.dataset.id = p.id;

    // 根据列定义创建单元格
    AUTO_SHEET_FIELDS.forEach(f => {
      if (f.type === 'checkbox') {
        tr.appendChild(createCheckboxCell(p, f.key, p[f.key]));
      } else if (f.type === 'date') {
        tr.appendChild(createEditableCell(p, f.key, p[f.key], 'date'));
      } else if (f.type === 'select') {
        const opts = f.key === 'orderType' ? ORDER_TYPE_OPTIONS : PLATFORM_OPTIONS;
        tr.appendChild(createSelectCell(p, f.key, p[f.key], opts));
      } else {
        tr.appendChild(createEditableCell(p, f.key, p[f.key]));
      }
    });

    // 来源（可编辑，默认隐藏）
    const tdSource = document.createElement('td');
    tdSource.className = 'source-cell source-col' + (autoSheetSourceVisible ? '' : ' col-hidden');
    const sourceDiv = document.createElement('div');
    sourceDiv.className = 'cell-text';
    sourceDiv.contentEditable = true;
    sourceDiv.textContent = p.sheet || '';
    sourceDiv.addEventListener('focus', () => markActiveCell(tdSource));
    sourceDiv.addEventListener('blur', () => {
      updateProjectField(p.id, 'sheet', sourceDiv.textContent.trim());
    });
    tdSource.appendChild(sourceDiv);
    tr.appendChild(tdSource);

    tbody.appendChild(tr);
  });
}

// 创建复选框单元格（用于 ERP 字段）
function createCheckboxCell(project, field, value) {
  const td = document.createElement('td');
  td.dataset.field = field;
  td.dataset.id = project.id;
  td.className = 'checkbox-cell';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(value);
  checkbox.className = 'erp-checkbox';
  checkbox.title = '勾选表示已处理';
  checkbox.addEventListener('change', () => {
    updateProjectField(project.id, field, checkbox.checked);
  });
  td.appendChild(checkbox);
  return td;
}

function refreshGroupValueFilterOptions(sheetProjects, groupBy) {
  if (!els.groupValueSelect) return;
  const config = GROUP_BY_OPTIONS[groupBy] || GROUP_BY_OPTIONS.name;
  const previousValue = currentGroupValue || '__all__';
  const values = sortGroupKeys(
    Array.from(new Set(sheetProjects.map(p => getProjectGroupKey(p, groupBy)))),
    groupBy
  );

  if (previousValue !== '__all__' && !values.includes(previousValue)) {
    currentGroupValue = '__all__';
  }

  const optionHtml = [
    `<option value="__all__">全部${escapeHtml(config.label)}</option>`,
    ...values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
  ].join('');

  els.groupValueSelect.innerHTML = optionHtml;
  els.groupValueSelect.value = currentGroupValue || '__all__';
  els.groupValueSelect.disabled = values.length === 0;
  els.groupValueSelect.title = values.length
    ? `按${config.label}继续筛选`
    : `当前子表暂无可筛选的${config.label}`;
}

// 全角转半角 + 去除多余空格，统一格式用于模糊匹配
function normalizeForSearch(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)) // 全角转半角
    .replace(/\u3000/g, ' ') // 全角空格转半角
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function projectMatchesKeyword(project, keyword) {
  const normalizedKeyword = normalizeForSearch(keyword);
  if (!normalizedKeyword) return true;
  return TABLE_FIELDS.some(field => normalizeForSearch(project[field]).includes(normalizedKeyword));
}

function getProjectGroupKey(project, groupBy = currentGroupBy) {
  const config = GROUP_BY_OPTIONS[groupBy] || GROUP_BY_OPTIONS.name;
  const value = String(project?.[groupBy] || '').trim();
  if (!value) return config.empty;
  if (groupBy === 'name') {
    const date = normalizeDateValue(project?.date) || String(project?.date || '').trim();
    return date ? `${value}｜${date}` : value;
  }
  if (groupBy === 'date' || groupBy === 'publishDate') {
    return normalizeDateValue(value) || value;
  }
  return value;
}

function getCollapsedGroupKey(groupBy, groupName) {
  return `${groupBy || currentGroupBy}::${groupName}`;
}

function sortGroupKeys(keys, groupBy = currentGroupBy) {
  if (groupBy === 'date' || groupBy === 'publishDate') {
    return keys.sort((a, b) => {
      const aTime = Date.parse(a);
      const bTime = Date.parse(b);
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return bTime - aTime;
      if (!Number.isNaN(aTime)) return -1;
      if (!Number.isNaN(bTime)) return 1;
      return a.localeCompare(b, 'zh');
    });
  }
  return keys.sort((a, b) => a.localeCompare(b, 'zh'));
}

function getProjectsByCurrentGroup(groupName) {
  const groupBy = GROUP_BY_OPTIONS[currentGroupBy] ? currentGroupBy : 'name';
  return projects.filter(p => p.sheet === currentSheet && getProjectGroupKey(p, groupBy) === groupName);
}

// ===== Collapsed groups state =====
const collapsedGroups = new Set();

function toggleGroup(groupName) {
  const collapsedKey = getCollapsedGroupKey(currentGroupBy, groupName);
  if (collapsedGroups.has(collapsedKey)) {
    collapsedGroups.delete(collapsedKey);
  } else {
    collapsedGroups.add(collapsedKey);
  }
  renderProjects();
}

function selectSingleRow(id) {
  selectedAll = false;
  clearCellSelection();
  selectedRows = new Set([id]);
  renderProjects();
  showToast('已选中这一行');
}

function selectProjectGroup(encodedGroupName) {
  selectedAll = false;
  clearCellSelection();
  const groupName = decodeURIComponent(encodedGroupName);
  const ids = getProjectsByCurrentGroup(groupName).map(p => p.id);

  selectedRows = new Set(ids);
  showToast(`已选中${GROUP_BY_OPTIONS[currentGroupBy].label}「${groupName}」共 ${ids.length} 行`);
  renderProjects();
}

// 跟踪 mousedown 位置，区分点击和拖拽
let cellMouseDownInfo = null;

function setupCellInteractions(td) {
  // 不立即设置 draggable，改为长按延时启用，避免与框选冲突
  td.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;

    const info = getCellInfoFromTd(td);
    if (!info) return;

    // 检查点击目标是否在表单控件内
    const isOnSelect = !!e.target.closest('select');
    const isOnEditable = !!e.target.closest('input, [contenteditable="true"]');
    // 仅对 select 元素阻止默认行为：防止原生下拉框打开后捕获鼠标事件，导致无法拖拽框选
    // 对 input/contenteditable 不阻止默认行为，确保它们能正常获得焦点、接受粘贴和输入
    if (isOnSelect) {
      e.preventDefault();
    }
    isSelectingCells = true;
    setCellSelection(info);
    markActiveCell(td);

    // 记录 mousedown 信息，用于 mouseup 时区分点击和拖拽
    cellMouseDownInfo = {
      td,
      info,
      x: e.clientX,
      y: e.clientY,
      didDrag: false,
      isOnControl: !!(isOnSelect || isOnEditable),
      isOnSelect,
      controlEl: isOnSelect || e.target.closest('input, [contenteditable="true"]') || null,
      dragEnableTimer: null
    };

    // 长按 350ms 后才启用 draggable，此时鼠标移动触发拖拽换位
    // 如果用户在 350ms 内移动鼠标，mouseenter 会取消此定时器，优先执行框选
    cellMouseDownInfo.dragEnableTimer = setTimeout(() => {
      if (cellMouseDownInfo && !cellMouseDownInfo.didDrag) {
        td.draggable = true;
      }
    }, 350);
  });

  // select 元素change时如果已框选多个单元格，批量更新
  const selectEl = td.querySelector('select');
  if (selectEl) {
    selectEl.addEventListener('change', () => {
      const range = normalizeCellSelection(cellSelection);
      if (range && getCellSelectionSize() > 1) {
        // 批量更新所有选中的单元格（跨列）
        batchUpdateSelectedCells(td, selectEl.value);
      }
    });
    // 不再阻止 select 的 mousedown 冒泡，让 td 的 mousedown 能启动框选
  }

  // contenteditable blur时如果已框选多个单元格，批量更新
  const editEl = td.querySelector('[contenteditable="true"]');
  if (editEl) {
    editEl.addEventListener('blur', () => {
      const range = normalizeCellSelection(cellSelection);
      if (range && getCellSelectionSize() > 1) {
        batchUpdateSelectedCells(td, editEl.textContent.trim());
      }
    });
    // 不再阻止 contenteditable 的 mousedown 冒泡
  }

  // input 元素也不再阻止冒泡
  const inputEl = td.querySelector('input');
  if (inputEl) {
    // input 的交互保持默认
  }

  td.addEventListener('mouseenter', () => {
    if (!isSelectingCells || !cellSelection) return;
    // 用户正在拖动框选，取消长按拖拽定时器
    if (cellMouseDownInfo && cellMouseDownInfo.dragEnableTimer) {
      clearTimeout(cellMouseDownInfo.dragEnableTimer);
      cellMouseDownInfo.dragEnableTimer = null;
    }
    const info = getCellInfoFromTd(td);
    const startRow = cellSelection.startRow;
    const startCol = cellSelection.startCol;
    setCellSelection({ rowIndex: startRow, cellIndex: startCol }, info);
    // 标记发生了拖拽
    if (cellMouseDownInfo) {
      cellMouseDownInfo.didDrag = true;
    }
  });
  td.addEventListener('dblclick', () => {
    const editable = td.querySelector('[contenteditable], input, select');
    if (!editable) return;
    editable.focus();
    if (editable.tagName === 'INPUT') editable.select();
  });
  td.addEventListener('dragstart', (e) => {
    if (e.target.closest('select, input, textarea, [contenteditable="true"]')) {
      e.preventDefault();
      return;
    }
    const info = getCellInfoFromTd(td);
    if (!info) return;
    if (!cellSelection || !td.classList.contains('cell-selected')) {
      setCellSelection(info);
    }
    draggedSelection = {
      range: normalizeCellSelection(cellSelection),
      matrix: getCellSelectionMatrix()
    };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', getCellSelectionText());
  });
  td.addEventListener('dragover', (e) => {
    if (!draggedSelection) return;
    e.preventDefault();
    td.classList.add('cell-drop-target');
  });
  td.addEventListener('dragleave', () => td.classList.remove('cell-drop-target'));
  td.addEventListener('drop', (e) => {
    if (!draggedSelection) return;
    e.preventDefault();
    td.classList.remove('cell-drop-target');
    moveSelectedCellsTo(getCellInfoFromTd(td));
  });
}

// 批量更新选中的单元格（支持跨列）
function batchUpdateSelectedCells(sourceTd, value) {
  const range = normalizeCellSelection(cellSelection);
  if (!range) return;
  const rows = getVisibleDataRows();
  const sourceField = sourceTd.dataset.field;
  let count = 0;

  rows.forEach((row, rowIndex) => {
    if (rowIndex < range.startRow || rowIndex > range.endRow) return;
    const cells = Array.from(row.querySelectorAll('td[data-field]'));
    cells.forEach((cell, cellIndex) => {
      if (cellIndex < range.startCol || cellIndex > range.endCol) return;
      if (cell === sourceTd) return; // 跳过源单元格（已更新）

      const cellField = cell.dataset.field;
      const projectId = Number(cell.closest('tr').dataset.id);

      // 判断单元格类型，决定是否可以填充该值
      const select = cell.querySelector('select');
      const editDiv = cell.querySelector('[contenteditable="true"]');
      const input = cell.querySelector('input');

      if (select) {
        // 对于 select 单元格：只有当选项中包含该值时才更新
        const hasOption = Array.from(select.options).some(opt => opt.value === value);
        if (!hasOption) return; // 该列不支持此值，跳过

        select.value = value;
        // 状态颜色更新
        if (cellField === 'status') {
          Object.values(STATUS_MAP).forEach(cls => select.classList.remove(cls));
          const newCls = STATUS_MAP[value];
          if (newCls) select.classList.add(newCls);
        }
        updateProjectField(projectId, cellField, value);
        count++;
      } else if (editDiv) {
        // 对于文本单元格：直接填充值
        editDiv.textContent = value;
        updateProjectField(projectId, cellField, value);
        count++;
      } else if (input) {
        // 对于 input 单元格（日期等）：填充值
        input.value = value;
        updateProjectField(projectId, cellField, value);
        count++;
      }
    });
  });

  if (count > 0) {
    showToast(`已批量更新 ${count + 1} 个单元格`);
    saveProjects('批量编辑');
  }
}

// 更新批量编辑栏的显示状态
function updateBatchEditBar() {
  if (!els.batchEditBar) return;
  const size = cellSelection ? getCellSelectionSize() : 0;
  if (size > 1) {
    els.batchEditBar.hidden = false;
    els.batchEditInfo.textContent = `已选中 ${size} 个单元格`;
    els.batchEditInput.value = '';
    // 延迟聚焦输入框
    setTimeout(() => els.batchEditInput?.focus(), 100);
  } else {
    els.batchEditBar.hidden = true;
    els.batchEditInput.value = '';
  }
}

// 执行批量填充
function executeBatchFill() {
  if (!els.batchEditInput) return;
  const value = els.batchEditInput.value.trim();
  if (!value && value !== '') {
    showToast('请输入要填充的值', 'error');
    return;
  }

  const range = normalizeCellSelection(cellSelection);
  if (!range) return;
  const rows = getVisibleDataRows();
  let count = 0;

  rows.forEach((row, rowIndex) => {
    if (rowIndex < range.startRow || rowIndex > range.endRow) return;
    const cells = Array.from(row.querySelectorAll('td[data-field]'));
    cells.forEach((cell, cellIndex) => {
      if (cellIndex < range.startCol || cellIndex > range.endCol) return;

      const cellField = cell.dataset.field;
      const projectId = Number(cell.closest('tr').dataset.id);

      const select = cell.querySelector('select');
      const editDiv = cell.querySelector('[contenteditable="true"]');
      const input = cell.querySelector('input');

      if (select) {
        // 对于 select 单元格：只有当选项中包含该值时才更新
        const hasOption = Array.from(select.options).some(opt => opt.value === value);
        if (!hasOption) return;

        select.value = value;
        if (cellField === 'status') {
          Object.values(STATUS_MAP).forEach(cls => select.classList.remove(cls));
          const newCls = STATUS_MAP[value];
          if (newCls) select.classList.add(newCls);
        }
        updateProjectField(projectId, cellField, value);
        count++;
      } else if (editDiv) {
        editDiv.textContent = value;
        updateProjectField(projectId, cellField, value);
        count++;
      } else if (input) {
        input.value = value;
        updateProjectField(projectId, cellField, value);
        count++;
      }
    });
  });

  if (count > 0) {
    showToast(`已批量填充 ${count} 个单元格`);
    saveProjects('批量填充');
    clearCellSelection();
    updateBatchEditBar();
  } else {
    showToast('没有可填充的单元格', 'error');
  }
}

document.addEventListener('mouseup', (e) => {
  // 清理长按拖拽定时器，重置 draggable
  if (cellMouseDownInfo) {
    if (cellMouseDownInfo.dragEnableTimer) {
      clearTimeout(cellMouseDownInfo.dragEnableTimer);
      cellMouseDownInfo.dragEnableTimer = null;
    }
    if (cellMouseDownInfo.td) {
      cellMouseDownInfo.td.draggable = false;
    }
  }
  if (isSelectingCells) {
    isSelectingCells = false;
    const selectionSize = cellSelection ? getCellSelectionSize() : 0;

    // 如果只是点击（没有拖拽）且只选了一个单元格
    if (cellMouseDownInfo && !cellMouseDownInfo.didDrag && selectionSize === 1) {
      const td = cellMouseDownInfo.td;
      const control = td.querySelector('select, input, [contenteditable="true"]');
      if (control && control.tagName === 'SELECT') {
        // 仅 select 需要手动处理：因 mousedown 时阻止了默认行为（防止下拉框捕获鼠标事件），
        // 需要在确认是单击（非拖拽）后手动聚焦并打开下拉框
        // input/contenteditable 不需要处理，它们已自然获得焦点
        setTimeout(() => {
          control.focus();
          try {
            if (typeof control.showPicker === 'function') {
              control.showPicker();
            }
          } catch(err) {
            // showPicker 不支持时静默失败，用户可再次点击操作
          }
        }, 0);
      }
    } else if (selectionSize > 1) {
      showToast(`已框选 ${selectionSize} 个单元格，可批量编辑`);
    }
    cellMouseDownInfo = null;
  }
});

document.addEventListener('dragend', () => {
  draggedSelection = null;
  document.querySelectorAll('.cell-drop-target').forEach(cell => cell.classList.remove('cell-drop-target'));
  // 拖拽结束后重置所有单元格的 draggable
  document.querySelectorAll('.data-table td[draggable="true"]').forEach(td => td.draggable = false);
});

// 点击表格外部区域时清除单元格选择
document.addEventListener('mousedown', (e) => {
  if (!cellSelection) return;
  const target = e.target;
  // 如果点击的是表格内的单元格，不处理（由 td 的 mousedown 处理）
  if (target.closest('td[data-field]')) return;
  // 如果点击的是批量编辑栏内部，不处理
  if (target.closest('.batch-edit-bar')) return;
  // 如果点击的是弹窗内部，不处理
  if (target.closest('.modal-content')) return;
  // 清除选择
  clearCellSelection();
});

function moveSelectedCellsTo(targetInfo) {
  if (!draggedSelection || !targetInfo) return;
  const sourceRange = draggedSelection.range;
  if (!sourceRange) return;
  if (
    targetInfo.rowIndex >= sourceRange.startRow &&
    targetInfo.rowIndex <= sourceRange.endRow &&
    targetInfo.cellIndex >= sourceRange.startCol &&
    targetInfo.cellIndex <= sourceRange.endCol
  ) {
    return;
  }

  const visibleRows = getVisibleDataRows();
  let changed = 0;
  draggedSelection.matrix.forEach((rowValues, rOffset) => {
    const targetRow = visibleRows[targetInfo.rowIndex + rOffset];
    const targetProject = projects.find(p => p.id === Number(targetRow?.dataset.id));
    if (!targetProject) return;
    rowValues.forEach((value, cOffset) => {
      const field = TABLE_FIELDS[targetInfo.cellIndex + cOffset];
      if (!field) return;
      setProjectField(targetProject, field, value);
      changed++;
    });
  });

  for (let rowIndex = sourceRange.startRow; rowIndex <= sourceRange.endRow; rowIndex++) {
    const sourceProject = projects.find(p => p.id === Number(visibleRows[rowIndex]?.dataset.id));
    if (!sourceProject) continue;
    for (let colIndex = sourceRange.startCol; colIndex <= sourceRange.endCol; colIndex++) {
      const field = TABLE_FIELDS[colIndex];
      setProjectField(sourceProject, field, '');
    }
  }

  clearCellSelection();
  saveProjects(`移动 ${changed} 个单元格`);
  renderProjects();
  showToast(`已移动 ${changed} 个单元格`);
}

// Create a contenteditable cell
function createEditableCell(project, field, value, type) {
  const td = document.createElement('td');
  td.dataset.field = field;
  td.dataset.id = project.id;
  if (type === 'date') {
    const input = document.createElement('input');
    const dateValue = normalizeDateValue(value);
    input.type = dateValue ? 'date' : 'text';
    input.value = dateValue;
    input.placeholder = '';
    input.className = 'cell-input';
    input.addEventListener('change', () => {
      updateProjectField(project.id, field, input.value);
    });
    input.addEventListener('focus', () => {
      markActiveCell(td);
      input.type = 'date';
    });
    input.addEventListener('blur', () => {
      if (!input.value) input.type = 'text';
    });
    td.appendChild(input);
  } else {
    const div = document.createElement('div');
    div.className = 'cell-text';
    div.contentEditable = true;
    // 备注列在表格中截断显示，完整内容在详情弹窗中查看
    if (field === 'remark' && value && value.length > 15) {
      div.textContent = value.substring(0, 15) + '…';
      div.title = value;
      div.dataset.fullValue = value;
    } else {
      div.textContent = value || '';
    }
    div.addEventListener('focus', () => {
      markActiveCell(td);
      // 聚焦时恢复完整内容
      if (div.dataset.fullValue) {
        div.textContent = div.dataset.fullValue;
      }
    });
    div.addEventListener('blur', () => {
      let finalValue = div.textContent.trim();
      // 账号字段：在配置了简称映射的子表自动识别简称并补全为完整账号名（各子表独立映射）
      if (field === 'account' && finalValue) {
        const cellSheet = project.sheet || currentSheet;
        if (isAliasSheet(cellSheet)) {
          const expanded = expandAccountAlias(finalValue, cellSheet);
          if (expanded && expanded !== finalValue) {
            finalValue = expanded;
            div.textContent = expanded;
            showToast(`已匹配完整账号：${expanded}`, 'success');
          }
        }
      }
      updateProjectField(project.id, field, finalValue);
      // 失焦时恢复截断显示
      if (field === 'remark' && finalValue.length > 15) {
        div.dataset.fullValue = finalValue;
        div.title = finalValue;
        div.textContent = finalValue.substring(0, 15) + '…';
      }
    });
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        div.blur();
        // Move focus to next cell
        const nextTd = td.nextElementSibling;
        if (nextTd) {
          const editable = nextTd.querySelector('[contenteditable], input, select');
          if (editable) editable.focus();
        }
      }
    });
    td.appendChild(div);
  }
  // 在子元素添加后再设置单元格交互，确保 querySelector 能找到子元素
  setupCellInteractions(td);
  return td;
}

// Create a select dropdown cell
function createSelectCell(project, field, value, options) {
  const td = document.createElement('td');
  td.dataset.field = field;
  td.dataset.id = project.id;
  const select = document.createElement('select');
  select.className = 'cell-select';
  
  // 状态列添加颜色样式
  if (field === 'status') {
    select.classList.add('status-select');
    const statusClass = STATUS_MAP[value];
    if (statusClass) {
      select.classList.add(statusClass);
    }
  }
  
  // Empty option
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '--';
  select.appendChild(emptyOpt);
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    if (opt === value) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener('change', () => {
    // 状态变化时更新颜色
    if (field === 'status') {
      // 移除旧的状态颜色类
      Object.values(STATUS_MAP).forEach(cls => select.classList.remove(cls));
      // 添加新的状态颜色类
      const newStatusClass = STATUS_MAP[select.value];
      if (newStatusClass) {
        select.classList.add(newStatusClass);
      }
    }
    updateProjectField(project.id, field, select.value);
  });
  select.addEventListener('focus', () => markActiveCell(td));
  td.appendChild(select);
  // 在子元素添加后再设置单元格交互，确保 querySelector 能找到 select
  setupCellInteractions(td);
  return td;
}

// 创建交接标记单元格
function createHandoverCell(project) {
  const td = document.createElement('td');
  td.className = 'handover-cell';
  td.dataset.id = project.id;

  // 只显示今天早班的交接标记
  const todayKey = getShiftDateKey();
  const morningEntry = project.handover
    ? Object.entries(project.handover).find(([key, v]) => key.startsWith(todayKey + '|') && v.shift === 'morning')
    : null;
  if (morningEntry) {
    const [entryKey, v] = morningEntry;
    const mark = document.createElement('span');
    mark.className = 'handover-mark mark-morning handover-mark-cancelable';
    mark.innerHTML = '🌅 <span>早班</span>';
    const time = new Date(v.time);
    const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    const taskInfo = v.taskText ? `\n指令: ${v.taskText}` : '';
    mark.title = `${v.date} 早班 ${timeStr}${taskInfo}\n（点击取消标记）`;
    mark.addEventListener('click', (e) => {
      e.stopPropagation();
      if (project.handover && project.handover[entryKey]) {
        delete project.handover[entryKey];
        if (Object.keys(project.handover).length === 0) {
          delete project.handover;
        }
        saveProjects('取消早班交接标记');
        renderProjects();
        showToast('已取消早班交接标记');
      }
    });
    td.appendChild(mark);
  } else {
    // 未标记，显示可点击按钮
    const btn = document.createElement('button');
    btn.className = 'handover-btn';
    btn.textContent = '—';
    btn.title = '点击标记当前班次交接';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // 单独行标记
      const shift = getCurrentShift();
      const dateKey = getShiftDateKey();
      const handoverKey = `${dateKey}|${shift}`;
      if (!project.handover) project.handover = {};
      project.handover[handoverKey] = {
        shift,
        date: dateKey,
        time: new Date().toISOString(),
        label: getShiftLabel(shift)
      };
      saveProjects(`${getShiftLabel(shift)}交接标记`);
      renderProjects();
      showToast(`已标记 ${getShiftLabel(shift)}交接`);
    });
    td.appendChild(btn);
  }

  return td;
}

// Update a field and save
function updateProjectField(id, field, value) {
  const project = projects.find(p => p.id === id);
  if (!project) return;
  if (project[field] === value) return;
  const oldStatus = project.status;
  project[field] = value;
  if (field === 'link') {
    applyPublishLinkSideEffects(project, value);
  } else {
    applyAutoStatusFlow(project, field);
  }
  const statusChanged = project.status !== oldStatus;
  // 状态变化或自动归纳表格编辑后需要刷新
  if (statusChanged || field === 'link' || AUTO_SHEETS[currentSheet]) {
    renderProjects();
  }
  saveProjects(`编辑字段：${field}`);
  showToast('已保存');
}

// 自动状态流转：根据字段变化自动推进项目进度
function applyAutoStatusFlow(project, changedField) {
  const status = project.status || '';
  const title = String(project.title || '').trim();
  const editor = String(project.editor || '').trim();

  // 标题已填写 + 当前状态为"脚本制作中" → 自动进入"脚本送审"
  if (changedField === 'title' && title && status === '脚本制作中') {
    project.status = '脚本送审';
    showToast('标题已填写，自动进入「脚本送审」', 'success');
    return;
  }

  // 剪辑已填写 + 当前状态为"视频制作中" → 自动进入"视频送审"
  if (changedField === 'editor' && editor && status === '视频制作中') {
    project.status = '视频送审';
    showToast('剪辑已填写，自动进入「视频送审」', 'success');
    return;
  }
}

function applyPublishLinkSideEffects(project, value) {
  const hasPublishLink = isValidPublishLink(value);
  if (!hasPublishLink) {
    project.publishDate = '';
    return;
  }
  if (!project.publishDate) {
    project.publishDate = getTodayDateString();
  }
  // 填写有效发布链接时，自动将项目进度设为"已发布"
  project.status = '已发布';
}

// ===== Add Empty Row =====
function addEmptyRow() {
  // 自动归纳表格不允许手动添加行
  if (AUTO_SHEETS[currentSheet]) {
    showToast('该表格为自动归纳，无需手动添加', 'error');
    return;
  }
  const project = {
    id: Date.now(),
    order: Date.now(),
    sheet: currentSheet,
    date: getTodayDateString(),
    publishDate: '',
    platform: getDefaultPlatform(currentSheet),
    account: '',
    name: '',
    status: '脚本制作中',
    title: '',
    link: '',
    business: '',
    assignee: '',
    editor: '',
    orderType: getDefaultOrderType(currentSheet),
    brandTaskId: '',
    erp: false,
    remark: ''
  };
  projects.push(project);
  saveProjects('新增空行');
  renderProjects();
  showToast('已添加空行');

  // Focus on the first editable cell of the new row
  setTimeout(() => {
    const newRow = els.tableBody.querySelector(`tr[data-id="${project.id}"]`);
    if (newRow) {
      const firstCell = newRow.querySelector('td input, td [contenteditable]');
      if (firstCell) firstCell.focus();
    }
  }, 50);
}

// ===== Delete Project =====
function deleteProject(id) {
  projects = projects.filter(p => p.id !== id);
  saveProjects('删除项目行');
  renderProjects();
  showToast('已删除');
}

// ===== Delete Project Group =====
function deleteProjectGroup(encodedGroupName) {
  const groupName = decodeURIComponent(encodedGroupName);
  const groupLabel = GROUP_BY_OPTIONS[currentGroupBy]?.label || '分组';
  const items = getProjectsByCurrentGroup(groupName);
  if (items.length === 0) return;

  if (!confirm(`确定删除${groupLabel}「${groupName}」下的 ${items.length} 条记录吗？`)) {
    return;
  }

  const ids = new Set(items.map(p => p.id));
  projects = projects.filter(p => !ids.has(p.id));
  collapsedGroups.delete(getCollapsedGroupKey(currentGroupBy, groupName));
  saveProjects(`删除${groupLabel}分组：${groupName}`);
  renderProjects();
  showToast(`已删除${groupLabel}「${groupName}」共 ${items.length} 条记录`);
}

// ===== Switch Sheet =====
function switchSheet(sheetName) {
  currentSheet = sheetName;

  // Update tab styles
  document.querySelectorAll('.sheet-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.sheet === sheetName);
  });

  // 切换表头：自动归纳表格用动态表头，普通表格恢复原始表头
  if (!AUTO_SHEETS[sheetName]) {
    restoreDefaultTableHeader();
  }

  // 自动归纳表格隐藏"添加空行"和"智能录入"按钮
  const btnAddRow = document.getElementById('btn-add-row');
  if (btnAddRow) {
    btnAddRow.style.display = AUTO_SHEETS[sheetName] ? 'none' : '';
  }
  const btnSmartInput = document.getElementById('btn-smart-input');
  if (btnSmartInput) {
    btnSmartInput.style.display = AUTO_SHEETS[sheetName] ? 'none' : '';
  }

  // 切换子表时重置账号快捷筛选
  accountFilterValue = '';
  renderAccountFilterBar();

  renderPrimaryDuty();
  renderProjects();
  renderTasks();
}

// 恢复普通表格的原始表头
function restoreDefaultTableHeader() {
  const thead = document.querySelector('#data-table thead tr');
  if (!thead) return;
  thead.innerHTML = '';
  const headers = [
    { width: '72px', label: '进度', cls: 'th-status' },
    { width: '70px', label: '平台' },
    { width: '130px', label: '项目名字' },
    { width: '85px', label: '接单日期' },
    { width: '80px', label: '发布日期' },
    { width: '70px', label: '下单人' },
    { width: '160px', label: '标题' },
    { width: '85px', label: '订单类型' },
    { width: '85px', label: '品牌任务ID' },
    { width: '100px', label: '账号名' },
    { width: '180px', label: '发布链接' },
    { width: '65px', label: '接单人' },
    { width: '65px', label: '剪辑' },
    { width: '55px', label: '备注' },
    { width: '75px', label: '交接' },
    { width: '65px', label: '详情' },
    { width: '40px', label: '操作' }
  ];
  headers.forEach(h => {
    const th = document.createElement('th');
    th.style.width = h.width;
    if (h.cls) th.className = h.cls;
    th.textContent = h.label;
    thead.appendChild(th);
  });
}

// ===== Save to Local (纯前端 localStorage) =====
async function saveToLocal() {
  if (projects.length === 0) {
    showToast('没有项目可保存', 'error');
    return;
  }

  try {
    const payload = {
      projects: projects,
      summary: {
        total: projects.length,
        bySheet: getCountBySheet(),
        byStatus: getCountByStatus(),
        savedAt: new Date().toISOString()
      }
    };

    localStorage.setItem('table-app-projects', JSON.stringify(projects));
    localStorage.setItem('table-app-projects-backup', JSON.stringify(payload));
    const dateStr = new Date().toLocaleString('zh-CN');
    showToast(`已保存 ${projects.length} 个项目到本地 (${dateStr})`);
  } catch (err) {
    showToast('保存失败：' + err.message, 'error');
    console.error(err);
  }
}

// ===== Generate Feishu Command =====
function generateFeishuCommand() {
  if (projects.length === 0) {
    showToast('没有项目可生成指令', 'error');
    return;
  }

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;

  let cmd = `请将以下项目数据写入飞书表格「2️⃣进度表测试表格」和「商务登记表测试」：\n\n`;
  cmd += `=== 录入时间：${dateStr} ===\n\n`;

  // Group by sheet
  const bySheet = {};
  projects.forEach(p => {
    if (!bySheet[p.sheet]) bySheet[p.sheet] = [];
    bySheet[p.sheet].push(p);
  });

  Object.entries(bySheet).forEach(([sheet, items]) => {
    cmd += `【子表：${sheet}】\n`;
    items.forEach((p, i) => {
      cmd += `  ${i + 1}. ${p.name || '(未命名)'}\n`;
      cmd += `     接单日期：${p.date || '-'} | 发布日期：${p.publishDate || '-'}\n`;
      cmd += `     平台：${p.platform || '-'} | 账号：${p.account || '-'} | 进度：${p.status || '-'}\n`;
      if (p.title) cmd += `     标题：${p.title}\n`;
      if (p.link) cmd += `     链接：${p.link}\n`;
      if (p.business) cmd += `     商务：${p.business}\n`;
      if (p.assignee) cmd += `     接单人：${p.assignee}\n`;
      if (p.editor) cmd += `     剪辑：${p.editor}\n`;
      if (p.orderType) cmd += `     订单类型：${p.orderType}\n`;
      cmd += `\n`;
    });
    cmd += `\n`;
  });

  // Business registry items (published only)
  const published = projects.filter(p => p.status === '已发布');
  if (published.length > 0) {
    cmd += `【商务登记表 - 已发布项目】\n`;
    published.forEach((p, i) => {
      cmd += `  ${i + 1}. ${p.name || '(未命名)'}\n`;
      cmd += `     B列平台：${p.platform || '-'}\n`;
      cmd += `     C列项目名：${p.name || '-'}\n`;
      cmd += `     D列接单日期：${p.date || dateStr}\n`;
      cmd += `     E列发布日期：${p.publishDate || dateStr}\n`;
      cmd += `     F列下单人：${p.business || '-'}\n`;
      cmd += `     G列标题：${p.title || '-'}\n`;
      cmd += `     H列订单类型：${p.orderType || '-'}\n`;
      cmd += `     J列账号名：${p.account || '-'}\n`;
      cmd += `     K列发布链接：${p.link || '-'}\n`;
      cmd += `     L列接单人：${p.assignee || '-'}\n`;
      cmd += `     剪辑：${p.editor || '-'}\n`;
      cmd += `\n`;
    });
  }

  cmd += `\n请按以上信息写入飞书表格。进度表写入对应子表，已发布项目同时追加到商务登记表（以发布链接去重）。\n`;

  els.feishuCommand.value = cmd;
  els.modalFeishu.classList.add('show');
}

// ===== Copy Command =====
async function copyCommand() {
  try {
    await navigator.clipboard.writeText(els.feishuCommand.value);
    showToast('指令已复制到剪贴板');
  } catch (err) {
    els.feishuCommand.select();
    document.execCommand('copy');
    showToast('指令已复制到剪贴板');
  }
}

// ===== Close Modal =====
function closeModal() {
  els.modalFeishu.classList.remove('show');
}

function closeHistoryModal() {
  els.modalHistory?.classList.remove('show');
}

function loadOperationHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    operationHistory = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(operationHistory)) operationHistory = [];
  } catch (e) {
    operationHistory = [];
  }
}

function saveOperationHistory() {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(operationHistory.slice(-300)));
}

function cloneProjectsSnapshot() {
  return JSON.parse(JSON.stringify(projects || []));
}

function recordOperationHistory(action = '更新项目表') {
  const now = new Date();
  const record = {
    id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    date: getTodayDateString(now),
    time: now.toLocaleTimeString('zh-CN', { hour12: false }),
    action,
    sheet: currentSheet,
    total: projects.length,
    projects: cloneProjectsSnapshot()
  };
  operationHistory.push(record);
  saveOperationHistory();
}

function openHistoryModal(dateStr = getTodayDateString()) {
  const selectedDate = normalizeDateValue(dateStr) || getTodayDateString();
  if (els.historyDate) els.historyDate.value = selectedDate;
  const records = operationHistory.filter(r => r.date === selectedDate);
  const latest = records[records.length - 1];
  const snapshot = latest?.projects || [];
  const sheetProjects = snapshot.filter(p => p.sheet === currentSheet);
  const statusCounts = {};
  sheetProjects.forEach(p => {
    const key = p.status || '未填写进度';
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  });

  els.historyTitle.textContent = `📅 ${selectedDate} 历史记录`;
  els.historySummary.innerHTML = `
    <span>当前子表：${escapeHtml(currentSheet)}</span>
    <span>操作记录：${records.length} 条</span>
    <span>项目快照：${sheetProjects.length} 条</span>
    <span>最后记录：${latest ? escapeHtml(latest.time) : '无'}</span>
  `;

  const operationsHtml = records.length
    ? records.slice().reverse().map(r => `
      <div class="history-item">
        <span class="history-time">${escapeHtml(r.time)}</span>
        <span>${escapeHtml(r.action)}</span>
        <div class="history-project-meta">子表：${escapeHtml(r.sheet || '-')}｜总项目：${r.total || 0}</div>
      </div>
    `).join('')
    : '<div class="history-empty">这一天暂无操作记录</div>';

  const projectsHtml = sheetProjects.length
    ? sheetProjects.map((p, i) => `
      <div class="history-item">
        <div class="history-project-title">${i + 1}. ${escapeHtml(p.name || '(未命名项目)')}</div>
        <div class="history-project-meta">
          进度：${escapeHtml(p.status || '-')}｜平台：${escapeHtml(p.platform || '-')}｜账号：${escapeHtml(p.account || '-')}
        </div>
        <div class="history-project-meta">
          接单日期：${escapeHtml(p.date || '-')}｜发布日期：${escapeHtml(p.publishDate || '-')}｜接单人：${escapeHtml(p.assignee || '-')}
        </div>
      </div>
    `).join('')
    : '<div class="history-empty">该日期没有当前子表的项目快照</div>';

  els.historyContent.innerHTML = `
    <div class="history-section">
      <div class="history-section-title">操作记录</div>
      <div class="history-list">${operationsHtml}</div>
    </div>
    <div class="history-section">
      <div class="history-section-title">当天项目进度</div>
      <div class="history-list">${projectsHtml}</div>
    </div>
  `;
  els.modalHistory?.classList.add('show');
}

// ===== Shared Data Storage =====
let syncTimer = null;
let isSyncing = false;

function saveProjects(action = '更新项目表') {
  // 保存到撤销栈（限制50条）
  undoStack.push(JSON.stringify(projects));
  if (undoStack.length > 50) undoStack.shift();

  localStorage.setItem('table-app-projects-backup', JSON.stringify(projects));
  recordOperationHistory(action);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncProjectsToServer, 250);
}

function undoLastAction() {
  if (undoStack.length === 0) {
    showToast('没有可撤销的操作', 'info');
    return false;
  }
  const lastState = undoStack.pop();
  try {
    projects = JSON.parse(lastState);
    // 同步到本地存储
    localStorage.setItem('table-app-projects-backup', JSON.stringify(projects));
    // 重新渲染
    renderProjects();
    renderOrderStatistics();
    // 清除单元格选择
    clearCellSelection();
    showToast('✅ 已撤销上一步操作');
    return true;
  } catch (err) {
    console.error('撤销失败：', err);
    showToast('撤销失败', 'error');
    return false;
  }
}

async function syncProjectsToServer() {
  // 纯前端模式：直接写入localStorage
  if (isSyncing) return;
  isSyncing = true;
  try {
    localStorage.setItem('table-app-projects', JSON.stringify(projects));
  } catch (err) {
    console.error('本地保存失败：', err);
    showToast('本地保存失败', 'error');
  } finally {
    isSyncing = false;
  }
}

async function loadProjects() {
  // 纯前端模式：从localStorage读取
  try {
    const raw = localStorage.getItem('table-app-projects');
    if (raw) {
      projects = JSON.parse(raw);
    }
    if (projects.length === 0) {
      migrateLocalBackupIfNeeded();
    }
    // 迁移旧状态值到新状态值
    const migrated = migrateOldStatuses(projects);
    if (migrated > 0) {
      saveProjects(`自动迁移 ${migrated} 条旧状态数据`);
      showToast(`已迁移 ${migrated} 条旧状态数据`);
    }
    // 迁移字节单/小红书子表默认订单类型
    const otMigrated = migrateOrderTypes(projects);
    if (otMigrated > 0) {
      saveProjects(`自动补充 ${otMigrated} 条订单类型`);
    }
    if (projects.length > 0) {
      showToast(`已加载本地数据：${projects.length} 条`);
    }
    return;
  } catch (err) {
    console.error('读取本地数据失败：', err);
    migrateLocalBackupIfNeeded();
    migrateOldStatuses(projects);
    migrateOrderTypes(projects);
    showToast('本地数据读取失败', 'error');
  }
}

// 旧状态值 → 新状态值 映射表
const STATUS_MIGRATION_MAP = {
  '脚本审核': '脚本送审',
  '视频审核': '视频送审',
  '大纲': '脚本制作中'
};

function migrateOldStatuses(projectList) {
  let count = 0;
  projectList.forEach(p => {
    const oldStatus = p.status;
    if (oldStatus && STATUS_MIGRATION_MAP[oldStatus]) {
      p.status = STATUS_MIGRATION_MAP[oldStatus];
      count++;
    }
  });
  return count;
}

// 为字节单/小红书子表中缺少订单类型的项目补充默认值
function migrateOrderTypes(projectList) {
  let count = 0;
  projectList.forEach(p => {
    const defaultOT = getDefaultOrderType(p.sheet);
    if (defaultOT && (!p.orderType || p.orderType.trim() === '')) {
      p.orderType = defaultOT;
      count++;
    }
  });
  return count;
}

function migrateLocalBackupIfNeeded() {
  try {
    const oldData = localStorage.getItem('table-app-projects') || localStorage.getItem('table-app-projects-backup');
    if (oldData) {
      projects = JSON.parse(oldData);
      if (projects.length > 0) {
        syncProjectsToServer();
      }
    }
  } catch (e) {
    projects = [];
  }
}

async function loadProjectDetails() {
  // 纯前端模式：从localStorage读取
  try {
    const raw = localStorage.getItem(PROJECT_DETAILS_STORAGE_KEY);
    projectDetails = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('读取项目详情失败：', err);
    projectDetails = {};
  }
}

async function saveProjectDetails(action = '保存项目详情') {
  localStorage.setItem(PROJECT_DETAILS_STORAGE_KEY, JSON.stringify(projectDetails));
  recordOperationHistory(action);
}

function getProjectDetailKey(project) {
  if (!project) return '';
  const sheet = String(project.sheet || currentSheet || '').trim();
  const name = String(project.name || '(未命名项目)').trim();
  const date = normalizeDateValue(project.date) || String(project.date || '').trim();
  return [sheet, name, date].join('::');
}

function getProjectsByDetailKey(key) {
  return projects.filter(p => getProjectDetailKey(p) === key);
}

function createAccountDetail(project) {
  return {
    account: project?.account || '',
    editor: project?.editor || '',
    status: project?.status || '',
    packageFiles: [],
    projectFiles: [],
    projectFileLink: '',
    publishCopy: '',
    remark: project?.remark || ''
  };
}

function syncProjectDetailAccounts(detail, rows) {
  if (!detail.accounts) detail.accounts = {};
  rows.forEach((p, index) => {
    const accountKey = String(p.account || `账号${index + 1}`).trim();
    if (!detail.accounts[accountKey]) {
      detail.accounts[accountKey] = createAccountDetail(p);
    }
    detail.accounts[accountKey].account = p.account || accountKey;
    if (!detail.accounts[accountKey].editor && p.editor) detail.accounts[accountKey].editor = p.editor;
    if (!detail.accounts[accountKey].status && p.status) detail.accounts[accountKey].status = p.status;
  });
}

function ensureProjectDetail(project) {
  const key = getProjectDetailKey(project);
  if (!key) return null;
  const rows = getProjectsByDetailKey(key);
  if (!projectDetails[key]) {
    projectDetails[key] = {
      key,
      sheet: project.sheet || currentSheet,
      name: project.name || '',
      date: normalizeDateValue(project.date) || project.date || '',
      orderInfo: '',
      referenceLink: '',
      referenceNote: '',
      accounts: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  const detail = projectDetails[key];
  detail.key = key;
  detail.sheet = project.sheet || detail.sheet || currentSheet;
  detail.name = project.name || detail.name || '';
  detail.date = normalizeDateValue(project.date) || project.date || detail.date || '';
  syncProjectDetailAccounts(detail, rows.length ? rows : [project]);
  return detail;
}

function openProjectDetail(id, skipUrlUpdate = false) {
  const project = projects.find(p => p.id === id);
  if (!project) return;
  const detail = ensureProjectDetail(project);
  activeProjectDetailKey = detail.key;
  renderProjectDetailModal();
  els.modalProjectDetail?.classList.add('show');
  if (!skipUrlUpdate) {
    updateProjectDetailUrl(detail.key);
  }
}

function closeProjectDetailModal() {
  els.modalProjectDetail?.classList.remove('show');
  activeProjectDetailKey = '';
}

function getProjectDetailUrl(key) {
  const url = new URL(window.location.href);
  url.searchParams.set('detail', key);
  return url.toString();
}

function updateProjectDetailUrl(key) {
  const url = new URL(window.location.href);
  url.searchParams.set('detail', key);
  window.history.replaceState(null, '', url.toString());
}

function openProjectDetailFromUrl() {
  const key = new URLSearchParams(window.location.search).get('detail');
  if (!key) return;
  // 同一会话中只自动打开一次，防止刷新重复弹出
  if (sessionStorage.getItem('detail_auto_opened')) {
    // 已打开过，直接清除参数
    const url = new URL(window.location.href);
    url.searchParams.delete('detail');
    history.replaceState(null, '', url.toString());
    return;
  }
  const row = projects.find(p => getProjectDetailKey(p) === key);
  if (row) {
    openProjectDetail(row.id, true);
    sessionStorage.setItem('detail_auto_opened', '1');
  }
  // 打开后清除URL参数，避免刷新时重复打开
  const url = new URL(window.location.href);
  url.searchParams.delete('detail');
  history.replaceState(null, '', url.toString());
}

async function copyCurrentProjectDetailLink() {
  if (!activeProjectDetailKey) return;
  const url = getProjectDetailUrl(activeProjectDetailKey);
  try {
    await navigator.clipboard.writeText(url);
    showToast('已复制项目详情链接');
  } catch (err) {
    showToast('复制失败，请手动复制地址栏链接', 'error');
  }
}

function extractReferenceLinksFromOrderInfo(text) {
  const source = String(text || '').trim();
  if (!source) return '';
  const lines = source.split(/\r?\n/);
  const items = [];
  const seen = new Set();
  const urlRegex = /(?:https?:\/\/|www\.)[^\s，,。；;）)】\]]+/ig;

  const pushItem = (name, url, context = '') => {
    const cleanUrl = normalizeExtractedUrl(url);
    if (!cleanUrl || seen.has(cleanUrl)) return;
    seen.add(cleanUrl);
    const code = extractPanCode(context);
    const cleanName = normalizeReferenceName(name, cleanUrl) || guessReferenceName(cleanUrl);
    items.push(code ? `${cleanName}：${cleanUrl} 提取码：${code}` : `${cleanName}：${cleanUrl}`);
  };

  lines.forEach((line, index) => {
    const rawLine = String(line || '').trim();
    if (!rawLine) return;
    const context = [rawLine, lines[index + 1] || '', lines[index + 2] || ''].join(' ');

    const markdownRegex = /\[([^\]]+)\]\(((?:https?:\/\/|www\.)[^)\s]+)\)/ig;
    let markdownMatch;
    while ((markdownMatch = markdownRegex.exec(rawLine))) {
      pushItem(markdownMatch[1], markdownMatch[2], context);
    }

    const bracketMatch = rawLine.match(/^(?:【([^】]+)】|\[([^\]]+)\])\s*(.*)$/);
    const bracketName = bracketMatch ? (bracketMatch[1] || bracketMatch[2] || '').trim() : '';
    const previousName = findPreviousReferenceName(lines, index);

    let urlMatch;
    while ((urlMatch = urlRegex.exec(rawLine))) {
      const url = urlMatch[0];
      const beforeUrl = rawLine.slice(0, urlMatch.index);
      const inlineName = extractInlineReferenceName(beforeUrl);
      pushItem(bracketName || inlineName || previousName, url, context);
    }
  });

  return items.join('\n');
}

function normalizeExtractedUrl(url) {
  return String(url || '')
    .trim()
    .replace(/[，,。；;）)】\]]+$/g, '')
    .replace(/^www\./i, 'https://www.');
}

function normalizeReferenceName(name, url) {
  const cleaned = String(name || '')
    .replace(/[【】\[\]]/g, '')
    .replace(/^(链接|网址|地址|url|URL)[:：\s]*/g, '')
    .replace(String(url || ''), '')
    .trim();
  if (/^(链接|网址|地址|url|URL|见|如下|点击|打开)$/i.test(cleaned)) return '';
  return cleaned.slice(0, 40);
}

function extractInlineReferenceName(beforeUrl) {
  const text = String(beforeUrl || '')
    .replace(/链接[:：]?\s*$/i, '')
    .replace(/网址[:：]?\s*$/i, '')
    .replace(/地址[:：]?\s*$/i, '')
    .replace(/[：:\s]+$/g, '')
    .trim();
  const parts = text.split(/[，,。；;|｜]/).map(s => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function findPreviousReferenceName(lines, currentIndex) {
  for (let i = currentIndex - 1; i >= 0 && i >= currentIndex - 2; i--) {
    const candidate = String(lines[i] || '').trim();
    if (!candidate || /(?:https?:\/\/|www\.)/i.test(candidate)) continue;
    if (/^(链接|提取码|密码)[:：]/.test(candidate)) continue;
    const bracketMatch = candidate.match(/^(?:【([^】]+)】|\[([^\]]+)\])\s*(.*)$/);
    if (bracketMatch) return (bracketMatch[1] || bracketMatch[2] || '').trim();
    return candidate.replace(/^#+\s*/, '').trim();
  }
  return '';
}

function extractPanCode(context) {
  const match = String(context || '').match(/(?:提取码|提取碼|密码|密碼)[:：\s]*([A-Za-z0-9]{3,8})/i);
  return match ? match[1] : '';
}

function guessReferenceName(url) {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('pan.baidu.com')) return '百度网盘';
  if (lower.includes('docs.qingque.cn')) return '青雀文档';
  if (lower.includes('feishu.cn') || lower.includes('larksuite.com')) return '飞书文档';
  if (lower.includes('doc') || lower.includes('docs')) return '项目文档';
  return '项目资料链接';
}

function mergeReferenceLinks(existing, extracted) {
  const existingLines = String(existing || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const extractedLines = String(extracted || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const seen = new Set(existingLines.map(line => {
    const url = line.match(/(?:https?:\/\/|www\.)[^\s，,。；;）)】\]]+/i);
    return url ? normalizeExtractedUrl(url[0]) : line;
  }));
  const merged = [...existingLines];
  extractedLines.forEach(line => {
    const url = line.match(/(?:https?:\/\/|www\.)[^\s，,。；;）)】\]]+/i);
    const key = url ? normalizeExtractedUrl(url[0]) : line;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(line);
    }
  });
  return merged.join('\n');
}

function renderProjectDetailModal() {
  const detail = projectDetails[activeProjectDetailKey];
  if (!detail) return;
  const rows = getProjectsByDetailKey(activeProjectDetailKey);
  const accountCount = Object.keys(detail.accounts || {}).length;
  els.projectDetailTitle.textContent = `📁 项目详情：${detail.name || '(未命名项目)'}`;
  els.projectDetailSummary.innerHTML = `
    <div class="detail-summary-item"><span>子表</span><strong>${escapeHtml(detail.sheet || '-')}</strong></div>
    <div class="detail-summary-item"><span>接单日期</span><strong>${escapeHtml(detail.date || '-')}</strong></div>
    <div class="detail-summary-item"><span>账号数量</span><strong>${accountCount}</strong></div>
    <div class="detail-summary-item"><span>详情编号</span><strong>${escapeHtml(activeProjectDetailKey)}</strong></div>
  `;
  els.detailOrderInfo.value = detail.orderInfo || '';
  detail.referenceLink = mergeReferenceLinks(detail.referenceLink, extractReferenceLinksFromOrderInfo(detail.orderInfo));
  els.detailReferenceLink.value = detail.referenceLink || '';
  els.detailReferenceNote.value = detail.referenceNote || '';

  const accountEntries = Object.entries(detail.accounts || {});

  // 检查哪些账号需要终版视频提醒
  const reminderAccounts = accountEntries.filter(([accountKey, accountDetail]) => {
    // 找到该账号对应的项目行
    const projectRow = rows.find(r => String(r.account || '').trim() === accountKey) || rows[0];
    if (!projectRow) return false;
    // 临时设置 account 属性以匹配 needsVideoFileReminder 的检查逻辑
    const tempProject = { ...projectRow, account: accountKey };
    return needsVideoFileReminder(tempProject);
  });
  const hasReminder = reminderAccounts.length > 0;

  // 如果有提醒，在详情面板顶部插入提醒横幅
  let reminderBanner = document.getElementById('video-reminder-banner');
  if (hasReminder) {
    if (!reminderBanner) {
      reminderBanner = document.createElement('div');
      reminderBanner.id = 'video-reminder-banner';
      reminderBanner.className = 'video-reminder-banner';
      els.detailAccountList.parentNode.insertBefore(reminderBanner, els.detailAccountList);
    }
    const accountNames = reminderAccounts.map(([k]) => escapeHtml(k)).join('、');
    reminderBanner.innerHTML = `<span class="reminder-icon">⚠️</span> <strong>终版视频待填写</strong>：以下账号需填写压缩包和工程文件 — ${accountNames}`;
  } else if (reminderBanner) {
    reminderBanner.remove();
  }

  els.detailAccountList.innerHTML = accountEntries.length
    ? accountEntries.map(([accountKey, accountDetail]) => {
        const cardHtml = renderAccountDetailCard(accountKey, accountDetail);
        // 为需要提醒的账号卡片添加高亮标记
        if (reminderAccounts.some(([k]) => k === accountKey)) {
          return cardHtml.replace('class="detail-account-card', 'class="detail-account-card account-needs-video');
        }
        return cardHtml;
      }).join('')
    : '<div class="detail-empty">当前项目还没有账号，请先在项目表中填写账号。</div>';

  // 绑定状态下拉框颜色变化事件
  els.detailAccountList.querySelectorAll('.detail-status-select').forEach(sel => {
    sel.addEventListener('change', () => {
      Object.values(STATUS_MAP).forEach(cls => sel.classList.remove(cls));
      const newCls = STATUS_MAP[sel.value];
      if (newCls) sel.classList.add(newCls);
    });
  });
}

function renderAccountDetailCard(accountKey, accountDetail) {
  const safeKey = escapeHtml(accountKey);
  const encodedKey = encodeURIComponent(accountKey);
  const statusValue = accountDetail.status || '';
  const statusClass = STATUS_MAP[statusValue] || '';
  return `
    <div class="detail-account-card" data-account-key="${encodedKey}">
      <div class="detail-account-head">
        <strong>${escapeHtml(accountDetail.account || accountKey)}</strong>
        <span>${getDetailFileCount(accountDetail)} 个文件/链接</span>
      </div>
      <div class="detail-account-grid">
        <label>剪辑<input class="detail-input" data-detail-field="editor" value="${escapeHtml(accountDetail.editor || '')}" placeholder="剪辑负责人"></label>
        <label>项目进度
          <select class="detail-input detail-status-select ${statusClass}" data-detail-field="status">
            <option value="">--</option>
            ${STATUS_OPTIONS.map(opt => `<option value="${escapeHtml(opt)}" ${opt === statusValue ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
          </select>
        </label>
        <label>发布文案<textarea class="detail-textarea detail-textarea-sm" data-detail-field="publishCopy" placeholder="发布文案 / 口播文案">${escapeHtml(accountDetail.publishCopy || '')}</textarea></label>
        <label>备注<textarea class="detail-textarea detail-textarea-sm" data-detail-field="remark" placeholder="该账号备注">${escapeHtml(accountDetail.remark || '')}</textarea></label>
      </div>
      <div class="detail-file-columns">
        ${renderProjectFileLinkBox(accountKey, accountDetail)}
        ${renderDetailFileBox(accountKey, 'packageFiles', '压缩包文件', '')}
      </div>
    </div>
  `;
}

function renderProjectFileLinkBox(accountKey, accountDetail) {
  const oldProjectFiles = Array.isArray(accountDetail.projectFiles) ? accountDetail.projectFiles : [];
  return `
    <div class="detail-file-box detail-link-box">
      <div class="detail-file-title">视频工程文件</div>
      <textarea class="detail-textarea detail-textarea-sm" data-detail-field="projectFileLink" placeholder="粘贴百度网盘链接、提取码或工程文件说明">${escapeHtml(accountDetail.projectFileLink || '')}</textarea>
      ${oldProjectFiles.length ? `
        <div class="detail-file-subtitle">历史上传文件</div>
        <div class="detail-file-list">
          ${oldProjectFiles.map(file => `
            <div class="detail-file-item">
              <a href="${escapeHtml(file.url || '#')}" target="_blank">${escapeHtml(getDisplayFileName(file))}</a>
              <span>${formatFileSize(file.size)}</span>
              <button type="button" onclick="removeDetailFile('${encodeURIComponent(accountKey)}', 'projectFiles', '${encodeURIComponent(file.id || '')}')">删除</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderDetailFileBox(accountKey, type, label, accept) {
  const files = projectDetails[activeProjectDetailKey]?.accounts?.[accountKey]?.[type] || [];
  const encodedKey = encodeURIComponent(accountKey);
  const inputId = `detail-file-${type}-${encodedKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  return `
    <div class="detail-file-box">
      <div class="detail-file-title">${escapeHtml(label)}</div>
      <div class="detail-drop-zone"
        onclick="document.getElementById('${inputId}')?.click()"
        ondragover="handleDetailDragOver(event)"
        ondragleave="handleDetailDragLeave(event)"
        ondrop="uploadDroppedDetailFiles(event, '${encodedKey}', '${type}')">
        <div class="detail-drop-icon">📦</div>
        <div class="detail-drop-title">拖拽文件到这里上传</div>
        <div class="detail-drop-hint">也可以点击选择，支持同时上传多个文件</div>
      </div>
      <input id="${inputId}" class="detail-hidden-file-input" type="file" ${accept ? `accept="${accept}"` : ''} multiple onchange="uploadDetailFiles(event, '${encodedKey}', '${type}')">
      <div class="detail-file-list">
        ${files.length ? files.map(file => `
          <div class="detail-file-item">
            <a href="${escapeHtml(file.url || '#')}" target="_blank">${escapeHtml(getDisplayFileName(file))}</a>
            <span>${formatFileSize(file.size)}</span>
            <button type="button" onclick="removeDetailFile('${encodedKey}', '${type}', '${encodeURIComponent(file.id || '')}')">删除</button>
          </div>
        `).join('') : '<div class="detail-file-empty">暂无文件</div>'}
      </div>
    </div>
  `;
}

function collectCurrentDetailForm() {
  const detail = projectDetails[activeProjectDetailKey];
  if (!detail) return null;
  detail.orderInfo = els.detailOrderInfo.value.trim();
  detail.referenceLink = mergeReferenceLinks(
    els.detailReferenceLink.value.trim(),
    extractReferenceLinksFromOrderInfo(detail.orderInfo)
  );
  els.detailReferenceLink.value = detail.referenceLink;
  detail.referenceNote = els.detailReferenceNote.value.trim();
  els.detailAccountList.querySelectorAll('.detail-account-card').forEach(card => {
    const accountKey = decodeURIComponent(card.dataset.accountKey || '');
    const account = detail.accounts?.[accountKey];
    if (!account) return;
    card.querySelectorAll('[data-detail-field]').forEach(input => {
      account[input.dataset.detailField] = input.value.trim();
    });
  });
  detail.updatedAt = new Date().toISOString();
  return detail;
}

async function saveCurrentProjectDetailFromModal() {
  const detail = collectCurrentDetailForm();
  if (!detail) return;
  await saveProjectDetails('保存项目详情');
  showToast('项目详情已保存');
}

async function uploadDetailFiles(event, encodedAccountKey, type) {
  const input = event.target;
  const accountKey = decodeURIComponent(encodedAccountKey || '');
  const files = Array.from(input.files || []);
  await uploadDetailFileList(files, accountKey, type);
  input.value = '';
}

async function uploadDroppedDetailFiles(event, encodedAccountKey, type) {
  event.preventDefault();
  event.stopPropagation();
  const dropZone = event.currentTarget;
  dropZone?.classList.remove('drag-over');
  const accountKey = decodeURIComponent(encodedAccountKey || '');
  const files = Array.from(event.dataTransfer?.files || []);
  await uploadDetailFileList(files, accountKey, type);
}

function handleDetailDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget?.classList.add('drag-over');
}

function handleDetailDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget?.classList.remove('drag-over');
}

async function uploadDetailFileList(files, accountKey, type) {
  if (!files.length || !activeProjectDetailKey) return;
  collectCurrentDetailForm();
  const account = projectDetails[activeProjectDetailKey]?.accounts?.[accountKey];
  if (!account) return;
  if (!Array.isArray(account[type])) account[type] = [];

  for (const file of files) {
    try {
      // 纯前端模式：用 FileReader 将文件转为 base64 存入 localStorage
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, size: file.size, type: file.type, data: reader.result });
        reader.onerror = () => reject(new Error('文件读取失败'));
        // 超过5MB的文件不存base64，只存文件信息
        if (file.size > 5 * 1024 * 1024) {
          resolve({ name: file.name, size: file.size, type: file.type, data: null, tooLarge: true });
        } else {
          reader.readAsDataURL(file);
        }
      });
      fileData.name = getDisplayFileName(fileData);
      account[type].push(fileData);
    } catch (err) {
      console.error('上传文件失败：', err);
      showToast(`上传失败：${file.name}`, 'error');
    }
  }

  projectDetails[activeProjectDetailKey].updatedAt = new Date().toISOString();
  await saveProjectDetails('上传项目文件');
  renderProjectDetailModal();
  showToast(`已上传 ${files.length} 个文件`);
}

function removeDetailFile(encodedAccountKey, type, encodedFileId) {
  const accountKey = decodeURIComponent(encodedAccountKey || '');
  const fileId = decodeURIComponent(encodedFileId || '');
  const account = projectDetails[activeProjectDetailKey]?.accounts?.[accountKey];
  if (!account || !Array.isArray(account[type])) return;
  account[type] = account[type].filter(file => file.id !== fileId);
  saveProjectDetails('删除项目文件记录');
  renderProjectDetailModal();
  showToast('已删除文件记录');
}

function getDetailFileCount(accountDetail) {
  const fileCount = ['projectFiles', 'packageFiles'].reduce((sum, type) => sum + (accountDetail?.[type]?.length || 0), 0);
  return fileCount + (String(accountDetail?.projectFileLink || '').trim() ? 1 : 0);
}

function formatFileSize(size) {
  const bytes = Number(size || 0);
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

function getDisplayFileName(file) {
  const name = String(file?.name || file?.originalName || '').trim();
  if (!name) return '未命名文件';
  return fixMojibakeFileName(name);
}

function fixMojibakeFileName(name) {
  const source = String(name || '');
  if (!/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ‰€ŒœŠšŸŽž™“”‘’–—]/.test(source)) {
    return source;
  }
  try {
    const bytes = new Uint8Array(toWindows1252Bytes(source));
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (decoded && !decoded.includes('�')) return decoded;
  } catch (e) {
    // 解码失败则返回原文件名
  }
  return source;
}

function toWindows1252Bytes(text) {
  const cp1252 = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F
  };
  return Array.from(String(text || ''), ch => {
    const code = ch.charCodeAt(0);
    return cp1252[code] ?? (code & 0xff);
  });
}

// ===== Helpers =====
function getCountBySheet() {
  const counts = {};
  projects.forEach(p => {
    counts[p.sheet] = (counts[p.sheet] || 0) + 1;
  });
  return counts;
}

function getCountByStatus() {
  const counts = {};
  projects.forEach(p => {
    counts[p.status] = (counts[p.status] || 0) + 1;
  });
  return counts;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  els.toast.textContent = message;
  els.toast.className = 'toast show toast-' + type;
  setTimeout(() => {
    els.toast.classList.remove('show');
  }, 2500);
}

function getTodayDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ===== 排班交接功能 =====
// 早班: 8:30 - 16:30, 晚班: 16:30 - 00:30
function getCurrentShift(date = new Date()) {
  const h = date.getHours();
  const m = date.getMinutes();
  const minutes = h * 60 + m;
  const morningStart = 8 * 60 + 30;  // 8:30
  const morningEnd = 16 * 60 + 30;   // 16:30
  // 晚班 16:30 - 00:30（次日）
  if (minutes >= morningStart && minutes < morningEnd) {
    return 'morning';
  }
  // 晚班：16:30-23:59 或 00:00-00:30
  if ((minutes >= morningEnd && minutes < 24 * 60) || minutes < 30) {
    return 'evening';
  }
  // 00:30 - 8:30 之间算早班（无人值守时段默认归早班）
  return 'morning';
}

function getShiftLabel(shift) {
  return shift === 'evening' ? '晚班 16:30-00:30' : '早班 8:30-16:30';
}

function getShiftShortLabel(shift) {
  return shift === 'evening' ? '晚班' : '早班';
}

function getShiftIcon(shift) {
  return shift === 'evening' ? '🌙' : '🌅';
}

function getShiftDateKey(date = new Date()) {
  // 晚班跨日：0:00-0:30 仍算前一天的晚班
  const d = new Date(date);
  const shift = getCurrentShift(d);
  if (shift === 'evening' && d.getHours() < 12) {
    // 凌晨时段，日期回退一天
    d.setDate(d.getDate() - 1);
  }
  return getTodayDateString(d);
}

// 获取交接标记 key（日期+班次）
function getHandoverKey(date = new Date()) {
  return `${getShiftDateKey(date)}|${getCurrentShift(date)}`;
}

// 初始化班次显示
function initShiftBadge() {
  const updateBadge = () => {
    const shift = getCurrentShift();
    const badge = document.getElementById('shift-badge');
    if (!badge) return;
    badge.textContent = `${getShiftIcon(shift)} ${getShiftLabel(shift)}`;
    badge.className = `shift-badge shift-${shift}`;
    badge.title = `当前班次：${getShiftLabel(shift)}（点击标记选中行为当前班次交接）`;
    badge.onclick = () => {
      markCurrentShiftHandover();
    };
  };
  updateBadge();
  // 每分钟检查一次班次是否变化
  setInterval(updateBadge, 60000);
}

// 手动标记当前班次交接
function markCurrentShiftHandover() {
  const shift = getCurrentShift();
  const shiftLabel = getShiftLabel(shift);
  const dateKey = getShiftDateKey();
  const handoverKey = `${dateKey}|${shift}`;

  // 找到当前子表中选中行，或提示选择
  const selectedIds = selectedRows;
  if (selectedIds.length === 0) {
    showToast(`请先选中要标记${shiftLabel}交接的行`, 'error');
    return;
  }

  let count = 0;
  selectedIds.forEach(id => {
    const p = projects.find(p => p.id === id);
    if (p) {
      if (!p.handover) p.handover = {};
      p.handover[handoverKey] = {
        shift,
        date: dateKey,
        time: new Date().toISOString(),
        label: shiftLabel
      };
      count++;
    }
  });

  if (count > 0) {
    saveProjects(`${shiftLabel}交接标记 ${count} 个项目`);
    renderProjects();
    showToast(`已标记 ${count} 个项目为${shiftLabel}交接`);
  }
}

// 获取项目的交接标记摘要
function getHandoverSummary(project) {
  if (!project.handover) return null;
  const entries = Object.entries(project.handover);
  if (entries.length === 0) return null;

  // 按日期排序
  entries.sort((a, b) => {
    const [dateA] = a[0].split('|');
    const [dateB] = b[0].split('|');
    return dateA.localeCompare(dateB);
  });

  const hasMorning = entries.some(([, v]) => v.shift === 'morning');
  const hasEvening = entries.some(([, v]) => v.shift === 'evening');
  const latest = entries[entries.length - 1][1];

  return {
    hasMorning,
    hasEvening,
    hasBoth: hasMorning && hasEvening,
    latest,
    count: entries.length,
    entries
  };
}

// 获取今天交接行的高亮 CSS 类名（只标记早班经手的项目）
function getTodayHandoverRowClass(project) {
  if (!project.handover) return '';
  const todayKey = getShiftDateKey();
  const hasMorning = Object.entries(project.handover)
    .some(([key, v]) => key.startsWith(todayKey + '|') && v.shift === 'morning');
  return hasMorning ? ' handover-row-morning' : '';
}

// ===== 终版视频待填写提醒 =====
// 判断项目是否需要提醒填写终版视频信息（压缩包和工程文件）
// 条件：当天进入视频制作中/视频审核状态，或当天有视频修改指令
// 且：项目详情中该账号未填写工程文件链接、也没有压缩包文件
const VIDEO_REMINDER_STATUSES = ['视频制作中', '视频送审'];

function hasTodayVideoTask(projectName) {
  if (!projectName) return false;
  const name = String(projectName).trim();
  const todayStr = getTodayDateString();
  // 遍历所有子表的任务列表
  for (const sheet in taskLists) {
    const tasks = taskLists[sheet] || [];
    for (const t of tasks) {
      const taskProject = String(t.project || '').trim();
      if (!taskProject) continue;
      // 任务创建日期是今天
      const taskDate = t.createdAt ? getTodayDateString(new Date(t.createdAt)) : '';
      if (taskDate !== todayStr) continue;
      // 任务类型是视频修改
      if (t.type !== '视频修改') continue;
      // 项目名匹配
      if (name.includes(taskProject) || taskProject.includes(name)) return true;
    }
  }
  return false;
}

function needsVideoFileReminder(project) {
  const status = String(project.status || '').trim();
  const name = String(project.name || '').trim();
  if (!name) return false;

  // 条件1：状态是视频制作中或视频审核
  const inVideoPhase = VIDEO_REMINDER_STATUSES.includes(status);
  // 条件2：当天有视频修改指令
  const hasVideoTaskToday = hasTodayVideoTask(name);

  if (!inVideoPhase && !hasVideoTaskToday) return false;

  // 检查项目详情中是否有终版视频文件信息
  const key = getProjectDetailKey(project);
  if (!key) return true; // 没有详情记录，需要提醒

  const detail = projectDetails[key];
  if (!detail || !detail.accounts) return true; // 没有账号详情，需要提醒

  // 找到该账号的详情
  const accountKey = String(project.account || '').trim();
  const accountDetail = detail.accounts[accountKey];
  if (!accountDetail) return true; // 该账号没有详情，需要提醒

  // 检查是否填写了工程文件链接
  const hasFileLink = String(accountDetail.projectFileLink || '').trim().length > 0;
  // 检查是否有压缩包文件
  const hasPackageFiles = Array.isArray(accountDetail.packageFiles) && accountDetail.packageFiles.length > 0;
  // 检查是否有工程文件
  const hasProjectFiles = Array.isArray(accountDetail.projectFiles) && accountDetail.projectFiles.length > 0;

  // 如果都填写了，不需要提醒
  if (hasFileLink && hasPackageFiles) return false;
  if (hasFileLink && hasProjectFiles) return false;
  if (hasPackageFiles && hasProjectFiles) return false;

  // 至少需要填写压缩包和工程文件之一，否则需要提醒
  return true;
}

// 交接筛选状态
let handoverFilterActive = false;

// 账号快捷筛选状态（跟随当前子表，仅显示该子表映射的账号）
let accountFilterValue = ''; // 选中的账号全称，空字符串表示不筛选

// 自动归纳表格：来源列默认隐藏
let autoSheetSourceVisible = false;

function toggleAutoSheetSource() {
  autoSheetSourceVisible = !autoSheetSourceVisible;
  const btn = document.getElementById('btn-toggle-source');
  if (btn) {
    btn.textContent = autoSheetSourceVisible ? '🙈 隐藏来源' : '👁️ 显示来源';
  }
  // 重新渲染当前自动归纳表格
  if (AUTO_SHEETS[currentSheet]) {
    renderAutoSheet(currentSheet);
  }
}

function toggleHandoverFilter() {
  handoverFilterActive = !handoverFilterActive;
  const btn = document.getElementById('btn-filter-handover');
  if (btn) {
    if (handoverFilterActive) {
      btn.style.background = 'var(--primary)';
      btn.style.color = '#FFF';
      btn.textContent = '🔀 取消交接筛选';
      showToast('已开启交接筛选：仅显示今天有交接标记的项目');
    } else {
      btn.style.background = '';
      btn.style.color = '';
      btn.textContent = '🔀 交接筛选';
      showToast('已关闭交接筛选');
    }
  }
  // 清理选中状态
  selectedAll = false;
  selectedRows.clear();
  renderProjects();
}

// ===== 账号快捷筛选栏（跟随当前子表，仅显示该子表映射的账号） =====
function renderAccountFilterBar() {
  const bar = document.getElementById('account-filter-bar');
  const tagsContainer = document.getElementById('account-filter-tags');
  if (!bar || !tagsContainer) return;

  // 仅在配置了映射的子表显示
  if (!isAliasSheet(currentSheet)) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;

  const map = getAliasMapForSheet(currentSheet);
  if (!map) {
    bar.hidden = true;
    return;
  }

  const accounts = Object.entries(map); // [[简称, 全称], ...]
  let html = '';
  // 全部按钮
  html += `<button class="account-filter-tag ${!accountFilterValue ? 'active' : ''}" data-account="">全部</button>`;
  accounts.forEach(([alias, fullName]) => {
    const isActive = accountFilterValue === fullName;
    const label = alias === fullName ? alias : `${alias}→${fullName}`;
    html += `<button class="account-filter-tag ${isActive ? 'active' : ''}" data-account="${escapeHtml(fullName)}" title="${escapeHtml(label)}">${escapeHtml(alias)}</button>`;
  });
  tagsContainer.innerHTML = html;

  // 绑定点击事件
  tagsContainer.querySelectorAll('.account-filter-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const acc = btn.dataset.account || '';
      accountFilterValue = accountFilterValue === acc ? '' : acc;
      selectedAll = false;
      selectedRows.clear();
      renderAccountFilterBar();
      renderProjects();
    });
  });
}

// ===== 账号映射配置弹窗 =====
let accountConfigEditingSheet = ''; // 延迟到 ALIAS_SHEET_NAMES 初始化后再赋值

function openAccountConfigModal() {
  // 默认选中当前子表（如果是映射子表），否则选第一个
  if (isAliasSheet(currentSheet)) {
    accountConfigEditingSheet = currentSheet;
  } else if (!accountConfigEditingSheet && ALIAS_SHEET_NAMES.length > 0) {
    accountConfigEditingSheet = ALIAS_SHEET_NAMES[0];
  }
  const modal = document.getElementById('modal-account-config');
  if (modal) modal.classList.add('show');
  // 更新 tab 高亮
  document.querySelectorAll('.account-config-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.configSheet === accountConfigEditingSheet);
  });
  renderAccountConfigEditor(accountConfigEditingSheet);
}

function closeAccountConfigModal() {
  const modal = document.getElementById('modal-account-config');
  if (modal) modal.classList.remove('show');
}

function renderAccountConfigEditor(sheetName) {
  accountConfigEditingSheet = sheetName;
  const editor = document.getElementById('account-config-editor');
  if (!editor) return;
  const map = ACCOUNT_ALIAS_MAPS[sheetName] || {};
  const entries = Object.entries(map);
  let html = '<table class="account-config-table"><thead><tr><th>简称</th><th>完整账号名</th><th></th></tr></thead><tbody>';
  entries.forEach(([alias, fullName], idx) => {
    html += `<tr class="config-row" data-idx="${idx}">
      <td><input type="text" class="config-alias" value="${escapeHtml(alias)}" placeholder="简称"></td>
      <td><input type="text" class="config-fullname" value="${escapeHtml(fullName)}" placeholder="完整账号名"></td>
      <td><button class="btn btn-secondary btn-sm config-del-btn" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  editor.innerHTML = html;
}

function saveAccountConfig() {
  const editor = document.getElementById('account-config-editor');
  if (!editor) return;
  const rows = editor.querySelectorAll('.config-row');
  const newMap = {};
  let hasError = false;
  rows.forEach(row => {
    const aliasInput = row.querySelector('.config-alias');
    const fullNameInput = row.querySelector('.config-fullname');
    const alias = aliasInput.value.trim();
    const fullName = fullNameInput.value.trim();
    if (!alias || !fullName) {
      hasError = true;
      aliasInput.style.borderColor = !alias ? 'var(--danger)' : '';
      fullNameInput.style.borderColor = !fullName ? 'var(--danger)' : '';
    } else {
      newMap[alias] = fullName;
    }
  });
  if (hasError) {
    showToast('简称和完整账号名不能为空', 'error');
    return;
  }

  // 保存到当前编辑的子表
  ACCOUNT_ALIAS_MAPS[accountConfigEditingSheet] = newMap;
  // 持久化到 localStorage
  try {
    localStorage.setItem(ACCOUNT_ALIAS_CONFIG_KEY, JSON.stringify(ACCOUNT_ALIAS_MAPS));
  } catch (e) { /* ignore */ }
  // 重建派生数据
  rebuildAliasDerivedData();
  // 重置筛选并刷新界面
  accountFilterValue = '';
  renderAccountFilterBar();
  renderProjects();
  showToast(`已保存「${accountConfigEditingSheet}」的账号映射配置`);
}

// 在任务解析后自动匹配并标记项目
function autoMarkHandoverFromTask(task) {
  if (!task || !task.project) return 0;
  const shift = getCurrentShift();
  const dateKey = getShiftDateKey();
  const handoverKey = `${dateKey}|${shift}`;
  const todayStr = getTodayDateString();
  const taskProject = String(task.project || '').trim();
  if (!taskProject) return 0;

  // 第一步：找出所有项目名匹配且非当天新增的项目
  const matchingProjects = projects.filter(p => {
    const projectName = String(p.name || '').trim();
    if (!projectName) return false;
    if (!projectName.includes(taskProject) && !taskProject.includes(projectName)) return false;
    // 跳过当天新增的项目
    const projectDate = normalizeDateValue(p.date) || String(p.date || '').trim();
    if (projectDate === todayStr) return false;
    return true;
  });

  if (matchingProjects.length === 0) return 0;

  // 第二步：收集所有账号名，判断任务文本中是否提及了具体账号
  const taskText = String(task.detail || task.text || '').trim();
  const allAccounts = matchingProjects
    .map(p => String(p.account || '').trim())
    .filter(a => a);
  const mentionedAccounts = allAccounts.filter(a => taskText.includes(a));

  // 第三步：标记匹配的项目
  let count = 0;
  matchingProjects.forEach(p => {
    // 如果任务文本中明确提到了某些账号，只标记那些账号
    const projectAccount = String(p.account || '').trim();
    if (mentionedAccounts.length > 0 && projectAccount && !mentionedAccounts.includes(projectAccount)) {
      return;
    }

    if (!p.handover) p.handover = {};
    if (!p.handover[handoverKey]) {
      p.handover[handoverKey] = {
        shift,
        date: dateKey,
        time: new Date().toISOString(),
        label: getShiftLabel(shift),
        taskText: task.text || ''
      };
      count++;
    }
  });

  return count;
}

function normalizeDateValue(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  const isoMatch = source.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const slashMatch = source.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (slashMatch) {
    const [, y, m, d] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return '';
}

// ===== 排班功能 =====
const SCHEDULE_STORAGE_KEY = 'table-app-schedule-v7';

// 全部已知人员名单（用于 OCR 识别兜底和模糊匹配纠错）
// 这是在职所有员工，OCR 识别结果会根据此名单进行纠错
const ALL_STAFF = [
  '宁英杰', '刘慧', '何湘燕', '侯舒沛', '罗曼毓',
  '李怡婷', '龙飞燕', '吴昱颖',
  '陈柳静', '龚文婷', '彭雪琦', '冯静', '李红',
  '陈家怡', '赵海琼', '宋语诗',
  '刘诺楠', '常靖', '黄文婷',
  '邓茜', '迟玢', '黄金紫嫣', '王紫玥',
  '刘茜', '宋诗', '许京津'
];

let scheduleData = {
  morning: { sheetDuty: {}, secondary: [], substitutes: [] },
  evening: { sheetDuty: {}, secondary: [], substitutes: [] },
  rest: [],
  lastUpdated: new Date().toISOString()
};

// 默认排班配置（8.3-8.7）
// substitutes 格式: { person: '龚文婷', weekDay: 3, shift: 'morning', sheet: '🌟小圆子+野生+贝壳+小涡+小赵' }
// 表示：龚文婷在周三早班顶替A组（小圆子组）的主值班
const DEFAULT_SCHEDULE = {
  morning: {
    sheetDuty: {
      '快手+视频号': '陈家怡',
      '🌟小圆子+野生+贝壳+小涡+小赵': '宋语诗',
      '🌟娱乐社+八妹+番茄+小歪+果子': '李怡婷',
      '字节单': '李红',
      '在坐标这边生活': '李红',
      '小红书': '冯静',
      '暂停+回声+频率': ''
    },
    secondary: ['陈柳静', '宁英杰', '龚文婷', '赵海琼'],
    substitutes: [
      { person: '陈柳静', weekDay: 2, shift: 'morning', sheet: '小红书' },   // 周二小红书早
      { person: '宁英杰', weekDay: 5, shift: 'morning', sheet: '字节单' },    // 周五字节早
      { person: '宁英杰', weekDay: 5, shift: 'morning', sheet: '在坐标这边生活' }, // 周五字节早（坐标）
      { person: '龚文婷', weekDay: 3, shift: 'morning', sheet: '🌟小圆子+野生+贝壳+小涡+小赵' } // 周三A班早
    ]
  },
  evening: {
    sheetDuty: {
      '快手+视频号': '刘慧',
      '🌟小圆子+野生+贝壳+小涡+小赵': '吴昱颖',
      '🌟娱乐社+八妹+番茄+小歪+果子': '罗曼毓',
      '字节单': '刘诺楠',
      '在坐标这边生活': '刘诺楠',
      '小红书': '侯舒沛',
      '暂停+回声+频率': ''
    },
    secondary: ['龙飞燕', '何湘燕', '常靖'],
    substitutes: [
      { person: '龙飞燕', weekDay: 1, shift: 'evening', sheet: '快手+视频号' } // 周一快手晚
    ]
  },
  rest: ['刘慧', '冯静', '宋语诗', '龙飞燕', '彭雪琦']
};

function loadScheduleData() {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      scheduleData = {
        morning: {
          sheetDuty: parsed.morning?.sheetDuty || {},
          secondary: parsed.morning?.secondary || [],
          substitutes: parsed.morning?.substitutes || []
        },
        evening: {
          sheetDuty: parsed.evening?.sheetDuty || {},
          secondary: parsed.evening?.secondary || [],
          substitutes: parsed.evening?.substitutes || []
        },
        rest: parsed.rest || [],
        lastUpdated: parsed.lastUpdated || new Date().toISOString()
      };
    } else {
      scheduleData = {
        morning: {
          sheetDuty: { ...DEFAULT_SCHEDULE.morning.sheetDuty },
          secondary: [...DEFAULT_SCHEDULE.morning.secondary],
          substitutes: [...(DEFAULT_SCHEDULE.morning.substitutes || [])]
        },
        evening: {
          sheetDuty: { ...DEFAULT_SCHEDULE.evening.sheetDuty },
          secondary: [...DEFAULT_SCHEDULE.evening.secondary],
          substitutes: [...(DEFAULT_SCHEDULE.evening.substitutes || [])]
        },
        rest: [...DEFAULT_SCHEDULE.rest],
        lastUpdated: new Date().toISOString()
      };
      saveScheduleData();
    }
  } catch (e) {
    console.error('加载排班数据失败:', e);
    scheduleData = {
      morning: { sheetDuty: {}, secondary: [], substitutes: [] },
      evening: { sheetDuty: {}, secondary: [], substitutes: [] },
      rest: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

function saveScheduleData() {
  scheduleData.lastUpdated = new Date().toISOString();
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(scheduleData));
}

// 获取考虑顶班替换后的当天排班数据
// 返回: { sheetDuty: {...替换后}, secondary: [...], rest: [...], substitutes: [...] }
function getTodaySchedule() {
  const shift = getCurrentShift();
  const today = new Date();
  const weekDay = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const duty = shift === 'evening' ? scheduleData.evening : scheduleData.morning;
  const restList = scheduleData.rest || [];

  // 复制原始排班数据
  const result = {
    sheetDuty: { ...(duty.sheetDuty || {}) },
    secondary: [...(duty.secondary || [])],
    rest: [...restList],
    substitutes: [...(duty.substitutes || [])]
  };

  // 应用顶班替换：遍历 substitutes，匹配今天的顶班安排
  const todaySubs = result.substitutes.filter(sub =>
    sub.weekDay === weekDay && sub.shift === shift
  );

  todaySubs.forEach(sub => {
    if (sub.sheet && sub.person) {
      // 记录被替换的原始人员
      const originalPerson = result.sheetDuty[sub.sheet];
      // 用顶班人员替换
      result.sheetDuty[sub.sheet] = sub.person;
      // 从辅助列表中移除顶班人员（因为已被用作主值班）
      result.secondary = result.secondary.filter(s => s !== sub.person);
    }
  });

  return result;
}

function renderPrimaryDuty() {
  const el = els.primaryDuty;
  if (!el) return;
  const shift = getCurrentShift();
  // 使用考虑顶班替换后的当天排班数据
  const todaySchedule = getTodaySchedule();
  const duty = todaySchedule;
  // 根据当前子表显示对应的主值班人
  const sheetName = currentSheet;
  const name = duty.sheetDuty?.[sheetName] || '';
  if (name) {
    // 检查是否是顶班人员
    const today = new Date();
    const weekDay = today.getDay();
    const isSubstitute = (todaySchedule.substitutes || []).some(sub =>
      sub.weekDay === weekDay && sub.shift === shift && sub.sheet === sheetName && sub.person === name
    );
    const suffix = isSubstitute ? '（顶班）' : '';
    el.textContent = `👤 ${name}${suffix}`;
    el.title = `${getShiftLabel(shift)}${sheetName}主值班: ${name}${suffix}（点击设置排班）`;
  } else {
    el.textContent = '👤 未设置';
    el.title = '点击设置排班';
  }
}

// 当前排班弹窗中选中的班次
let scheduleModalShift = 'morning';

function switchScheduleShift(shift) {
  scheduleModalShift = shift;
  // 切换标签高亮
  document.querySelectorAll('.schedule-shift-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.scheduleShift === shift);
  });
  // 切换面板显示
  const morningPanel = document.getElementById('schedule-panel-morning');
  const eveningPanel = document.getElementById('schedule-panel-evening');
  if (morningPanel) morningPanel.style.display = shift === 'morning' ? '' : 'none';
  if (eveningPanel) eveningPanel.style.display = shift === 'evening' ? '' : 'none';
}

function openScheduleModal() {
  const modal = els.modalSchedule;
  if (!modal) return;
  const currentShift = getCurrentShift();
  scheduleModalShift = currentShift;

  // 显示当前日期、星期和班次时间信息
  const dateInfoEl = document.getElementById('schedule-date-info');
  if (dateInfoEl) {
    const today = new Date();
    const todayStr = getTodayDateString();
    const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][today.getDay()];
    const shiftLabel = getShiftLabel(currentShift);
    const shiftIcon = getShiftIcon(currentShift);
    dateInfoEl.innerHTML = `<span class="schedule-date-badge">📅 ${todayStr}</span><span class="schedule-week-badge">${weekDay}</span><span class="schedule-shift-badge">${shiftIcon} 当前${shiftLabel}</span>`;
  }

  // 默认显示当前班次的标签
  document.querySelectorAll('.schedule-shift-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.scheduleShift === currentShift);
  });
  const morningPanel = document.getElementById('schedule-panel-morning');
  const eveningPanel = document.getElementById('schedule-panel-evening');
  if (morningPanel) morningPanel.style.display = currentShift === 'morning' ? '' : 'none';
  if (eveningPanel) eveningPanel.style.display = currentShift === 'evening' ? '' : 'none';

  // 填充早班和晚班的子表主值班人
  const regularSheets = SHEETS.filter(s => !AUTO_SHEETS[s]);
  ['morning', 'evening'].forEach(shiftKey => {
    const duty = scheduleData[shiftKey];
    const listEl = document.getElementById(`schedule-sheet-duty-list-${shiftKey}`);
    if (listEl) {
      listEl.innerHTML = regularSheets.map(sheet => {
        const name = duty.sheetDuty?.[sheet] || '';
        return `
          <div class="sheet-duty-row">
            <label class="sheet-duty-label">${escapeHtml(sheet)}</label>
            <input type="text" class="form-control sheet-duty-input-${shiftKey}" data-sheet="${escapeHtml(sheet)}" placeholder="主值班人" value="${escapeHtml(name)}">
          </div>
        `;
      }).join('');
    }

    // 填充辅助值班人
    const secListEl = document.getElementById(`schedule-secondary-list-${shiftKey}`);
    if (secListEl) {
      const list = duty.secondary.length > 0 ? duty.secondary : [''];
      secListEl.innerHTML = list.map(name => `
        <div class="secondary-duty-row">
          <input type="text" class="form-control secondary-duty-input-${shiftKey}" placeholder="输入辅助值班人姓名" value="${escapeHtml(name)}">
          <button class="btn-remove-secondary" onclick="this.parentElement.remove()" type="button">&times;</button>
        </div>
      `).join('');
    }
  });

  // 填充排休人员
  const restList = document.getElementById('schedule-rest-list');
  if (restList) {
    const list = scheduleData.rest.length > 0 ? scheduleData.rest : [''];
    restList.innerHTML = list.map(name => `
      <div class="secondary-duty-row">
        <input type="text" class="form-control rest-duty-input" placeholder="输入排休人员姓名" value="${escapeHtml(name)}">
        <button class="btn-remove-secondary" onclick="this.parentElement.remove()" type="button">&times;</button>
      </div>
    `).join('');
  }

  modal.classList.add('show');
}

function closeScheduleModal() {
  if (els.modalSchedule) els.modalSchedule.classList.remove('show');
}

function addSecondaryDutyField(shift = 'morning') {
  const listEl = document.getElementById(`schedule-secondary-list-${shift}`);
  if (!listEl) return;
  const row = document.createElement('div');
  row.className = 'secondary-duty-row';
  row.innerHTML = `
    <input type="text" class="form-control secondary-duty-input-${shift}" placeholder="输入辅助值班人姓名">
    <button class="btn-remove-secondary" onclick="this.parentElement.remove()" type="button">&times;</button>
  `;
  listEl.appendChild(row);
}

function addRestDutyField() {
  const restList = document.getElementById('schedule-rest-list');
  if (!restList) return;
  const row = document.createElement('div');
  row.className = 'secondary-duty-row';
  row.innerHTML = `
    <input type="text" class="form-control rest-duty-input" placeholder="输入排休人员姓名">
    <button class="btn-remove-secondary" onclick="this.parentElement.remove()" type="button">&times;</button>
  `;
  restList.appendChild(row);
}

// ===== 可排班人员名单管理 =====
const STAFF_LIST_STORAGE_KEY = 'table-app-staff-list-v1';

// 获取可排班人员名单（优先从 localStorage 读取，否则用 ALL_STAFF 默认值）
function getStaffList() {
  try {
    const raw = localStorage.getItem(STAFF_LIST_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) {}
  return [...ALL_STAFF];
}

// 保存可排班人员名单到 localStorage
function saveStaffList(list) {
  try {
    localStorage.setItem(STAFF_LIST_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
}

// 展开/收起人员名单
function toggleStaffList() {
  const area = document.getElementById('schedule-staff-list-area');
  if (area) {
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
    if (area.style.display === 'block') {
      renderStaffTags();
    }
  }
}

// 渲染人员标签
function renderStaffTags() {
  const tagsEl = document.getElementById('schedule-staff-tags');
  if (!tagsEl) return;
  const staffList = getStaffList();
  tagsEl.innerHTML = staffList.map(name => `
    <span class="staff-tag">
      ${escapeHtml(name)}
      <button class="staff-tag-remove" onclick="removeStaffName('${escapeHtml(name)}')" type="button">&times;</button>
    </span>
  `).join('');
}

// 添加新员工
function addStaffName() {
  const input = document.getElementById('schedule-staff-new-name');
  if (!input || !input.value.trim()) return;
  const name = input.value.trim();
  const staffList = getStaffList();
  if (staffList.includes(name)) {
    showToast('该人员已存在', 'warning');
    return;
  }
  staffList.push(name);
  saveStaffList(staffList);
  input.value = '';
  renderStaffTags();
  showToast(`已添加「${name}」到可排班人员名单`, 'success');
}

// 删除员工
function removeStaffName(name) {
  let staffList = getStaffList();
  staffList = staffList.filter(n => n !== name);
  saveStaffList(staffList);
  renderStaffTags();
  showToast(`已从名单中移除「${name}」`, 'info');
}

function saveScheduleSettings() {
  // 分别收集早班和晚班的数据
  ['morning', 'evening'].forEach(shiftKey => {
    // 收集子表主值班人
    const sheetInputs = document.querySelectorAll(`.sheet-duty-input-${shiftKey}`);
    const sheetDuty = {};
    sheetInputs.forEach(input => {
      const sheet = input.dataset.sheet;
      const name = input.value.trim();
      if (sheet && name) {
        sheetDuty[sheet] = name;
      }
    });

    // 收集辅助值班人
    const secInputs = document.querySelectorAll(`.secondary-duty-input-${shiftKey}`);
    const secondary = Array.from(secInputs).map(i => i.value.trim()).filter(n => n);

    // 保留已有的顶班数据（substitutes 不从弹窗收集，由智能录入解析或默认配置提供）
    const existingSubstitutes = scheduleData[shiftKey]?.substitutes || [];
    scheduleData[shiftKey] = { sheetDuty, secondary, substitutes: existingSubstitutes };
  });

  // 收集排休人员
  const restInputs = document.querySelectorAll('.rest-duty-input');
  const rest = Array.from(restInputs).map(i => i.value.trim()).filter(n => n);
  scheduleData.rest = rest;

  saveScheduleData();
  renderPrimaryDuty();
  renderOrderStatistics();
  closeScheduleModal();
  showToast('排班设置已保存');
}

// 渲染排单统计
function renderOrderStatistics() {
  const contentEl = els.orderStatsContent;
  const weekEl = els.orderStatsWeek;
  if (!contentEl) return;

  const todayStr = getTodayDateString();
  const shift = getCurrentShift();
  const shiftLabel = getShiftLabel(shift);
  const today = new Date();
  const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][today.getDay()];
  const weekDayNum = today.getDay();
  if (weekEl) {
    weekEl.textContent = `${todayStr} ${weekDay} ${shiftLabel}`;
  }

  // 使用考虑顶班替换后的当天排班数据
  const todaySchedule = getTodaySchedule();
  const restList = todaySchedule.rest;

  // 按接单人统计当天处于"脚本制作中"状态的项目
  const assigneeStats = {};
  projects.forEach(p => {
    if (!p.date) return;
    const projectDate = normalizeDateValue(p.date);
    if (!projectDate) return;
    if (projectDate === todayStr) {
      if (p.status !== '脚本制作中') return;
      const assignee = p.assignee ? p.assignee.trim() : '';
      if (!assignee) return;
      const sheet = p.sheet || '未分类';
      if (!assigneeStats[assignee]) {
        assigneeStats[assignee] = {};
      }
      assigneeStats[assignee][sheet] = (assigneeStats[assignee][sheet] || 0) + 1;
    }
  });

  // 计算每个人员的显示信息
  const personInfo = [];

  const sheetDuty = todaySchedule.sheetDuty;
  const secondary = todaySchedule.secondary;
  const substitutes = todaySchedule.substitutes || [];

  // 遍历子表主值班人（已应用顶班替换）
  Object.entries(sheetDuty).forEach(([sheetName, primaryName]) => {
    const name = primaryName.trim();
    if (!name) return;

    // 检查该位置是否被顶班替换
    const subInfo = substitutes.find(sub =>
      sub.weekDay === weekDayNum && sub.shift === shift && sub.sheet === sheetName
    );

    if (subInfo && subInfo.person === name) {
      // 这个人是顶班人员
      personInfo.push({
        name: name,
        label: `（${weekDay}${sheetName}顶班）`,
        isRest: false,
        isSubstitute: true
      });
    } else if (restList.includes(name)) {
      // 主值班排休（理论上已被顶班替换，但如果没有顶班则显示排休）
      personInfo.push({
        name: name,
        label: `（${sheetName} 排休）`,
        isRest: true,
        isSubstitute: false
      });
    } else {
      personInfo.push({
        name: name,
        label: `（${sheetName}）`,
        isRest: false,
        isSubstitute: false
      });
    }
  });

  // 添加辅助值班人员（未被顶替使用的）
  secondary.forEach(name => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // 如果已在personInfo中作为顶替出现，跳过
    const alreadyListed = personInfo.some(p => p.name === trimmed && !p.isRest);
    if (alreadyListed) return;
    if (restList.includes(trimmed)) {
      personInfo.push({
        name: trimmed,
        label: '（辅助 排休）',
        isRest: true,
        isSubstitute: false
      });
    } else {
      personInfo.push({
        name: trimmed,
        label: '（辅助）',
        isRest: false,
        isSubstitute: false
      });
    }
  });

  if (personInfo.length === 0) {
    contentEl.innerHTML = '<div class="order-stats-empty">请先设置排班</div>';
    return;
  }

  let html = '';
  personInfo.forEach(info => {
    if (info.isRest) {
      html += `
        <div class="order-stats-item order-stats-rest">
          <div class="order-stats-name">${escapeHtml(info.name)}${escapeHtml(info.label)}</div>
        </div>
      `;
      return;
    }

    const sheetCounts = assigneeStats[info.name] || {};
    const sheetTags = Object.entries(sheetCounts)
      .map(([sheet, count]) => `${escapeHtml(sheet)}${count}单`)
      .join('，');

    const displayDetail = sheetTags || '0单';
    const subClass = info.isSubstitute ? ' order-stats-substitute' : '';
    html += `
      <div class="order-stats-item${subClass}">
        <div class="order-stats-name">${escapeHtml(info.name)}${escapeHtml(info.label)}</div>
        <div class="order-stats-detail">${displayDetail}</div>
      </div>
    `;
  });
  contentEl.innerHTML = html;
}

function extractFirstUrl(text) {
  const source = String(text || '').trim();
  const urlMatch = source.match(/(?:https?:\/\/|www\.)[^\s，,。；;）)】\]]+/i);
  if (urlMatch) return urlMatch[0];
  const platformMatch = source.match(/\b(?:v\.douyin\.com|www\.douyin\.com|douyin\.com|iesdouyin\.com|v\.kuaishou\.com|www\.kuaishou\.com|kuaishou\.com|chenzhongtech\.com|gifshow\.com|www\.xiaohongshu\.com|xiaohongshu\.com|xhslink\.com|www\.bilibili\.com|m\.bilibili\.com|bilibili\.com|b23\.tv|channels\.weixin\.qq\.com|weixin\.qq\.com\/sph|mp\.weixin\.qq\.com)[^\s，,。；;）)】\]]*/i);
  return platformMatch ? platformMatch[0] : '';
}

function isValidPublishLink(text) {
  return Boolean(extractFirstUrl(text));
}

// ===== Expose for inline handlers =====
window.deleteProject = deleteProject;
window.deleteProjectGroup = deleteProjectGroup;
window.openProjectDetail = openProjectDetail;
window.uploadDetailFiles = uploadDetailFiles;
window.uploadDroppedDetailFiles = uploadDroppedDetailFiles;
window.handleDetailDragOver = handleDetailDragOver;
window.handleDetailDragLeave = handleDetailDragLeave;
window.removeDetailFile = removeDetailFile;
window.switchScheduleShift = switchScheduleShift;
window.openScheduleModal = openScheduleModal;
window.closeScheduleModal = closeScheduleModal;
window.openAccountConfigModal = openAccountConfigModal;
window.closeAccountConfigModal = closeAccountConfigModal;
window.saveAccountConfig = saveAccountConfig;
window.addSecondaryDutyField = addSecondaryDutyField;
window.addRestDutyField = addRestDutyField;
window.saveScheduleSettings = saveScheduleSettings;
window.toggleScheduleSmartInput = toggleScheduleSmartInput;
window.switchScheduleSmartTab = switchScheduleSmartTab;
window.handleScheduleImageUpload = handleScheduleImageUpload;
window.clearScheduleImage = clearScheduleImage;
window.parseScheduleText = parseScheduleText;
window.applyOcrResult = applyOcrResult;
window.openOrderStatsModal = openOrderStatsModal;
window.closeOrderStatsModal = closeOrderStatsModal;

// ===== 单量统计 =====
function openOrderStatsModal() {
  const modal = document.getElementById('modal-order-stats');
  if (!modal) return;
  const body = document.getElementById('order-stats-modal-body');
  if (!body) return;

  // 计算上周周一到周日的日期范围
  const today = new Date();
  const todayDay = today.getDay(); // 0=周日, 1=周一...
  // 上周一 = 今天 - (todayDay - 1) - 7
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - (todayDay === 0 ? 6 : todayDay - 1) - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);

  const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const mondayStr = fmtDate(lastMonday);
  const sundayStr = fmtDate(lastSunday);

  // 收集上周新单（按接单日期过滤）
  const weekProjects = projects.filter(p => {
    if (!p.date) return false;
    const d = normalizeDateValue(p.date);
    if (!d) return false;
    return d >= mondayStr && d <= sundayStr;
  });

  // 按平台分类统计
  // 字节单子表的项目单独统计为"字节单"，不从抖音平台中重复计算
  // 统计展示的平台列表（固定展示，即使为0也显示）
  const STATS_PLATFORMS = ['字节单', '抖音', '快手', '视频号', '小红书', 'B站'];
  const platformStats = {}; // { platform: count }
  STATS_PLATFORMS.forEach(p => platformStats[p] = 0);
  let otherCount = 0; // 不在标准平台中的单量
  let totalCount = 0;

  weekProjects.forEach(p => {
    totalCount++;
    // 如果项目在"字节单"子表中，单独计入字节单
    if (p.sheet === '字节单') {
      platformStats['字节单']++;
    } else {
      // 其他子表按平台字段分类
      let platform = (p.platform || '').trim();
      if (!platform) platform = '未分类';
      if (platformStats.hasOwnProperty(platform)) {
        platformStats[platform]++;
      } else {
        otherCount++;
      }
    }
  });

  // 构建表格行：按固定顺序展示标准平台
  const rows = [];
  STATS_PLATFORMS.forEach(platform => {
    rows.push({
      label: platform,
      count: platformStats[platform],
      highlight: platform === '字节单'
    });
  });
  // 其他平台（非标准）
  if (otherCount > 0) {
    rows.push({ label: '其他', count: otherCount, highlight: false });
  }
  // 未分类
  const uncategorizedCount = weekProjects.filter(p => p.sheet !== '字节单' && !(p.platform || '').trim()).length;
  if (uncategorizedCount > 0) {
    rows.push({ label: '未分类', count: uncategorizedCount, highlight: false });
  }

  // 构建日期范围标题
  const weekDayNames = ['周一','周二','周三','周四','周五','周六','周日'];
  const dateRangeStr = `${mondayStr} ~ ${sundayStr}`;

  let html = `
    <div class="order-stats-summary">
      <div class="order-stats-summary-header">
        <span class="order-stats-range">📅 ${dateRangeStr}</span>
        <span class="order-stats-total">总单量：${totalCount} 单</span>
      </div>
    </div>
    <table class="order-stats-table">
      <thead>
        <tr>
          <th style="width:50%">平台/分类</th>
          <th style="width:30%">单量</th>
          <th style="width:20%">占比</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (rows.length === 0 || totalCount === 0) {
    html += `
      <tr>
        <td colspan="3" style="text-align:center;padding:2rem;color:var(--muted);">上周无新单数据</td>
      </tr>
    `;
  } else {
    rows.forEach(row => {
      const percent = totalCount > 0 ? ((row.count / totalCount) * 100).toFixed(1) : '0';
      const rowClass = row.highlight ? ' class="order-stats-row-highlight"' : '';
      html += `
        <tr${rowClass}>
          <td><span class="order-stats-label">${escapeHtml(row.label)}</span></td>
          <td><span class="order-stats-count">${row.count}</span> 单</td>
          <td><span class="order-stats-percent">${percent}%</span></td>
        </tr>
      `;
    });
  }

  html += `
      </tbody>
    </table>

    <!-- 人员接单统计 -->
    <div class="order-stats-person-section">
      <div class="order-stats-person-header">
        <span>👤 上周人员接单统计</span>
        <span class="order-stats-person-hint">同一项目名只计1单，不重复统计</span>
      </div>
      <table class="order-stats-table order-stats-person-table">
        <thead>
          <tr>
            <th style="width:40%">接单人</th>
            <th style="width:20%">单量</th>
            <th style="width:40%">涉及项目</th>
          </tr>
        </thead>
        <tbody>
  `;

  // 人员接单统计：同一项目名只计1单
  const personStats = {}; // { assignee: { count, projects: Set } }
  const countedProjectNames = new Set(); // 已统计过的项目名（全局去重）

  weekProjects.forEach(p => {
    const assignee = (p.assignee || '').trim();
    if (!assignee) return;
    const projectName = (p.name || '').trim();
    // 同一项目名只计1单
    if (projectName && countedProjectNames.has(projectName)) return;
    if (projectName) countedProjectNames.add(projectName);

    if (!personStats[assignee]) {
      personStats[assignee] = { count: 0, projects: [] };
    }
    personStats[assignee].count++;
    if (projectName && !personStats[assignee].projects.includes(projectName)) {
      personStats[assignee].projects.push(projectName);
    }
  });

  const personRows = Object.entries(personStats)
    .sort((a, b) => b[1].count - a[1].count);

  if (personRows.length === 0) {
    html += `
      <tr>
        <td colspan="3" style="text-align:center;padding:1.5rem;color:var(--muted);">上周无接单数据</td>
      </tr>
    `;
  } else {
    personRows.forEach(([name, info]) => {
      const projectList = info.projects.length > 3
        ? info.projects.slice(0, 3).join('、') + ` 等${info.projects.length}个`
        : info.projects.join('、') || '-';
      html += `
        <tr>
          <td><span class="order-stats-label">${escapeHtml(name)}</span></td>
          <td><span class="order-stats-count">${info.count}</span> 单</td>
          <td><span class="order-stats-projects">${escapeHtml(projectList)}</span></td>
        </tr>
      `;
    });
  }

  html += `
        </tbody>
      </table>
    </div>

    <div class="order-stats-note">
      <p>📌 统计说明：</p>
      <p>1. 统计范围：上周周一至周日（${dateRangeStr}）的新增项目</p>
      <p>2. "字节单"为字节单子表的订单，已从抖音平台中单独拆出</p>
      <p>3. 其他平台按项目"平台"字段分类统计</p>
      <p>4. 人员接单统计中，同一项目名只计1单，不因多账号重复统计</p>
    </div>
  `;

  body.innerHTML = html;
  modal.classList.add('show');
}

function closeOrderStatsModal() {
  const modal = document.getElementById('modal-order-stats');
  if (modal) modal.classList.remove('show');
}

// ===== Smart Schedule Entry Functions =====
function toggleScheduleSmartInput() {
  const area = document.getElementById('schedule-smart-input-area');
  if (area) {
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
  }
}

function switchScheduleSmartTab(tab) {
  document.querySelectorAll('.schedule-smart-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.smartTab === tab);
  });
  const textPanel = document.getElementById('schedule-smart-text-panel');
  const imagePanel = document.getElementById('schedule-smart-image-panel');
  if (textPanel) textPanel.style.display = tab === 'text' ? 'block' : 'none';
  if (imagePanel) imagePanel.style.display = tab === 'image' ? 'block' : 'none';
}

// OCR 常见混淆字映射（视觉相似 / Tesseract 常见误识别）
const OCR_CHAR_CONFUSION = {
  '巫': '常', '婧': '靖', '常': '常', '靖': '靖',
  '玲': '玢', '玢': '玢', '纷': '玢', '芬': '玢',
  '曼': '曼', '毓': '毓', '柔': '毓', '様': '毓',
  '颖': '颖', '硕': '颖', '预': '颖',
  '婷': '婷', '停': '婷', '亭': '婷',
  '燕': '燕', '雁': '燕', '晏': '燕',
  '慧': '慧', '惠': '慧', '急': '慧',
  '静': '静', '精': '静', '净': '静', '情': '静',
  '红': '红', '虹': '红', '宏': '红',
  '茜': '茜', '晒': '茜', '西': '茜',
  '玲': '玲', '铃': '玲', '岭': '玲', '零': '玲',
  '诗': '诗', '峙': '诗', '侍': '诗', '时': '诗',
  '楠': '楠', '南': '楠', '喃': '楠',
  '怡': '怡', '台': '怡', '治': '怡',
  '琦': '琦', '棋': '琦', '旗': '琦', '奇': '琦',
  '玥': '玥', '月': '玥', '悦': '玥', '阅': '玥',
  '嫣': '嫣', '焉': '嫣', '淹': '嫣',
  '杰': '杰', '洁': '杰', '结': '杰', '捷': '杰',
  '湘': '湘', '相': '湘', '香': '湘',
  '舒': '舒', '书': '舒', '殊': '舒',
  '沛': '沛', '佩': '沛', '配': '沛',
  '文': '文', '纹': '文', '蚊': '文',
  '海': '海', '每': '海', '梅': '海',
  '琼': '琼', '穷': '琼', '穹': '琼',
  '柳': '柳', '留': '柳', '刘': '柳',
  '家': '家', '佳': '家', '加': '家',
  '语': '语', '雨': '语', '与': '语',
  '京': '京', '经': '京', '惊': '京',
  '紫': '紫', '子': '紫', '柴': '紫',
  '迟': '迟', '持': '迟', '尺': '迟',
  '邓': '邓', '登': '邓',
  '飞': '飞', '非': '飞', '肥': '飞',
  '昱': '昱', '煜': '昱', '玉': '昱',
  '龚': '龚', '共': '龚', '供': '龚',
  '侯': '侯', '后': '侯', '候': '侯',
  '罗': '罗', '萝': '罗', '骡': '罗',
  '宁': '宁', '柠': '宁', '凝': '宁',
  '彭': '彭', '朋': '彭', '膨': '彭',
  '吴': '吴', '误': '吴', '无': '吴',
  '许': '许', '须': '许', '虚': '许',
  '赵': '赵', '照': '赵', '召': '赵',
  '宋': '宋', '送': '宋', '松': '宋',
  '陈': '陈', '尘': '陈', '沉': '陈',
  '龙': '龙', '隆': '龙', '笼': '龙',
  '何': '何', '河': '何', '荷': '何',
  '冯': '冯', '风': '冯', '丰': '冯',
  '黄': '黄', '皇': '黄', '煌': '黄',
  '王': '王', '汪': '王', '枉': '王',
  '刘': '刘', '留': '刘', '流': '刘',
  '李': '李', '里': '李', '理': '李',
  '吴': '吴', '误': '吴',
};

// 计算两个字符串的编辑距离（Levenshtein）
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// 人名纠错：将 OCR 识别的可能含有错字的名字，纠正为已知人员名单中最接近的名字
function correctPersonName(rawName, knownNames) {
  if (!rawName || rawName.length < 2) return rawName;

  // 1. 精确匹配
  if (knownNames.has(rawName)) return rawName;

  // 2. 尝试逐字纠正（基于 OCR_CHAR_CONFUSION 映射）
  const correctedChars = [];
  for (const ch of rawName) {
    correctedChars.push(OCR_CHAR_CONFUSION[ch] || ch);
  }
  const confusionCorrected = correctedChars.join('');
  if (knownNames.has(confusionCorrected)) return confusionCorrected;

  // 3. 编辑距离匹配：找到编辑距离最小的已知名字
  let bestMatch = null;
  let minDist = Infinity;
  knownNames.forEach(name => {
    // 长度差异太大则跳过
    if (Math.abs(name.length - rawName.length) > 1) return;
    const dist = levenshteinDistance(rawName, name);
    if (dist < minDist) {
      minDist = dist;
      bestMatch = name;
    }
    // 也对混淆纠正后的名字计算编辑距离
    const dist2 = levenshteinDistance(confusionCorrected, name);
    if (dist2 < minDist) {
      minDist = dist2;
      bestMatch = name;
    }
  });

  // 4. 如果最佳匹配的编辑距离 <= 1（允许1个字的OCR错误），则采用
  if (bestMatch && minDist <= 1) {
    return bestMatch;
  }

  // 5. 对于2字名字，如果编辑距离为1且混淆纠正后也匹配，返回纠正结果
  if (bestMatch && minDist <= 1 && rawName.length === 2) {
    return bestMatch;
  }

  // 无法纠正，返回原名
  return rawName;
}

// 批量纠错一行文本中的人名
function correctNamesInText(text, knownNames) {
  if (!text) return text;
  let result = text;
  knownNames.forEach(name => {
    // 精确匹配无需处理
  });
  // 对文本中每个2-4字中文片段尝试纠错
  result = result.replace(/[\u4e00-\u9fa5]{2,4}/g, (match) => {
    const corrected = correctPersonName(match, knownNames);
    return corrected;
  });
  return result;
}

// 提取出的可复用解析函数：解析排班文本并应用到 scheduleData
function parseScheduleContent(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  let currentShift = null;
  const regularSheets = SHEETS.filter(s => !AUTO_SHEETS[s]);

  // 平台名和子表关键词黑名单，防止被误识别为人名
  const NON_PERSON_NAMES = [
    '快手', '抖音', '小红书', '视频号', '星图', '磁力', '蒲公英', '花火',
    '字节', '字节单', '坐标', '生活', '暂停', '回声', '频率',
    '娱乐', '番茄', '小歪', '果子', '小圆子', '野生', '贝壳', '小涡', '小赵',
    '排休', '休息', '辅助', '值班', '早班', '晚班', '通班',
    '周一', '周二', '周三', '周四', '周五', '周六', '周日',
    '主值班', '助班', 'OFF', 'off'
  ];

  // 检查一个名字是否不是人名（平台名、子表名等）
  function isNonPersonName(name) {
    return NON_PERSON_NAMES.some(n => name === n || name.includes(n) && name.length <= n.length + 1);
  }

  // 构建已知人员名库（从可排班人员名单 + 现有排班数据中提取）
  const knownNames = new Set();
  // 优先使用可排班人员名单（支持用户自定义增删）
  getStaffList().forEach(name => knownNames.add(name));
  ALL_STAFF.forEach(name => knownNames.add(name));
  ['morning', 'evening'].forEach(shift => {
    Object.values(scheduleData[shift]?.sheetDuty || {}).forEach(name => {
      if (name) name.split(/[、,，\s]+/).forEach(n => { if (n.trim()) knownNames.add(n.trim()); });
    });
    (scheduleData[shift]?.secondary || []).forEach(name => { if (name.trim()) knownNames.add(name.trim()); });
  });
  (scheduleData.rest || []).forEach(name => { if (name.trim()) knownNames.add(name.trim()); });

  const parsed = {
    morning: { sheetDuty: {}, secondary: [], substitutes: [] },
    evening: { sheetDuty: {}, secondary: [], substitutes: [] },
    rest: []
  };

  // 顶班标注解析：从括号中提取"周X子表名"格式的顶班信息
  // 如 "龚文婷（周三A班早）" → { person: '龚文婷', weekDay: 3, sheet: '🌟小圆子...', shift: 'morning' }
  function parseSubstituteNote(personName, note, currentShift, regularSheets) {
    if (!note || !personName) return null;
    // 匹配 "周X" 获取星期几
    const weekMatch = note.match(/周([一二三四五六日])/);
    if (!weekMatch) return null;
    const weekMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
    const weekDay = weekMap[weekMatch[1]];
    if (weekDay === undefined) return null;

    // 判断班次
    let shift = currentShift || 'morning';
    if (/晚/.test(note)) shift = 'evening';
    else if (/早/.test(note)) shift = 'morning';

    // 匹配子表名
    let matchedSheet = null;
    // A班/A组 → 小圆子组
    if (/A\s*[班组]/.test(note)) {
      matchedSheet = regularSheets.find(s => /小圆子|野生|贝壳/.test(s));
    }
    // B班/B组 → 娱乐社组
    else if (/B\s*[班组]/.test(note)) {
      matchedSheet = regularSheets.find(s => /娱乐社|八妹|番茄/.test(s));
    }
    // 快手
    else if (/快手/.test(note)) {
      matchedSheet = regularSheets.find(s => /快手/.test(s));
    }
    // 字节
    else if (/字节/.test(note)) {
      matchedSheet = regularSheets.find(s => /字节/.test(s));
    }
    // 小红书
    else if (/小红书/.test(note)) {
      matchedSheet = regularSheets.find(s => /小红书/.test(s));
    }
    // 坐标
    else if (/坐标/.test(note)) {
      matchedSheet = regularSheets.find(s => /坐标/.test(s));
    }

    if (matchedSheet) {
      return { person: personName, weekDay: weekDay, shift: shift, sheet: matchedSheet };
    }
    return null;
  }

  // 预处理：合并碎片化行（单字行追加到上一行）
  const mergedLines = [];
  lines.forEach(line => {
    // 单字或极短行且非关键词行，合并到上一行
    if (line.length <= 2 && !/^(早班|晚班|通班|排休|休息|辅助)/.test(line) && mergedLines.length > 0) {
      mergedLines[mergedLines.length - 1] += line;
    } else {
      mergedLines.push(line);
    }
  });

  mergedLines.forEach(line => {
    // 去除常见 OCR 噪音字符
    const cleanLine = line.replace(/[_.…·•°]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanLine) return;

    // 检测班次（支持模糊匹配，如"晚班"被识别为"晚 班"）
    if (/^早\s*班/i.test(cleanLine) || cleanLine === '早班') {
      currentShift = 'morning';
      return;
    }
    if (/^晚\s*班/i.test(cleanLine) || cleanLine === '晚班') {
      currentShift = 'evening';
      return;
    }
    if (/^通\s*班/i.test(cleanLine) || cleanLine === '通班') {
      currentShift = 'morning';
      return;
    }

    // 检测排休（支持同行人名和后续行人名）
    if (/排\s*休|休\s*息|OFF|off/.test(cleanLine)) {
      // 提取当前行冒号后的人名
      const afterColon = cleanLine.split(/[：:]/)[1] || cleanLine.replace(/^.*?[排休休息]+[：:]?\s*/, '');
      const names = afterColon.split(/[、,，\s]+/).filter(n => n.trim() && n.trim().length >= 2);
      names.forEach(name => {
        const trimmed = name.trim();
        if (trimmed && !parsed.rest.includes(trimmed)) {
          parsed.rest.push(trimmed);
        }
      });
      // 标记后续行也属于排休区域（直到遇到下一个班次关键词）
      currentShift = 'rest';
      return;
    }

    // 如果当前处于排休区域，提取该行的人名
    if (currentShift === 'rest') {
      // 如果遇到新的班次关键词，退出排休区域
      if (/早\s*班/.test(cleanLine)) { currentShift = 'morning'; return; }
      if (/晚\s*班/.test(cleanLine)) { currentShift = 'evening'; return; }
      if (/通\s*班/.test(cleanLine)) { currentShift = 'morning'; return; }
      if (/辅\s*助|助\s*班/.test(cleanLine)) { currentShift = null; return; }

      // 提取该行的人名（支持各种分隔符）
      const names = cleanLine.split(/[、,，\s]+/).filter(n => n.trim() && n.trim().length >= 2);
      names.forEach(name => {
        const trimmed = name.trim();
        // 验证不是常见非人名词汇
        if (trimmed && !parsed.rest.includes(trimmed) &&
            !/^(排休|休息|辅助|值班|早班|晚班|通班|周一|周二|周三|周四|周五|周六|周日|字节|快手|小红书|视频|坐标|生活|暂停|回声|频率|娱乐|番茄|小歪|果子|小圆子|野生|贝壳|小润|小赵|主值班)$/.test(trimmed)) {
          parsed.rest.push(trimmed);
        }
      });
      return;
    }

    // 如果还没检测到班次，尝试从行中推断
    if (!currentShift) {
      if (/早\s*班/.test(cleanLine)) { currentShift = 'morning'; }
      else if (/晚\s*班/.test(cleanLine)) { currentShift = 'evening'; }
      else return; // 无法确定班次，跳过
    }

    // 检测辅助（支持"辅助""助班"等变体）
    if (/辅\s*助|助\s*班/.test(cleanLine)) {
      const afterColon = cleanLine.split(/[：:]/)[1] || cleanLine.replace(/^.*?辅\s*助[：:]?\s*/, '').replace(/^.*?助\s*班[：:]?\s*/, '');
      // 按、,，空格分隔，但保留括号内容
      const nameParts = afterColon.split(/[、,，]/).filter(n => n.trim());
      nameParts.forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) return;
        // 提取括号中的顶班标注
        const bracketMatch = trimmed.match(/^([\u4e00-\u9fa5]{2,4})\s*[（(](.+?)[)）]/);
        if (bracketMatch) {
          const personName = bracketMatch[1];
          const note = bracketMatch[2];
          parsed[currentShift].secondary.push(personName);
          // 尝试解析顶班信息
          const subInfo = parseSubstituteNote(personName, note, currentShift, regularSheets);
          if (subInfo) {
            parsed[currentShift].substitutes.push(subInfo);
          }
        } else {
          // 没有括号，直接是人名
          const nameOnly = trimmed.split(/\s+/)[0];
          if (nameOnly.length >= 2) {
            parsed[currentShift].secondary.push(nameOnly);
          }
        }
      });
      return;
    }

    // 尝试匹配子表名（支持冒号分隔和空格分隔）
    const colonMatch = cleanLine.match(/^(.+?)[：:]\s*(.+)$/);
    if (colonMatch) {
      const key = colonMatch[1].trim();
      const value = colonMatch[2].trim();
      if (value) {
        // 模糊匹配子表名（更宽松的匹配）
        const matchedSheet = fuzzyMatchSheet(key, regularSheets);
        if (matchedSheet) {
          // 提取第一个名字（可能是2-4个中文字符），过滤掉平台名等非人名
          const firstName = value.split(/[、,，\s]+/)[0].trim();
          if (firstName && !isNonPersonName(firstName)) {
            parsed[currentShift].sheetDuty[matchedSheet] = firstName;
          }
        } else if (/辅\s*助|助\s*班/.test(key)) {
          const names = value.split(/[、,，\s]+/).filter(n => n.trim() && n.trim().length >= 2);
          names.forEach(name => {
            const trimmed = name.trim();
            if (trimmed) parsed[currentShift].secondary.push(trimmed);
          });
        }
      }
      return;
    }

    // 尝试无冒号格式：子表名 + 空格 + 人名
    const matchedSheet = fuzzyMatchSheet(cleanLine, regularSheets);
    if (matchedSheet) {
      // 去除子表名后提取人名
      let remaining = cleanLine;
      const sheetClean = matchedSheet.replace(/[🌟📦✅]/g, '').trim();
      remaining = remaining.replace(new RegExp(sheetClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
      remaining = remaining.replace(/[/+＋\s主值班人：:、，,]+/g, ' ').trim();
      // 提取2-4字中文名，过滤掉平台名等非人名
      const nameMatch = remaining.match(/[\u4e00-\u9fa5]{2,4}/);
      if (nameMatch && !isNonPersonName(nameMatch[0])) {
        parsed[currentShift].sheetDuty[matchedSheet] = nameMatch[0];
      }
      return;
    }

    // 尝试从行中提取已知人名
    if (knownNames.size > 0) {
      const foundNames = [];
      knownNames.forEach(name => {
        if (cleanLine.includes(name)) {
          foundNames.push(name);
        }
      });
      if (foundNames.length > 0) {
        // 尝试确定这些名字属于哪个子表
        const sheetMatch = regularSheets.find(s => {
          const sClean = s.replace(/[🌟📦✅]/g, '').trim();
          return cleanLine.includes(sClean) || cleanLine.includes(sClean.replace(/[/+＋]/g, ''));
        });
        if (sheetMatch && !parsed[currentShift].sheetDuty[sheetMatch]) {
          parsed[currentShift].sheetDuty[sheetMatch] = foundNames[0];
        } else {
          // 无法确定子表，作为辅助人员
          foundNames.forEach(name => {
            if (!parsed[currentShift].secondary.includes(name)) {
              parsed[currentShift].secondary.push(name);
            }
          });
        }
      }
    }
  });

  // ===== 周排班表格式解析 =====
  // 处理 "周一：刘茜" "周三：宋诗" "周五：李红" 等格式
  // 以及 "8.3周二：xxx" "8.7周五：李红" 等带日期的格式
  const weekDayMap = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0 };
  const today = new Date();
  const todayWeekDay = today.getDay();

  mergedLines.forEach(line => {
    const cleanLine = line.replace(/[_.…·•°]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanLine) return;

    // 匹配 "周X：人名" 或 "周X 人名" 格式
    const weekMatch = cleanLine.match(/周[一二三四五六日]\s*[：:]\s*([\u4e00-\u9fa5]{2,4})/);
    if (weekMatch) {
      const weekKey = cleanLine.match(/周[一二三四五六日]/)[0];
      const name = weekMatch[1];
      const weekDayNum = weekDayMap[weekKey];

      // 过滤掉平台名等非人名
      if (isNonPersonName(name)) return;

      // 如果是今天的班次，直接填入
      if (weekDayNum === todayWeekDay) {
        // 尝试确定该人属于哪个子表
        const sheetMatch = regularSheets.find(s => {
          const sClean = s.replace(/[🌟📦✅]/g, '').trim();
          return cleanLine.includes(sClean) || cleanLine.includes(sClean.replace(/[/+＋]/g, ''));
        });

        // 如果行中有班次信息
        if (/早\s*班/.test(cleanLine) && !currentShift) {
          // 早班
          if (sheetMatch) {
            parsed.morning.sheetDuty[sheetMatch] = name;
          } else {
            if (!parsed.morning.secondary.includes(name)) {
              parsed.morning.secondary.push(name);
            }
          }
        } else if (/晚\s*班/.test(cleanLine)) {
          if (sheetMatch) {
            parsed.evening.sheetDuty[sheetMatch] = name;
          } else {
            if (!parsed.evening.secondary.includes(name)) {
              parsed.evening.secondary.push(name);
            }
          }
        } else {
          // 没有明确班次，默认早班
          if (sheetMatch) {
            parsed.morning.sheetDuty[sheetMatch] = name;
          } else {
            if (!parsed.morning.secondary.includes(name)) {
              parsed.morning.secondary.push(name);
            }
          }
        }
      }
      return;
    }

    // 匹配 "8.3周二：xxx" 或 "8.7周五：xxx" 带日期的格式
    const dateWeekMatch = cleanLine.match(/(\d{1,2})\.(\d{1,2})\s*周[一二三四五六日]\s*[：:]\s*([\u4e00-\u9fa5]{2,4})/);
    if (dateWeekMatch) {
      const month = parseInt(dateWeekMatch[1]);
      const day = parseInt(dateWeekMatch[2]);
      const name = dateWeekMatch[3];
      const weekKey = cleanLine.match(/周[一二三四五六日]/)[0];
      const weekDayNum = weekDayMap[weekKey];

      // 判断是否是今天
      const isToday = (month === today.getMonth() + 1 && day === today.getDate());
      if (isToday || weekDayNum === todayWeekDay) {
        // 尝试确定子表
        const sheetMatch = regularSheets.find(s => {
          const sClean = s.replace(/[🌟📦✅]/g, '').trim();
          return cleanLine.includes(sClean) || cleanLine.includes(sClean.replace(/[/+＋]/g, ''));
        });

        if (sheetMatch) {
          parsed.morning.sheetDuty[sheetMatch] = name;
        } else {
          if (!parsed.morning.secondary.includes(name)) {
            parsed.morning.secondary.push(name);
          }
        }
      }
      return;
    }
  });

  // ===== 全文扫描已知人名作为最后兜底 =====
  // 不管之前解析到了什么，都扫描全文提取已知人名
  if (knownNames.size > 0) {
    const fullText = mergedLines.join(' ');
    
    // 找到"排休"关键词在全文中的位置区间
    let restSectionStart = -1;
    let restSectionEnd = fullText.length;
    for (let i = 0; i < mergedLines.length; i++) {
      if (/排\s*休|休\s*息/.test(mergedLines[i])) {
        restSectionStart = fullText.indexOf(mergedLines[i]);
        // 找到排休区域结束位置（下一个班次关键词）
        for (let j = i + 1; j < mergedLines.length; j++) {
          if (/早\s*班|晚\s*班|通\s*班|辅\s*助/.test(mergedLines[j])) {
            restSectionEnd = fullText.indexOf(mergedLines[j]);
            break;
          }
        }
        break;
      }
    }

    const foundInText = [];
    knownNames.forEach(name => {
      if (fullText.includes(name)) {
        foundInText.push(name);
      }
    });

    // 将找到的已知人名分配到对应位置
    foundInText.forEach(name => {
      // 如果该人已在排休列表中，跳过
      if (parsed.rest.includes(name)) return;
      // 如果已在早班或晚班子表主值班中，跳过
      if (Object.values(parsed.morning.sheetDuty).includes(name)) return;
      if (Object.values(parsed.evening.sheetDuty).includes(name)) return;
      // 如果已在辅助中，跳过
      if (parsed.morning.secondary.includes(name)) return;
      if (parsed.evening.secondary.includes(name)) return;

      // 检查该人名是否出现在"排休"区域
      if (restSectionStart >= 0) {
        const namePos = fullText.indexOf(name);
        if (namePos >= restSectionStart && namePos < restSectionEnd) {
          // 该人名在排休区域，放入排休
          parsed.rest.push(name);
          return;
        }
      }

      // 默认放入早班辅助
      parsed.morning.secondary.push(name);
    });
  }

  // ===== 额外排休检测：扫描全文中的"排休""休息""OFF"等关键词附近的人名 =====
  const fullTextForRest = mergedLines.join('\n');
  // 找到"排休"或"休息"关键词，提取其后的所有人名
  const restMatch = fullTextForRest.match(/(?:排休|休息|OFF|off)\s*[：:]?\s*([^\n]*)/);
  if (restMatch) {
    const restPart = restMatch[1];
    // 尝试匹配2-4字中文名
    const restNames = restPart.match(/[\u4e00-\u9fa5]{2,4}/g);
    if (restNames) {
      restNames.forEach(name => {
        if (!parsed.rest.includes(name) && name.length >= 2 && name.length <= 4) {
          // 验证不是常见非人名词汇
          if (!/^(排休|休息|辅助|值班|早班|晚班|通班|周一|周二|周三|周四|周五|周六|周日|字节|快手|小红书|视频|坐标|生活|暂停|回声|频率|娱乐|番茄|小歪|果子|小圆子|野生|贝壳|小润|小赵)$/.test(name)) {
            parsed.rest.push(name);
          }
        }
      });
    }
  }

  // ===== 全局人名纠错后处理 =====
  // 对解析出的所有人名进行 OCR 错字纠正
  const correctedSheetDutyMorning = {};
  Object.entries(parsed.morning.sheetDuty).forEach(([sheet, name]) => {
    correctedSheetDutyMorning[sheet] = correctPersonName(name, knownNames);
  });
  parsed.morning.sheetDuty = correctedSheetDutyMorning;
  parsed.morning.secondary = parsed.morning.secondary.map(n => correctPersonName(n, knownNames));
  parsed.morning.substitutes = (parsed.morning.substitutes || []).map(sub => ({
    ...sub,
    person: correctPersonName(sub.person, knownNames)
  }));

  const correctedSheetDutyEvening = {};
  Object.entries(parsed.evening.sheetDuty).forEach(([sheet, name]) => {
    correctedSheetDutyEvening[sheet] = correctPersonName(name, knownNames);
  });
  parsed.evening.sheetDuty = correctedSheetDutyEvening;
  parsed.evening.secondary = parsed.evening.secondary.map(n => correctPersonName(n, knownNames));
  parsed.evening.substitutes = (parsed.evening.substitutes || []).map(sub => ({
    ...sub,
    person: correctPersonName(sub.person, knownNames)
  }));

  parsed.rest = parsed.rest.map(n => correctPersonName(n, knownNames));

  // 去重（纠错后可能产生重复）
  parsed.morning.secondary = [...new Set(parsed.morning.secondary)];
  parsed.evening.secondary = [...new Set(parsed.evening.secondary)];
  parsed.rest = [...new Set(parsed.rest)];

  // 应用解析结果到 scheduleData
  if (Object.keys(parsed.morning.sheetDuty).length > 0 || parsed.morning.secondary.length > 0) {
    scheduleData.morning.sheetDuty = { ...scheduleData.morning.sheetDuty, ...parsed.morning.sheetDuty };
    scheduleData.morning.secondary = [...new Set([...scheduleData.morning.secondary, ...parsed.morning.secondary])];
    if (parsed.morning.substitutes && parsed.morning.substitutes.length > 0) {
      scheduleData.morning.substitutes = [...parsed.morning.substitutes];
    }
  }
  if (Object.keys(parsed.evening.sheetDuty).length > 0 || parsed.evening.secondary.length > 0) {
    scheduleData.evening.sheetDuty = { ...scheduleData.evening.sheetDuty, ...parsed.evening.sheetDuty };
    scheduleData.evening.secondary = [...new Set([...scheduleData.evening.secondary, ...parsed.evening.secondary])];
    if (parsed.evening.substitutes && parsed.evening.substitutes.length > 0) {
      scheduleData.evening.substitutes = [...parsed.evening.substitutes];
    }
  }
  if (parsed.rest.length > 0) {
    scheduleData.rest = [...new Set([...scheduleData.rest, ...parsed.rest])];
  }

  return parsed;
}

// 模糊匹配子表名：处理 OCR 识别中的空格、错字等问题
function fuzzyMatchSheet(text, sheets) {
  if (!text || !sheets) return null;
  // 去除emoji和特殊字符
  const textClean = text.replace(/[🌟📦✅_.…·•°\s]+/g, '').replace(/[:：]/g, '');

  for (const s of sheets) {
    const sClean = s.replace(/[🌟📦✅]/g, '').trim();
    const sNoSpace = sClean.replace(/[/+＋\s]/g, '');

    // 精确匹配
    if (textClean.includes(sClean) || sClean.includes(textClean)) return s;
    // 去掉分隔符后匹配
    if (textClean.includes(sNoSpace) || sNoSpace.includes(textClean)) return s;

    // 模糊匹配：子表名的每个关键词都出现在文本中
    const keywords = sClean.split(/[/+＋\s]+/).filter(k => k.length >= 2);
    if (keywords.length >= 2) {
      const allFound = keywords.every(kw => {
        // 允许中间有一个字符的差异
        const textNoSpace = textClean.replace(/\s/g, '');
        return textNoSpace.includes(kw) || fuzzyIncludes(textNoSpace, kw);
      });
      if (allFound) return s;
    }

    // 单关键词子表（如"小红书""字节单"）
    if (keywords.length === 1 && keywords[0].length >= 2) {
      if (fuzzyIncludes(textClean.replace(/\s/g, ''), keywords[0])) return s;
    }
  }
  return null;
}

// 模糊包含检查：允许1个字符的差异
function fuzzyIncludes(text, keyword) {
  if (!text || !keyword) return false;
  if (text.includes(keyword)) return true;
  // 尝试 keyword 的每个字符是否按顺序出现在 text 中（允许中间隔1个字符）
  let idx = 0;
  for (let i = 0; i < text.length && idx < keyword.length; i++) {
    if (text[i] === keyword[idx]) {
      idx++;
    } else if (idx > 0 && text[i] !== keyword[idx]) {
      // 允许1个字符的跳过
      if (i + 1 < text.length && text[i + 1] === keyword[idx]) {
        continue;
      }
    }
  }
  return idx >= keyword.length - 1; // 允许最后1个字符未匹配
}

// OCR 识别后的文本清洗：去除多余空行、修复常见识别错误
function cleanOcrText(rawText) {
  if (!rawText) return '';
  let text = rawText;
  // 统一换行符
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // 去除每行首尾多余空格
  text = text.split('\n').map(l => l.trim()).join('\n');
  // 合并连续空行为一个
  text = text.replace(/\n{3,}/g, '\n\n');
  // 常见 OCR 错误修正：全角冒号变体统一
  text = text.replace(/[:﹕]/g, '：');
  // 去除常见 OCR 噪音字符（下划线、省略号、点号等）
  text = text.replace(/[_.…·•°]{2,}/g, ' ');
  // 修复"快手+ 视频号"被拆分为"快手+ 视频号"的情况
  text = text.replace(/快手\s*\+\s*视频号/g, '快手+视频号');
  text = text.replace(/快手\s*\+\s*视频/g, '快手+视频');
  // 修复"字节单"被识别为"字节 节"等
  text = text.replace(/字节\s*节/g, '字节');
  // 修复"小红书"被插入空格
  text = text.replace(/小\s*红\s*书/g, '小红书');
  // 修复"在坐标这边生活"被拆分
  text = text.replace(/在\s*坐\s*标/g, '在坐标');
  // 修复"排休"被识别为"排 体"或"排林"等
  text = text.replace(/排\s*体/g, '排休');
  text = text.replace(/排\s*林/g, '排休');
  // 修复"辅助"被识别为"辅 助"等
  text = text.replace(/辅\s*助/g, '辅助');
  // 修复"早班"被识别为"早 班"等
  text = text.replace(/早\s*班/g, '早班');
  text = text.replace(/晚\s*班/g, '晚班');
  text = text.replace(/通\s*班/g, '通班');
  // 修复"值班"被识别为"值 班"等
  text = text.replace(/值\s*班/g, '值班');
  // 去除行内多余空格（但保留中文间必要的空格）
  text = text.split('\n').map(l => l.replace(/[ \t]{2,}/g, ' ')).join('\n');
  return text.trim();
}

// OCR 人名预纠错：在解析前直接替换文本中的错字人名
// 扫描文本中所有2-4字中文片段，如果与已知人名的编辑距离<=1则替换
function preCorrectOcrNames(text) {
  if (!text) return text;
  const staffList = getStaffList();
  const knownNames = new Set([...staffList, ...ALL_STAFF]);
  const corrections = []; // 记录纠错日志

  // 对文本中每个2-4字中文片段尝试纠错
  const corrected = text.replace(/[\u4e00-\u9fa5]{2,4}/g, (match) => {
    // 精确匹配，无需纠正
    if (knownNames.has(match)) return match;

    // 尝试逐字混淆纠正
    const correctedChars = [];
    for (const ch of match) {
      correctedChars.push(OCR_CHAR_CONFUSION[ch] || ch);
    }
    const confusionCorrected = correctedChars.join('');
    if (knownNames.has(confusionCorrected)) {
      corrections.push(`${match} → ${confusionCorrected}`);
      return confusionCorrected;
    }

    // 编辑距离匹配
    let bestMatch = null;
    let minDist = Infinity;
    knownNames.forEach(name => {
      if (Math.abs(name.length - match.length) > 1) return;
      const dist = levenshteinDistance(match, name);
      if (dist < minDist) {
        minDist = dist;
        bestMatch = name;
      }
      const dist2 = levenshteinDistance(confusionCorrected, name);
      if (dist2 < minDist) {
        minDist = dist2;
        bestMatch = name;
      }
    });

    // 仅当编辑距离<=1时纠正（避免过度纠正）
    if (bestMatch && minDist <= 1 && bestMatch !== match) {
      corrections.push(`${match} → ${bestMatch}`);
      return bestMatch;
    }

    return match;
  });

  // 在控制台输出纠错日志（方便调试）
  if (corrections.length > 0) {
    console.log('🔍 OCR人名预纠错:', corrections);
  }

  return corrected;
}

async function handleScheduleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 检查 Tesseract.js 是否加载成功
  if (typeof Tesseract === 'undefined') {
    showToast('OCR 引擎加载失败，请检查网络后刷新页面重试', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const imageDataUrl = e.target.result;
    const preview = document.getElementById('schedule-image-preview');
    const previewArea = document.getElementById('schedule-image-preview-area');
    if (preview && previewArea) {
      preview.src = imageDataUrl;
      previewArea.style.display = 'block';
    }

    // 显示 OCR 进度区域
    const ocrProgress = document.getElementById('schedule-ocr-progress');
    const ocrResultArea = document.getElementById('schedule-ocr-result-area');
    const ocrBar = document.getElementById('schedule-ocr-bar');
    const ocrPercent = document.getElementById('schedule-ocr-percent');
    const ocrStatus = document.getElementById('schedule-ocr-status');

    if (ocrProgress) ocrProgress.style.display = 'block';
    if (ocrResultArea) ocrResultArea.style.display = 'none';
    if (ocrBar) ocrBar.style.width = '0%';
    if (ocrPercent) ocrPercent.textContent = '0%';
    if (ocrStatus) ocrStatus.textContent = '正在加载识别引擎...';

    try {
      // 使用 Tesseract.js 进行 OCR 识别（中英文）
      const result = await Tesseract.recognize(imageDataUrl, 'chi_sim+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            if (ocrBar) ocrBar.style.width = pct + '%';
            if (ocrPercent) ocrPercent.textContent = pct + '%';
            if (ocrStatus) ocrStatus.textContent = '正在识别图片文字...';
          } else if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
            if (ocrStatus) ocrStatus.textContent = '正在加载识别引擎...';
          } else if (m.status === 'loading language traineddata') {
            if (ocrStatus) ocrStatus.textContent = '正在加载中文语言包...';
          } else if (m.status === 'initializing api') {
            if (ocrStatus) ocrStatus.textContent = '正在初始化识别接口...';
          }
        }
      });

      const rawText = result.data.text || '';
      const cleanedText = cleanOcrText(rawText);
      // 人名预纠错：根据可排班人员名单自动修正OCR错字
      const correctedText = preCorrectOcrNames(cleanedText);

      // 隐藏进度区域
      if (ocrProgress) ocrProgress.style.display = 'none';

      // 将识别结果填入可编辑文本框（供失败时修正）
      const ocrTextEl = document.getElementById('schedule-ocr-text');
      if (ocrTextEl) {
        ocrTextEl.value = correctedText;
      }

      // 如果有纠错，提示用户
      if (correctedText !== cleanedText) {
        showToast('🔍 已根据人员名单自动纠正OCR识别中的错字', 'success');
      }

      if (correctedText.length < 5) {
        if (ocrResultArea) ocrResultArea.style.display = 'block';
        if (ocrStatus) ocrStatus.textContent = '识别内容较少，请检查图片是否清晰';
        showToast('识别内容较少，请尝试上传更清晰的图片', 'warning');
        return;
      }

      // 自动解析并填充排班（无需手动点击按钮）
      if (ocrStatus) ocrStatus.textContent = '正在自动解析排班信息...';
      if (ocrProgress) {
        ocrProgress.style.display = 'block';
        if (ocrBar) ocrBar.style.width = '100%';
        if (ocrPercent) ocrPercent.textContent = '100%';
      }

      try {
        const parsed = parseScheduleContent(correctedText);
        const morningCount = Object.keys(parsed.morning.sheetDuty).length;
        const eveningCount = Object.keys(parsed.evening.sheetDuty).length;
        const restCount = parsed.rest.length;
        const secMorningCount = parsed.morning.secondary.length;
        const secEveningCount = parsed.evening.secondary.length;
        const totalParsed = morningCount + eveningCount + restCount + secMorningCount + secEveningCount;

        if (totalParsed > 0) {
          // 解析成功，直接填充并关闭弹窗
          if (ocrProgress) ocrProgress.style.display = 'none';
          if (ocrResultArea) ocrResultArea.style.display = 'none';
          openScheduleModal();
          saveScheduleData();
          showToast(`排班自动识别成功！早班${morningCount}个子表，晚班${eveningCount}个子表，排休${restCount}人`, 'success');
        } else {
          // 解析失败，显示可编辑文本供手动修正
          if (ocrProgress) ocrProgress.style.display = 'none';
          if (ocrResultArea) ocrResultArea.style.display = 'block';
          if (ocrStatus) ocrStatus.textContent = '自动解析未成功，请修正识别文本后点击下方按钮';
          showToast('自动解析未识别出排班信息，请修正文本后点击「解析并填充排班」', 'warning');
        }
      } catch (parseErr) {
        console.error('自动解析失败:', parseErr);
        if (ocrProgress) ocrProgress.style.display = 'none';
        if (ocrResultArea) ocrResultArea.style.display = 'block';
        if (ocrStatus) ocrStatus.textContent = '解析异常，请修正识别文本后点击下方按钮';
        showToast('自动解析异常，请修正文本后手动解析', 'warning');
      }
    } catch (err) {
      console.error('OCR 识别失败:', err);
      if (ocrProgress) ocrProgress.style.display = 'none';
      if (ocrResultArea) ocrResultArea.style.display = 'block';
      const ocrTextEl = document.getElementById('schedule-ocr-text');
      if (ocrTextEl) {
        ocrTextEl.value = '';
        ocrTextEl.placeholder = 'OCR 识别失败，请手动输入排班信息或重新上传更清晰的图片...';
      }
      showToast('图片识别失败：' + (err.message || '未知错误') + '，可手动输入或使用文本粘贴模式', 'error');
    }
  };
  reader.readAsDataURL(file);
}

function clearScheduleImage() {
  const input = document.getElementById('schedule-image-input');
  const preview = document.getElementById('schedule-image-preview');
  const previewArea = document.getElementById('schedule-image-preview-area');
  const ocrProgress = document.getElementById('schedule-ocr-progress');
  const ocrResultArea = document.getElementById('schedule-ocr-result-area');
  const ocrText = document.getElementById('schedule-ocr-text');
  if (input) input.value = '';
  if (preview) preview.src = '';
  if (previewArea) previewArea.style.display = 'none';
  if (ocrProgress) ocrProgress.style.display = 'none';
  if (ocrResultArea) ocrResultArea.style.display = 'none';
  if (ocrText) ocrText.value = '';
}

// OCR 识别结果应用到排班表单
function applyOcrResult() {
  const rawText = document.getElementById('schedule-ocr-text')?.value.trim();
  if (!rawText) {
    showToast('识别结果为空，请先上传图片进行识别或手动输入', 'error');
    return;
  }

  // 预纠错人名
  const text = preCorrectOcrNames(rawText);

  try {
    const parsed = parseScheduleContent(text);
    const morningCount = Object.keys(parsed.morning.sheetDuty).length;
    const eveningCount = Object.keys(parsed.evening.sheetDuty).length;
    const restCount = parsed.rest.length;

    if (morningCount === 0 && eveningCount === 0 && restCount === 0 && parsed.morning.secondary.length === 0 && parsed.evening.secondary.length === 0) {
      showToast('未能从识别结果中解析出排班信息，请手动修正识别文本后重试', 'warning');
      return;
    }

    openScheduleModal();
    saveScheduleData();
    showToast(`排班数据解析成功！早班${morningCount}个子表，晚班${eveningCount}个子表，排休${restCount}人`);
  } catch (err) {
    console.error('OCR 结果解析失败:', err);
    showToast('解析失败：' + err.message, 'error');
  }
}

function parseScheduleText() {
  const rawText = document.getElementById('schedule-smart-text').value.trim();
  if (!rawText) {
    showToast('请输入排班文本内容', 'error');
    return;
  }

  // 预纠错人名
  const text = preCorrectOcrNames(rawText);

  try {
    const parsed = parseScheduleContent(text);
    openScheduleModal();
    saveScheduleData();
    showToast(`排班数据解析成功，早班${Object.keys(parsed.morning.sheetDuty).length}个子表，晚班${Object.keys(parsed.evening.sheetDuty).length}个子表，排休${parsed.rest.length}人`);
  } catch (err) {
    console.error('排班解析失败:', err);
    showToast('解析失败：' + err.message, 'error');
  }
}

// ===== Smart Entry: Field keyword mapping =====
const FIELD_KEYWORDS = {
  name: ['项目名', '项目名称', '项目/品牌名', '品牌名', '项目', '项目名/品牌', 'campaign', '商单名', '项目标题'],
  business: ['销售', '商务', '下单人', '商务对接', '销售人员', '对接销售', '销售人', 'sale', 'bd'],
  platform: ['平台', '投放平台', '发布平台', '渠道', '投放渠道'],
  account: ['账号', '投放账号', '账号名', '投放账号名', '账号列表', '发布账号', '达人', '达人账号', 'koc', 'kol'],
  title: ['标题', '剧名', '剧本', '剧集'],
  topicDirection: ['话题词', '话题', '方向', '话题词+方向', '话题词＋方向', '内容方向', '视频方向'],
  link: ['链接', 'bf', '素材链接', '发布链接', '网盘', '网盘链接', '素材', '蓝湖', '文档链接', '预览链接'],
  orderType: ['订单类型', '投放形式', '形式', '合作形式', '商单类型', '类型'],
  assignee: ['接单人', '执行人', '执行', '负责人', '接单', '对接人'],
  date: ['日期', '接单日期', '下单日期', '开始日期'],
  publishDate: ['发布时间', '发布日期', '上线时间', '上线日期', '档期'],
  ddl: ['ddl', '截止', '截止时间', 'deadline', '截稿'],
  remark: ['备注', '说明', '注意', '其他', '补充', '附注', '要求', '特殊要求'],
  duration: ['时长', '视频时长', '时长要求', '秒数'],
  instruction: ['指令', '任务', '需求', '操作', '待办']
};

const KEYWORD_INDEX = {};
Object.entries(FIELD_KEYWORDS).forEach(([field, words]) => {
  words.forEach(w => {
    KEYWORD_INDEX[w.toLowerCase().replace(/[\s/+＋]/g, '')] = field;
  });
});

const SORTED_KEYWORDS = Object.keys(KEYWORD_INDEX).sort((a, b) => b.length - a.length);

// ===== Sheet predefined accounts =====
// 每个子表对应的预设账号列表，智能录入时若输入文本中未检测到账号，则自动使用对应子表的预设账号
const SHEET_ACCOUNTS = {
  '快手+视频号': [
    '巨星火火', '小柴爆米花', '是剧剧呀', '半知名观众花花', '青柠娱乐家',
    '娱乐狸花酱', '摸娱妙妙屋', '野生娱乐家', '青柠甜猫酱', '娱乐家',
    '巨星哈士奇', '娱乐喵呜酱', '半行家八妹', '桃桃大小姐', '一只狂花',
    '会火群像', '巨星花栗鼠', '你好我又嗑到了', '小赵不是小灶', '退役娱乐圈顶流',
    '娱乐番茄酱', '会火大明星', '会火全娱乐', '颜究生小圆子', '江南娱乐家',
    '会火剧好嗑', '暴走铜锣烧', '甜酒小耶', '尤可妮妮'
  ]
};

// ===== 全格式账号识别 =====
// 构建全局已知账号库（所有子表的预设账号合集），按长度降序排列以实现贪心匹配
const ALL_KNOWN_ACCOUNTS = (() => {
  const set = new Set();
  Object.values(SHEET_ACCOUNTS).forEach(list => {
    list.forEach(acc => set.add(acc));
  });
  return [...set].sort((a, b) => b.length - a.length);
})();

// ===== 账号简称-全称映射（双分子表独立隔离） =====
// 两套子表各有独立的映射库，规则互相隔离，禁止跨子表混用匹配
const ALIAS_SHEET_NAMES = [
  '🌟娱乐社+八妹+番茄+小歪+果子',
  '🌟小圆子+野生+贝壳+小涡+小赵'
];

// 默认映射配置（可被 localStorage 中的用户自定义覆盖）
const DEFAULT_ACCOUNT_ALIAS_MAPS = {
  '🌟娱乐社+八妹+番茄+小歪+果子': {
    '娱乐社': '会火娱乐社',
    '番茄': '娱乐番茄酱',
    '八妹': '半行家八妹',
    '小歪': '小歪都懂点',
    '果子': '糖油果子'
  },
  '🌟小圆子+野生+贝壳+小涡+小赵': {
    '小圆子': '颜究生小圆子',
    '野生': '野生娱乐家',
    '贝壳': '贝壳街网管',
    '小涡': '小涡都懂点',
    '小赵': '小赵'
  }
};

// 从 localStorage 加载用户自定义映射，合并到默认配置
const ACCOUNT_ALIAS_CONFIG_KEY = 'accountAliasMaps_v1';
let ACCOUNT_ALIAS_MAPS = (() => {
  try {
    const saved = localStorage.getItem(ACCOUNT_ALIAS_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 确保两个子表都存在
      const merged = {};
      ALIAS_SHEET_NAMES.forEach(sheet => {
        merged[sheet] = parsed[sheet] || { ...DEFAULT_ACCOUNT_ALIAS_MAPS[sheet] };
      });
      return merged;
    }
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_ACCOUNT_ALIAS_MAPS));
})();

// 排他规则：特定简称在满足条件时不命中（仅在该子表生效，固定规则不可编辑）
// 例：子表2的「小赵」→ 文本包含「小灶」时不命中
const ACCOUNT_EXCLUSION_RULES = {
  '🌟小圆子+野生+贝壳+小涡+小赵': {
    '小赵': (input) => input.includes('小灶')
  }
};

function isAliasSheet(sheetName) {
  return ALIAS_SHEET_NAMES.includes(sheetName);
}

// 获取指定子表的映射表（不存在返回 null）
function getAliasMapForSheet(sheetName) {
  return ACCOUNT_ALIAS_MAPS[sheetName] || null;
}

// 指定子表的全称集合和关键词索引（可重建）
let ACCOUNT_FULL_NAMES_BY_SHEET = {};
let ACCOUNT_ALIAS_KEYWORDS_BY_SHEET = {};

// 重建派生数据（映射表变更后调用）
function rebuildAliasDerivedData() {
  ACCOUNT_FULL_NAMES_BY_SHEET = {};
  ACCOUNT_ALIAS_KEYWORDS_BY_SHEET = {};
  Object.entries(ACCOUNT_ALIAS_MAPS).forEach(([sheet, map]) => {
    ACCOUNT_FULL_NAMES_BY_SHEET[sheet] = new Set(Object.values(map));
    const keywordMap = {};
    Object.entries(map).forEach(([alias, fullName]) => {
      keywordMap[normalizeForSearch(alias)] = fullName;
      keywordMap[normalizeForSearch(fullName)] = fullName;
    });
    ACCOUNT_ALIAS_KEYWORDS_BY_SHEET[sheet] = keywordMap;
  });
}
rebuildAliasDerivedData();

// 账号简称自动补全：根据子表加载对应映射，返回完整账号名，未匹配返回 null
function expandAccountAlias(input, sheetName) {
  if (!input) return null;
  const map = getAliasMapForSheet(sheetName);
  if (!map) return null;

  const fullNames = ACCOUNT_FULL_NAMES_BY_SHEET[sheetName];
  const keywords = ACCOUNT_ALIAS_KEYWORDS_BY_SHEET[sheetName];
  const exclusions = ACCOUNT_EXCLUSION_RULES[sheetName] || {};
  const trimmed = input.trim();

  // 排他规则检查：命中排他条件则直接返回 null
  for (const [alias, checkFn] of Object.entries(exclusions)) {
    if (input.includes(alias) && checkFn(input)) return null;
  }

  // 已是完整名称，无需补全
  if (fullNames.has(trimmed)) return trimmed;
  // 精准匹配简称
  if (map[trimmed]) return map[trimmed];
  // 标准化后精准匹配
  const normalized = normalizeForSearch(input);
  if (!normalized) return null;
  if (keywords[normalized]) return keywords[normalized];
  // 模糊匹配：输入包含简称关键词或全称包含输入
  for (const [key, fullName] of Object.entries(keywords)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      // 模糊匹配也需检查排他规则
      for (const [alias, checkFn] of Object.entries(exclusions)) {
        if (fullName === map[alias] && checkFn(input)) return null;
      }
      return fullName;
    }
  }
  return null;
}

// 批量账号补全：按子表逐个识别简称，返回 { results, unmatched }
function batchExpandAccountAliases(accounts, sheetName) {
  const results = [];
  const unmatched = [];
  const fullNames = ACCOUNT_FULL_NAMES_BY_SHEET[sheetName] || new Set();
  accounts.forEach(acc => {
    const expanded = expandAccountAlias(acc, sheetName);
    if (expanded && expanded !== acc) {
      results.push(expanded);
    } else if (expanded === acc) {
      // 已是全称
      results.push(acc);
    } else {
      // 尝试是否本身就是已知全称
      if (fullNames.has(acc.trim()) || ALL_KNOWN_ACCOUNTS.includes(acc.trim())) {
        results.push(acc.trim());
      } else {
        results.push(acc); // 保留原文
        unmatched.push(acc);
      }
    }
  });
  return { results, unmatched };
}

// 从任意文本中扫描已知账号名（含所有子表的预设账号和映射全称），返回按出现顺序排列的去重列表
function scanForKnownAccounts(text) {
  if (!text) return [];
  const found = [];
  const foundSet = new Set();
  // 合并 SHEET_ACCOUNTS 中的已知账号和所有子表映射的全称
  const allAccounts = new Set(ALL_KNOWN_ACCOUNTS);
  Object.values(ACCOUNT_ALIAS_MAPS).forEach(map => {
    Object.values(map).forEach(fullName => allAccounts.add(fullName));
  });
  // 按长度降序排列，优先匹配长名称（避免"小赵"误匹配"小赵不是小灶"中的部分）
  const sortedAccounts = [...allAccounts].sort((a, b) => b.length - a.length);
  for (const acc of sortedAccounts) {
    if (text.includes(acc) && !foundSet.has(acc)) {
      found.push(acc);
      foundSet.add(acc);
    }
  }
  return found;
}

// 竖线分隔格式解析器
// 处理如 "快手 向山而唱 | 快手专项 李希平 | xxx 水下单 | 小赵不是小灶 | 赵海琼" 的格式
function parsePipeSeparatedText(text) {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

  // 合并换行折行的文本：以平台名开头的行作为新条目起始，其余行追加到当前条目
  const platformPattern = /^(快手|抖音|小红书|视频号|字节|B站|bilibili)/i;
  const entries = [];
  let currentEntry = '';

  for (const line of rawLines) {
    if (platformPattern.test(line)) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = line;
    } else {
      currentEntry += line;
    }
  }
  if (currentEntry) entries.push(currentEntry);

  // 如果没有检测到竖线分隔，返回 null 表示不是此格式
  if (!entries.some(e => e.includes('|'))) return null;

  const projects = [];

  for (const entry of entries) {
    const segments = entry.split('|').map(s => s.trim()).filter(s => s);
    if (segments.length === 0) continue;

    let platform = '';
    let name = '';
    let business = '';
    let orderType = '';
    let assignee = '';
    let title = '';
    const foundAccounts = [];

    segments.forEach(seg => {
      // 提取平台和项目名（第一个包含平台名的段）
      if (!platform) {
        const pm = seg.match(/^(快手|抖音|小红书|视频号|字节|B站)\s*(.*)/);
        if (pm) {
          platform = pm[1];
          name = pm[2].trim();
        }
      }

      // 提取商务/下单人（包含"专项""销售""商务"的段）
      if (/专项|销售|商务/.test(seg) && !business) {
        const parts = seg.split(/\s+/).filter(p => p);
        business = parts.find(p => p && !/专项|销售|商务/.test(p)) || '';
      }

      // 提取订单类型
      if (/水下单/.test(seg)) orderType = '娱乐水下单';
      if (/互选/.test(seg)) {
        orderType = /60s?\+|60s?以上/.test(seg) ? '互选60s+' : '互选60s内';
      }
      if (/星图/.test(seg)) {
        orderType = /60s?\+|60s?以上/.test(seg) ? '星图60S+' : '星图21-60S';
      }
      if (/磁力/.test(seg)) orderType = '快手磁力';
      if (/蒲公英/.test(seg)) orderType = '小红书蒲公英';

      // 提取 hashtag 作为标题
      const ht = seg.match(/#([^\s|#]+)/);
      if (ht && !title) title = ht[1];
    });

    // 从所有段中匹配已知账号名
    const fullEntryText = segments.join(' ');
    foundAccounts.push(...scanForKnownAccounts(fullEntryText));

    // 账号简称自动补全：在配置了映射的子表中扫描文本简称并替换为完整账号名（各子表独立映射）
    const pipeSheet = inferSheet(platform, foundAccounts.join(' '), currentSheet);
    if (isAliasSheet(pipeSheet)) {
      const aliasMap = getAliasMapForSheet(pipeSheet);
      const exclusions = ACCOUNT_EXCLUSION_RULES[pipeSheet] || {};
      segments.forEach(seg => {
        Object.keys(aliasMap).forEach(alias => {
          // 排他规则检查
          if (exclusions[alias] && exclusions[alias](seg)) return;
          if (seg.includes(alias) && !foundAccounts.includes(aliasMap[alias])) {
            foundAccounts.push(aliasMap[alias]);
          }
        });
      });
    }

    // 提取接单人：去除已知账号、关键词后剩余的短中文名
    segments.forEach(seg => {
      let remaining = seg;
      foundAccounts.forEach(acc => { remaining = remaining.split(acc).join(''); });
      remaining = remaining
        .replace(/水下单|专项|快手|抖音|小红书|视频号|字节|B站/g, '')
        .replace(/#[^\s|#]+/g, '')
        .replace(/[|｜]/g, '')
        .replace(/\s+/g, '')
        .trim();

      // 短中文名（2-4字）且不是已知账号、不是商务 → 接单人
      if (/^[\u4e00-\u9fa5]{2,4}$/.test(remaining) && !assignee && remaining !== business) {
        if (!ALL_KNOWN_ACCOUNTS.includes(remaining)) {
          assignee = remaining;
        }
      }
    });

    // 为每个账号生成一条记录
    const sheet = inferSheet(platform, foundAccounts.join(' '), currentSheet);
    foundAccounts.forEach((acc, idx) => {
      projects.push({
        id: `parsed-${projects.length}`,
        sheet: sheet,
        date: getTodayDateString(),
        publishDate: '',
        platform: platform || '',
        account: acc,
        name: name || '',
        status: '脚本制作中',
        title: title || '',
        link: '',
        business: business || '',
        assignee: assignee || '',
        editor: '',
        orderType: orderType || getDefaultOrderType(sheet) || inferOrderType(fullEntryText) || '',
        remark: '',
        _group: '',
        _parsedOrder: projects.length
      });
    });
  }

  if (projects.length === 0) return null;
  return { projects, fields: { platform: projects[0]?.platform, name: projects[0]?.name, business: projects[0]?.business }, rawFields: {}, accountGroups: [], sheet: projects[0]?.sheet || currentSheet };
}

// ===== Smart Entry: Core Parser =====
let parsedProjects = [];

function openSmartModal() {
  els.modalSmart.classList.add('show');
  setTimeout(() => els.smartInput.focus(), 100);
}

function closeSmartModal() {
  els.modalSmart.classList.remove('show');
}

function fillSample() {
  els.smartInput.value = `【项目/品牌名】快手村ai漫剧

【bf】https://docs.qingque.cn/d/home/eZQCC1ZA8k6fNnShTnWFcMOVG?

【销售】李希平

【投放平台】快手

【投放形式】平台水下单

【投放账号】
#龙兽医专治不服
会火、半知名观众花花、青柠娱乐家、巨星哈士奇、娱乐番茄酱

#赵辰宇有事儿他真上
小柴爆米花、会火全娱乐、江南娱乐家、你好我又磕到了、退役娱乐圈顶流

#张老五东北式热心肠
巨星火火、半知名观众花花、会火全娱乐、小赵不是小灶、娱乐番茄酱

【发布时间】bf中

【ddl】20:00

【话题词＋方向】
bf中，视频最后引导观看

【视频时长】45s左右

【素材链接】
bf当中，另外网盘：链接: https://pan.baidu.com/s/1tu2mPpOTWN470Um71YWnVw 提取码: tuve`;
  parseSmartInput();
}

function parseSmartInput() {
  const text = els.smartInput.value.trim();
  if (!text) {
    els.smartResult.innerHTML = `
      <div class="smart-empty">
        <div class="smart-empty-icon">🤖</div>
        <p>粘贴文本后点击「解析」</p>
        <p class="smart-empty-sub">解析器会自动识别字段、展开账号分组</p>
      </div>`;
    els.smartCount.textContent = '0 条';
    els.btnSmartAdd.disabled = true;
    parsedProjects = [];
    return;
  }

  const result = parseProjectText(text);
  parsedProjects = result.projects;

  renderSmartResult(result);
  els.smartCount.textContent = `${parsedProjects.length} 条`;
  els.btnSmartAdd.disabled = parsedProjects.length === 0;
}

function parseProjectText(text) {
  // 格式1: 竖线分隔格式优先处理（如 "快手 向山而唱 | 快手专项 李希平 | xxx 水下单 | 小赵不是小灶 | 赵海琼"）
  if (text.includes('|') || text.includes('｜')) {
    const pipeResult = parsePipeSeparatedText(text);
    if (pipeResult && pipeResult.projects.length > 0) {
      return pipeResult;
    }
  }

  const lines = text.split(/\r?\n/);
  const fields = {};
  const rawFields = {};
  const accountGroups = [];
  let currentAccountGroup = null;
  let currentField = null;
  let inAccountSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentField !== 'account') {
        currentField = null;
        inAccountSection = false;
      }
      continue;
    }

    if (/^#+\s*.+/.test(trimmed) && (inAccountSection || currentField === 'account' || accountGroups.length > 0)) {
      const title = trimmed.replace(/^#+\s*/, '').trim();
      currentAccountGroup = { title, accounts: [] };
      accountGroups.push(currentAccountGroup);
      inAccountSection = true;
      currentField = 'account';
      continue;
    }

    const bracketMatch = trimmed.match(/^(?:【([^】]+)】|\[([^\]]+)\])\s*(.*)$/);
    if (bracketMatch) {
      const rawName = (bracketMatch[1] || bracketMatch[2]).trim();
      const value = bracketMatch[3].trim();
      const field = matchField(rawName);

      if (field === 'account') {
        inAccountSection = true;
        currentField = 'account';
        if (value) {
          const accounts = parseAccounts(value);
          // 如果已有当前分组（由"方向：xxx"创建），追加到该分组；否则新建
          if (currentAccountGroup && currentAccountGroup.title) {
            currentAccountGroup.accounts.push(...accounts);
          } else {
            currentAccountGroup = { title: '', accounts };
            accountGroups.push(currentAccountGroup);
          }
        } else {
          currentAccountGroup = null;
        }
        continue;
      }

      // 在账号区块中遇到"方向"等字段，将其值作为分组标题
      if (inAccountSection && currentField === 'account' && field === 'topicDirection') {
        const keyword = extractGroupKeyword(value);
        currentAccountGroup = { title: keyword, accounts: [] };
        accountGroups.push(currentAccountGroup);
        continue;
      }

      if (field) {
        if (value) {
          fields[field] = (fields[field] ? fields[field] + '\n' : '') + value;
        }
        currentField = field;
        inAccountSection = false;
      } else {
        rawFields[rawName] = value;
        currentField = null;
      }
      continue;
    }

    const colonMatch = trimmed.match(/^([^：:]{1,20})[：:]\s*(.*)$/);
    if (colonMatch) {
      const rawName = colonMatch[1].trim();
      const value = colonMatch[2].trim();
      const field = matchField(rawName);

      if (field === 'account') {
        inAccountSection = true;
        currentField = 'account';
        if (value) {
          const accounts = parseAccounts(value);
          // 如果已有当前分组（由"方向：xxx"创建），追加到该分组；否则新建
          if (currentAccountGroup && currentAccountGroup.title) {
            currentAccountGroup.accounts.push(...accounts);
          } else {
            currentAccountGroup = { title: '', accounts };
            accountGroups.push(currentAccountGroup);
          }
        } else {
          currentAccountGroup = null;
        }
        continue;
      }

      // 在账号区块中遇到"方向：xxx"，将提取的关键词作为分组标题
      if (inAccountSection && currentField === 'account' && field === 'topicDirection') {
        const keyword = extractGroupKeyword(value);
        currentAccountGroup = { title: keyword, accounts: [] };
        accountGroups.push(currentAccountGroup);
        continue;
      }

      // 如果在账号区块中，且匹配到的不是账号字段，但冒号后无值，
      // 则将 rawName 视为账号分组标题（如"方向一：""分组A："）
      if (inAccountSection && currentField === 'account' && field !== 'account' && !value) {
        currentAccountGroup = { title: rawName, accounts: [] };
        accountGroups.push(currentAccountGroup);
        continue;
      }

      if (field) {
        if (value) {
          fields[field] = (fields[field] ? fields[field] + '\n' : '') + value;
        }
        currentField = field;
        inAccountSection = false;
      } else {
        rawFields[rawName] = value;
        currentField = null;
        inAccountSection = false;
      }
      continue;
    }

    if (inAccountSection && currentField === 'account') {
      const accounts = parseAccounts(trimmed);
      if (accounts.length > 0) {
        if (!currentAccountGroup) {
          currentAccountGroup = { title: '', accounts: [] };
          accountGroups.push(currentAccountGroup);
        }
        currentAccountGroup.accounts.push(...accounts);
        continue;
      }
    }

    if (currentField && currentField !== 'account') {
      fields[currentField] = (fields[currentField] ? fields[currentField] + '\n' : '') + trimmed;
    }
  }

  const allLinks = [];
  ['link'].forEach(f => {
    if (fields[f]) allLinks.push(fields[f]);
  });
  Object.entries(rawFields).forEach(([k, v]) => {
    if (v && /https?:\/\//i.test(v) && /link|bf|素材|网盘|链接|蓝湖/i.test(k)) {
      allLinks.push(`[${k}] ${v}`);
    }
  });
  if (allLinks.length > 0) {
    fields.link = allLinks.join('\n');
  }

  const resultProjects = [];
  const parsedAccountText = accountGroups.flatMap(group => group.accounts || []).join(' ') || fields.account || '';
  const sheet = inferSheet(fields.platform, parsedAccountText, currentSheet);
  const defaultStatus = inferStatusFromInstruction(fields.instruction) || '脚本制作中';
  const topicDirectionValue = fields.topicDirection || '';
  const entryDate = normalizeDateValue(fields.date) || getTodayDateString();
  let parsedOrderIndex = 0;

  // 收集所有账号：优先使用分组账号，其次使用字段中的账号
  let allAccounts = [];
  if (accountGroups.length > 0) {
    accountGroups.forEach(group => {
      group.accounts.forEach(acc => {
        allAccounts.push({ account: acc, group: group });
      });
    });
  } else if (fields.account) {
    const accounts = parseAccounts(fields.account);
    accounts.forEach(acc => {
      allAccounts.push({ account: acc, group: { title: '' } });
    });
  }

  // 格式2兜底：如果标准解析未识别到任何账号，扫描全文中的已知账号名
  if (allAccounts.length === 0) {
    const scannedAccounts = scanForKnownAccounts(text);
    if (scannedAccounts.length > 0) {
      scannedAccounts.forEach(acc => {
        allAccounts.push({ account: acc, group: { title: fields.topicDirection || '' } });
      });
    }
  }

  // 格式3兜底：如果仍未识别到账号，且当前子表有预设账号，使用预设账号
  if (allAccounts.length === 0 && SHEET_ACCOUNTS[currentSheet]) {
    SHEET_ACCOUNTS[currentSheet].forEach(acc => {
      allAccounts.push({ account: acc, group: { title: '' } });
    });
  }

  // 账号简称自动补全：在配置了映射的子表中逐个识别简称并替换为完整账号名（各子表独立映射）
  const smartEntryUnmatched = [];
  if (isAliasSheet(sheet)) {
    const fullNames = ACCOUNT_FULL_NAMES_BY_SHEET[sheet] || new Set();
    allAccounts.forEach(item => {
      const expanded = expandAccountAlias(item.account, sheet);
      if (expanded && expanded !== item.account) {
        item.account = expanded;
      } else if (!expanded && !fullNames.has(item.account.trim()) && !ALL_KNOWN_ACCOUNTS.includes(item.account.trim())) {
        smartEntryUnmatched.push(item.account);
      }
    });
    if (smartEntryUnmatched.length > 0) {
      setTimeout(() => {
        showToast(`以下账号未匹配到对应全称：${smartEntryUnmatched.join('、')}，请手动确认`, 'error');
      }, 500);
    }
  }

  // 按输入顺序生成记录，有几个账号就生成几条
  // 发布链接：有分组标题(如"方向一")就用分组标题，没有分组标题则留空
  allAccounts.forEach(item => {
    const linkValue = item.group.title || '';
    resultProjects.push({
      id: `parsed-${parsedOrderIndex}`,
      sheet: sheet,
      date: entryDate,
      publishDate: '',
      platform: fields.platform || '',
      account: item.account,
      name: fields.name || '',
      status: defaultStatus,
      title: '',
      link: linkValue,
      business: fields.business || '',
      assignee: '',
      editor: '',
      // 订单类型：优先用子表默认值，其次用智能识别，最后用文本中显式填写的值
      orderType: getDefaultOrderType(sheet) || inferOrderType(text) || fields.orderType || '',
      remark: '',  // 备注不自动识别，仅在详情弹窗中手动填写
      _group: item.group.title,
      _parsedOrder: parsedOrderIndex++
    });
  });

  return { projects: resultProjects, fields, rawFields, accountGroups, sheet };
}

function matchField(rawName) {
  const lower = rawName.toLowerCase().replace(/[\s/+＋]/g, '');
  if (KEYWORD_INDEX[lower]) return KEYWORD_INDEX[lower];
  for (const kw of SORTED_KEYWORDS) {
    if (lower.includes(kw) || kw.includes(lower)) {
      return KEYWORD_INDEX[kw];
    }
  }
  return null;
}

function parseAccounts(text) {
  if (!text) return [];
  return text
    .split(/[、,，；;\s\n]+/)
    .map(s => s.trim())
    .filter(s => s && !/^链接[:：]/.test(s) && !/^提取码[:：]/.test(s) && !/^https?/i.test(s));
}

function inferSheet(platform, account, fallbackSheet = currentSheet) {
  const p = (platform || '').toLowerCase();
  const a = (account || '');
  if (p.includes('小红书') || a.includes('小红书')) return '小红书';
  if (p.includes('快手') || p.includes('视频号')) return '快手+视频号';
  if (p.includes('抖音') || a.includes('字节')) return '字节单';
  return fallbackSheet || '在坐标这边生活';
}

function inferStatusFromInstruction(instruction) {
  const text = String(instruction || '').trim();
  if (!text) return '';
  // 直接出视频/剪辑 → 进入视频制作中
  if (/出视频|剪视频|做视频|视频产出|产出视频/.test(text)) return '视频制作中';
  // 视频修改/反馈 → 视频制作中（重新剪辑）
  if (/视频反馈|改视频|视频修改|调整视频|优化视频/.test(text)) return '视频制作中';
  // 出脚本/写脚本 → 进入脚本制作中
  if (/出脚本|写脚本|脚本产出|产出脚本|做脚本/.test(text)) return '脚本制作中';
  // 脚本修改/反馈 → 脚本制作中（重新写）
  if (/脚本反馈|改脚本|脚本修改|脚本里|调整脚本|优化脚本/.test(text)) return '脚本制作中';
  // 发布相关 → 定时发布
  if (/发布|上传|定时/.test(text)) return '定时发布';
  // 暂停
  if (/暂停|暂缓/.test(text)) return '项目暂停';
  // 压缩包
  if (/压缩包|打包/.test(text)) return '已给压缩包';
  return '';
}

// 从方向文本中提取简短关键词作为分组标题
// 例如："围绕机器人" → "机器人"
//      "剪辑老铁快充计划「加麻不加辣」花式整活..." → "加麻不加辣整活"
function extractGroupKeyword(text) {
  if (!text) return '';
  const fullText = text.trim();
  let keyword = fullText;

  // 1. 优先提取「」内的内容作为核心关键词
  const bracketMatch = fullText.match(/「([^」]+)」/);
  if (bracketMatch) {
    keyword = bracketMatch[1];
    // 如果原文包含"整活"等常见后缀关键词，追加到关键词末尾
    if (/整活/.test(fullText) && !keyword.endsWith('整活')) keyword += '整活';
    return keyword;
  }

  // 2. 移除常见前缀动词（围绕/关于/针对/以/用/通过等）
  keyword = keyword.replace(/^(围绕|关于|针对|以|用|通过|根据|按照)+/, '');

  // 3. 如果去掉前缀后仍然太长（超过8个字），取前6个字
  if (keyword.length > 8) {
    keyword = keyword.substring(0, 6);
  }

  return keyword || fullText;
}

function buildRemark(fields, group) {
  const parts = [];
  if (fields.publishDate) parts.push(`发布时间: ${fields.publishDate}`);
  if (fields.ddl) parts.push(`DDL: ${fields.ddl}`);
  if (fields.duration) parts.push(`时长: ${fields.duration}`);
  if (fields.instruction) parts.push(`指令: ${fields.instruction}`);
  if (fields.remark) parts.push(fields.remark);
  return parts.join(' | ');
}

function renderSmartResult(result) {
  const { projects, fields, rawFields, accountGroups, sheet } = result;
  const totalAccounts = accountGroups.reduce((sum, g) => sum + (g.accounts?.length || 0), 0);
  const hasAccountInput = totalAccounts > 0 || !!fields.account;

  // 未检测到账号：显示错误提示，禁止添加
  if (!hasAccountInput) {
    els.smartResult.innerHTML = `
      <div class="smart-empty">
        <div class="smart-empty-icon" style="font-size:3rem">🚫</div>
        <p style="color:var(--danger);font-weight:700">未检测到账号信息</p>
        <p class="smart-empty-sub">请添加【投放账号】字段，例如：</p>
        <p class="smart-empty-sub" style="background:#F3F4F6;padding:0.6rem;border-radius:4px;font-family:monospace;margin-top:0.5rem">【投放账号】巨星火火、小柴爆米花、是剧剧呀</p>
        <p class="smart-empty-sub" style="margin-top:0.5rem">或每行一个账号，支持顿号/逗号/分号/换行分隔</p>
      </div>`;
    return;
  }

  if (projects.length === 0) {
    els.smartResult.innerHTML = `
      <div class="smart-empty">
        <div class="smart-empty-icon">⚠️</div>
        <p>未解析出项目</p>
        <p class="smart-empty-sub">请确认包含【项目名】等字段</p>
      </div>`;
    return;
  }

  let html = '';
  html += `<div class="smart-group">`;
  html += `<div class="smart-group-header">📋 字段识别总览 <span class="group-count">${Object.keys(fields).length} 项</span></div>`;
  const fieldLabels = {
    name: '项目名', business: '销售', platform: '平台', account: '账号',
    title: '标题', topicDirection: '话题词/方向', link: '素材/参考链接', orderType: '投放形式',
    assignee: '接单人', date: '日期', publishDate: '发布时间',
    ddl: 'DDL', remark: '备注', duration: '时长', instruction: '指令'
  };
  Object.entries(fields).forEach(([k, v]) => {
    if (k === 'account') return;
    const label = fieldLabels[k] || k;
    const display = v.length > 60 ? v.substring(0, 60) + '...' : v;
    html += `<div class="smart-field-row"><div class="smart-field-label">${label}</div><div class="smart-field-value">${escapeHtml(display)}</div></div>`;
  });
  Object.entries(rawFields).forEach(([k, v]) => {
    if (!v) return;
    const display = v.length > 60 ? v.substring(0, 60) + '...' : v;
    html += `<div class="smart-field-row" style="background:#FEF3C7"><div class="smart-field-label">${escapeHtml(k)}</div><div class="smart-field-value" style="color:#92400E">⚠️ 未识别 · ${escapeHtml(display)}</div></div>`;
  });
  html += `</div>`;

  if (accountGroups.length > 0) {
    accountGroups.forEach((group, gi) => {
      html += `<div class="smart-group">`;
      html += `<div class="smart-group-header">🎬 ${escapeHtml(group.title || '未命名分组')} <span class="group-count">${group.accounts.length} 个账号</span></div>`;
      html += `<div class="smart-account-list">`;
      group.accounts.forEach(acc => {
        html += `<span class="smart-account-tag">${escapeHtml(acc)}</span>`;
      });
      html += `</div></div>`;
    });
  }

  html += `<div class="smart-group" style="background:var(--success-light);border-color:var(--success)">`;
  html += `<div class="smart-group-header" style="background:var(--success);color:#FFF">✅ 将生成 ${projects.length} 条项目记录 <span class="group-count" style="background:#FFF;color:var(--success)">${projects.length}</span></div>`;
  html += `<div class="smart-field-row"><div class="smart-field-label">默认子表</div><div class="smart-field-value">${escapeHtml(projects[0]?.sheet || sheet || '-')}</div></div>`;
  html += `<div class="smart-field-row"><div class="smart-field-label">默认进度</div><div class="smart-field-value">${escapeHtml(projects[0]?.status || '空白')}</div></div>`;
  html += `<div class="smart-field-row"><div class="smart-field-label">说明</div><div class="smart-field-value">可在添加后于表格中逐条调整进度状态</div></div>`;
  html += `</div>`;

  els.smartResult.innerHTML = html;
}

function addParsedProjects() {
  if (parsedProjects.length === 0) {
    showToast('没有可添加的项目', 'error');
    return;
  }

  const currentMaxOrder = projects.reduce((max, p) => {
    const order = Number(p.order || 0);
    return Number.isFinite(order) && order > max ? order : max;
  }, Date.now());
  const baseId = Date.now();

  const cleanProjects = parsedProjects
    .slice()
    .sort((a, b) => (a._parsedOrder ?? 0) - (b._parsedOrder ?? 0))
    .map((p, index) => {
    const { _group, _parsedOrder, ...rest } = p;
    rest.id = baseId + index;
    rest.order = currentMaxOrder + index + 1;
    rest.date = rest.date || getTodayDateString();
    rest.sheet = rest.sheet || currentSheet;
    // 字节单/小红书子表自动设置默认订单类型和默认平台
    const defaultOT = getDefaultOrderType(rest.sheet);
    if (defaultOT) {
      rest.orderType = defaultOT;
    }
    const defaultPF = getDefaultPlatform(rest.sheet);
    if (defaultPF && !rest.platform) {
      rest.platform = defaultPF;
    }
    return rest;
  });

  projects.push(...cleanProjects);
  archiveSmartInputToProjectDetails(cleanProjects, els.smartInput.value);
  saveProjects(`智能录入添加 ${cleanProjects.length} 个项目`);
  saveProjectDetails('智能录入归档项目详情');
  renderProjects();
  closeSmartModal();
  showToast(`已添加 ${cleanProjects.length} 个项目`);
}

function archiveSmartInputToProjectDetails(newProjects, rawText) {
  const text = String(rawText || '').trim();
  if (!text) return;
  newProjects.forEach(project => {
    const detail = ensureProjectDetail(project);
    if (!detail) return;
    if (!detail.orderInfo) detail.orderInfo = text;
    detail.referenceLink = mergeReferenceLinks(
      detail.referenceLink,
      extractReferenceLinksFromOrderInfo(detail.orderInfo || text)
    );
    detail.updatedAt = new Date().toISOString();
    projectDetails[detail.key] = detail;
  });
}

// ===== Task List (任务清单) =====
let currentView = 'table'; // 'table' | 'tasks'
let taskLists = {}; // 每个子表独立任务列表: { sheetName: [task...] }
let collapsedTaskGroups = new Set();

const TASK_STORAGE_KEY = 'table-app-tasks';

// 任务类型关键词映射
const TASK_TYPE_PATTERNS = [
  { type: '出脚本', patterns: ['出脚本', '写脚本', '脚本产出', '产出脚本'] },
  { type: '脚本修改', patterns: ['脚本反馈', '脚本修改', '改脚本', '脚本里增加', '脚本里加', '调整脚本', '脚本需要', '脚本优化', '脚本'] },
  { type: '视频修改', patterns: ['视频反馈', '视频修改', '改视频', '调整视频', '剪辑', '剪视频', '视频里加', '视频里增加', '接着改', '这单可以接着改', '下视频', '视频'] },
  { type: '封面修改', patterns: ['封面', '改封面', '换封面', '封面修改'] },
  { type: '标题修改', patterns: ['标题', '改标题', '换标题', '标题修改'] },
  { type: '发布', patterns: ['发布', '上传', '安排发布', '定时发布'] },
  { type: '沟通', patterns: ['沟通', '对接', '联系', '确认', '同步'] },
  { type: '新增内容', patterns: ['新增', '加更', '补充', '增加内容', '新做'] },
  { type: '数据回收', patterns: ['填数据', '数据图', '实时消耗', '消耗反链', '互动数据', '播放量', '转评赞', '填写数据', '数据截图', '数据回收'] },
];

// 项目名识别模式
const PROJECT_NAME_PATTERNS = [
  /项目[：:]\s*([^\n：:，,。；;]+)/,
  /剧名[：:]\s*([^\n：:，,。；;]+)/,
  /节目[：:]\s*([^\n：:，,。；;]+)/,
  /账号[：:]\s*([^\n：:，,。；;]+)/,
  /品牌[：:]\s*([^\n：:，,。；;]+)/,
];

function getProjectNameFromLine(line) {
  const regex = /(?:【|\[)?(项目\/品牌名|项目名|项目|剧名|节目|账号|品牌名|品牌)(?:】|\])?[：:]?\s*([^\n：:，,。；;\]】]+)/g;
  let match;
  let lastName = '';
  while ((match = regex.exec(line)) !== null) {
    const name = match[2].trim();
    if (name) lastName = name;
  }
  return lastName;
}

function inferProjectNameFromText(text) {
  const explicitName = getProjectNameFromLine(text);
  if (explicitName) return explicitName;

  const bracketNames = [];
  const bracketRegex = /(?:【([^】]+)】|\[([^\]]+)\])/g;
  let match;
  while ((match = bracketRegex.exec(text)) !== null) {
    const name = cleanTaskText(match[1] || match[2]);
    if (!name) continue;
    if (/腾讯文档|飞书文档|文档|指令|注意|ddl|DDL|项目\/品牌名|项目名|项目|品牌|链接|验收材料/.test(name)) continue;
    bracketNames.push(name);
  }
  if (bracketNames.length > 0) return bracketNames[0];

  const docTitleMatch = text.match(/【腾讯文档】\s*【([^】]+)】/);
  if (docTitleMatch) return cleanTaskText(docTitleMatch[1]);
  return '';
}

function cleanTaskText(text) {
  return String(text || '')
    .replace(/\u2005|\u2006|\u2009|\u200b/g, ' ')
    .replace(/@[^\s@，,。；;]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[，,。；;\s]+/, '')
    .replace(/[，,。；;\s]+$/, '')
    .trim();
}

function inferTaskType(text) {
  const source = String(text || '');
  if (/审核|审稿|审片|送审|客户确认|客户.*看|客户.*反馈/.test(source)) {
    if (/接着改|改视频|视频反馈|下视频|视频/.test(source)) return '视频修改';
    if (/改脚本|脚本反馈|脚本/.test(source)) return '脚本修改';
    return '';
  }
  for (const { type, patterns } of TASK_TYPE_PATTERNS) {
    if (patterns.some(p => source.includes(p))) {
      return type;
    }
  }
  return '';
}

function extractBracketFields(text) {
  const fields = {};
  const regex = /(?:【([^】]+)】|\[([^\]]+)\])\s*([\s\S]*?)(?=(?:【[^】]+】|\[[^\]]+\])|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = cleanTaskText(match[1] || match[2]);
    const value = String(match[3] || '').trim();
    if (key) fields[key] = value;
  }
  return fields;
}

function pickField(fields, names) {
  for (const name of names) {
    if (fields[name] && String(fields[name]).trim()) {
      return cleanTaskText(fields[name]);
    }
  }
  return '';
}

function buildStructuredTaskDetail(fields, instruction, taskText) {
  const rows = [];
  const add = (label, value) => {
    const raw = String(value || '').trim();
    if (!raw) return;
    rows.push(`【${label}】${raw}`);
  };

  add('指令', instruction || taskText);
  add('发布时间', pickField(fields, ['发布时间', '发布日期', '上线时间', '上线日期', '档期']));
  add('DDL', pickField(fields, ['ddl', 'DDL', '截止', '截止时间']));
  add('投放平台', pickField(fields, ['投放平台', '平台']));
  add('投放形式', pickField(fields, ['投放形式', '形式', '合作形式']));
  add('视频时长', pickField(fields, ['视频时长', '时长']));
  add('投放账号', pickField(fields, ['投放账号', '账号', '发布账号']));
  add('话题词+方向', pickField(fields, ['话题词+方向', '话题词＋方向', '话题', '方向']));
  add('注意事项', pickField(fields, ['注意事项', '注意', '备注', '特殊要求']));
  add('素材链接', pickField(fields, ['素材链接', '素材', '链接', 'bf']));

  return rows.join('\n');
}

function parseStructuredBracketTask(text, assignees) {
  const fields = extractBracketFields(text);
  const keys = Object.keys(fields);
  if (keys.length === 0) return null;

  const project = pickField(fields, ['项目/品牌名', '项目名', '项目', '品牌名', '品牌', '剧名', '节目']) || inferProjectNameFromText(text);
  const instruction = pickField(fields, ['指令', '任务', '需求', '待办', '操作']);

  if (!project) return null;

  const inferredType = inferTaskType(instruction || text);
  const taskText = inferredType === '数据回收' ? '数据回收' : (instruction || inferredType);

  if (!taskText) return null;

  return {
    project,
    text: taskText,
    detail: buildStructuredTaskDetail(fields, instruction, taskText),
    type: inferredType || taskText,
    assignee: assignees.length > 0 ? assignees.join(', ') : '',
  };
}

function initTaskView() {
  loadTaskLists();

  // Task input buttons
  document.getElementById('btn-task-parse')?.addEventListener('click', parseTaskInput);
  document.getElementById('btn-task-clear')?.addEventListener('click', () => {
    document.getElementById('task-input').value = '';
  });
  document.getElementById('btn-task-clear-done')?.addEventListener('click', clearDoneTasks);
  document.getElementById('btn-task-clear-all')?.addEventListener('click', clearAllTasks);

  renderTasks();
}

// ===== 任务解析器 =====
function parseTaskInput() {
  const input = document.getElementById('task-input').value.trim();
  if (!input) {
    showToast('请先粘贴指令内容', 'error');
    return;
  }

  const tasks = parseTasksFromText(input);
  if (tasks.length === 0) {
    showToast('未能识别出任务，请检查内容格式', 'error');
    return;
  }

  // 添加到当前子表的任务列表
  if (!taskLists[currentSheet]) taskLists[currentSheet] = [];
  let markedCount = 0;
  tasks.forEach(t => {
    t.id = Date.now() + Math.random();
    t.done = false;
    t.createdAt = new Date().toISOString();
    taskLists[currentSheet].push(t);
    // 自动匹配项目并标记当前班次交接
    markedCount += autoMarkHandoverFromTask(t);
  });

  saveTaskLists();
  if (markedCount > 0) {
    saveProjects(`任务解析自动标记 ${markedCount} 个项目交接`);
    renderProjects();
    showToast(`已提炼 ${tasks.length} 条任务，自动标记 ${markedCount} 个项目为${getShiftLabel(getCurrentShift())}交接`);
  } else {
    showToast(`已提炼 ${tasks.length} 条任务（未匹配到已有项目，可手动标记交接）`);
  }
  renderTasks();
}

function parseTasksFromText(text) {
  const tasks = [];
  const lines = text.split('\n').map(l => cleanTaskText(l)).filter(l => l);
  
  let currentProject = '';

  // 先全局提取所有 @人名
  const assignees = [];
  const atRegex = /@([^\s@，,。；;\n]+)/g;
  let match;
  while ((match = atRegex.exec(text)) !== null) {
    if (!assignees.includes(match[1])) assignees.push(match[1]);
  }

  // 优先处理结构化项目单：例如【项目/品牌名】任运 + 【指令】出脚本
  const structuredTask = parseStructuredBracketTask(text, assignees);
  if (structuredTask) {
    return [structuredTask];
  }

  // 逐行解析
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 识别项目名
    const foundProjectName = getProjectNameFromLine(line);
    const projectFound = Boolean(foundProjectName);
    if (foundProjectName) currentProject = foundProjectName;

    // 如果这一行只是“项目名/分类标题”，不生成任务
    const lineWithoutProject = cleanTaskText(line.replace(/(?:【|\[)?(项目\/品牌名|项目名|项目|剧名|节目|账号|品牌名|品牌)(?:】|\])?[：:]?\s*[^\n：:，,。；;\]】]+/g, ''));
    if (projectFound && (!lineWithoutProject || /^脚本修改反馈$|^视频修改反馈$|^修改反馈$|^反馈$/.test(lineWithoutProject))) continue;

    // 识别任务内容
    const taskInfo = extractTaskFromLine(line, currentProject);
    if (taskInfo) {
      // 如果这一行同时有项目名，用识别到的
      if (taskInfo.project) currentProject = taskInfo.project;
      
      tasks.push({
        project: currentProject || '未分类',
        text: taskInfo.type || taskInfo.text,
        detail: taskInfo.type ? taskInfo.text : '',
        type: taskInfo.type || '',
        assignee: taskInfo.assignee || (assignees.length > 0 ? assignees[0] : ''),
      });
    }
  }

  // 如果没解析出任何任务，把整段当一个任务
  if (tasks.length === 0 && text.length > 0) {
    const project = getProjectNameFromLine(text) || currentProject || '未分类';
    const type = inferTaskType(text);
    const cleanedText = cleanTaskText(
      text
        .replace(/(项目|剧名|节目|账号|品牌)[：:]\s*[^\n：:，,。；;]+/g, '')
        .replace(/(脚本反馈|视频反馈|修改反馈|反馈|需求|指令)[：:]/g, '')
    );
    tasks.push({
      project,
      text: type || cleanedText,
      detail: type ? cleanedText : '',
      type,
      assignee: assignees.length > 0 ? assignees.join(', ') : '',
    });
  }

  return tasks;
}

function extractTaskFromLine(line, defaultProject) {
  // 跳过纯项目名行、纯 @提及行
  if (/^(项目|剧名|节目|账号|品牌)[：:]/.test(line) && line.length < 30) return null;
  if (/^@/.test(line) && line.length < 20) return null;
  if (/审核|审稿|审片|送审|客户确认|客户.*看|客户.*反馈/.test(line) && !/接着改|改视频|视频反馈|下视频|改脚本|脚本反馈/.test(line)) return null;

  const originalLine = line;
  let text = cleanTaskText(line);
  let type = inferTaskType(originalLine);
  let project = '';
  let assignee = '';

  // 提取 @人
  const atMatch = line.match(/@([^\s@，,。；;]+)/);
  if (atMatch) {
    assignee = atMatch[1];
    text = cleanTaskText(text.replace(/@[^\s@，,。；;]+\s*/g, ''));
  }

  // 提取项目名（如果行内有）
  project = getProjectNameFromLine(text);
  if (project) {
    text = cleanTaskText(text.replace(/(?:【|\[)?(项目\/品牌名|项目名|项目|剧名|节目|账号|品牌名|品牌)(?:】|\])?[：:]?\s*[^\n：:，,。；;\]】]+/g, ''));
  }

  // 优先提取常见“反馈/需求/指令”冒号后的详情
  const detailMatch = originalLine.match(/(?:脚本反馈|视频反馈|封面反馈|标题反馈|修改反馈|反馈|需求|指令|备注|修改|调整)[：:]\s*(.+)/);
  if (detailMatch && detailMatch[1].trim().length > 2) {
    text = detailMatch[1];
    text = text.replace(/(?:【|\[)?(项目\/品牌名|项目名|项目|剧名|节目|账号|品牌名|品牌)(?:】|\])?[：:]?\s*[^\n：:，,。；;\]】]+/g, '');
  }

  // 清理文本
  text = cleanTaskText(text);

  const hasInstruction = Boolean(type) || /反馈|修改|需要|增加|新增|发布|确认|调整|换|做一下|处理|补充|优化|加/.test(originalLine);
  if (!hasInstruction) return null;

  // 避免把“脚本修改反馈”这类分类标题当成任务详情
  if (/^(脚本修改反馈|视频修改反馈|修改反馈|脚本反馈|视频反馈|反馈)$/.test(text)) return null;

  if (text.length < 2) return null;
  return { text, type, project: project || defaultProject, assignee };
}

// ===== 任务渲染 =====
function renderTasks() {
  const listEl = document.getElementById('task-list');
  if (!listEl) return;

  const tasks = taskLists[currentSheet] || [];
  const todoCount = tasks.filter(t => !t.done).length;
  const doneCount = tasks.filter(t => t.done).length;

  document.getElementById('task-stat-todo').textContent = `${todoCount} 待办`;
  document.getElementById('task-stat-done').textContent = `${doneCount} 已完成`;

  if (tasks.length === 0) {
    listEl.innerHTML = `
      <div class="task-empty">
        <div class="task-empty-icon">✅</div>
        <p>暂无任务，粘贴指令后点击「提炼任务」</p>
      </div>`;
    return;
  }

  // 按项目分组
  const groups = {};
  tasks.forEach(t => {
    const key = t.project || '未分类';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  const groupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'zh'));

  let html = '';
  groupKeys.forEach(groupName => {
    const items = groups[groupName];
    const collapsed = collapsedTaskGroups.has(groupName);
    const todoInGroup = items.filter(t => !t.done).length;

    html += `
      <div class="task-group">
        <div class="task-group-header" onclick="toggleTaskGroup('${encodeURIComponent(groupName)}')">
          <span class="task-group-toggle ${collapsed ? 'collapsed' : ''}">▼</span>
          <span class="task-group-name">${escapeHtml(groupName)}</span>
          <span class="task-group-count">${todoInGroup}/${items.length}</span>
          <button class="task-group-del" title="删除该组任务" onclick="event.stopPropagation(); deleteTaskGroup('${encodeURIComponent(groupName)}')">🗑️</button>
        </div>
        <div class="task-group-items" style="${collapsed ? 'display:none;' : ''}">`;

    // 未完成的排前面
    const sorted = [...items].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    sorted.forEach(task => {
      const priority = inferTaskPriority(task);
      html += `
        <div class="task-item ${task.done ? 'done' : ''}" data-id="${task.id}">
          <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''} 
                 onchange="toggleTask(${task.id})">
          <div class="task-item-content">
            <div class="task-card-title" contenteditable="true" 
                 onblur="updateTaskText(${task.id}, this.textContent.trim())"
                 onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();this.blur();}">${escapeHtml(task.text)}</div>
            <div class="task-item-meta">
              <span class="task-tag task-tag-project">${escapeHtml(task.project || groupName)}</span>
              <span class="task-tag task-tag-priority priority-${priority.level}">${priority.label}</span>
              ${task.type ? `<span class="task-tag task-tag-type">${escapeHtml(task.type)}</span>` : ''}
              ${task.assignee ? `<span class="task-tag task-tag-assignee">@${escapeHtml(task.assignee)}</span>` : ''}
            </div>
            ${task.detail ? `<div class="task-item-detail">${escapeHtml(task.detail)}</div>` : ''}
          </div>
          <button class="task-item-del" title="删除" onclick="deleteTask(${task.id})">✕</button>
        </div>`;
    });

    html += `</div></div>`;
  });

  listEl.innerHTML = html;
}

function inferTaskPriority(task) {
  const source = `${task.text || ''} ${task.detail || ''} ${task.type || ''}`;
  if (/紧急|马上|立刻|今天|今晚|12点|上午|下午|之前|一定|ddl|DDL|截止/.test(source)) {
    return { level: 'high', label: '高优先级' };
  }
  if (/数据回收|出脚本|脚本修改|视频修改|发布/.test(source)) {
    return { level: 'medium', label: '中优先级' };
  }
  return { level: 'normal', label: '普通' };
}

function toggleTaskGroup(encodedName) {
  const name = decodeURIComponent(encodedName);
  if (collapsedTaskGroups.has(name)) {
    collapsedTaskGroups.delete(name);
  } else {
    collapsedTaskGroups.add(name);
  }
  renderTasks();
}

function toggleTask(id) {
  const tasks = taskLists[currentSheet] || [];
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    saveTaskLists();
    renderTasks();
  }
}

function updateTaskText(id, text) {
  const tasks = taskLists[currentSheet] || [];
  const task = tasks.find(t => t.id === id);
  if (task && task.text !== text) {
    task.text = text;
    saveTaskLists();
  }
}

function deleteTask(id) {
  if (!taskLists[currentSheet]) return;
  taskLists[currentSheet] = taskLists[currentSheet].filter(t => t.id !== id);
  saveTaskLists();
  renderTasks();
}

function deleteTaskGroup(encodedName) {
  const name = decodeURIComponent(encodedName);
  if (!confirm(`确定删除「${name}」下的所有任务吗？`)) return;
  if (!taskLists[currentSheet]) return;
  taskLists[currentSheet] = taskLists[currentSheet].filter(t => (t.project || '未分类') !== name);
  collapsedTaskGroups.delete(name);
  saveTaskLists();
  renderTasks();
  showToast('已删除该组任务');
}

function clearDoneTasks() {
  if (!taskLists[currentSheet]) return;
  const doneCount = taskLists[currentSheet].filter(t => t.done).length;
  if (doneCount === 0) {
    showToast('没有已完成的任务');
    return;
  }
  if (!confirm(`确定清除 ${doneCount} 条已完成任务吗？`)) return;
  taskLists[currentSheet] = taskLists[currentSheet].filter(t => !t.done);
  saveTaskLists();
  renderTasks();
  showToast(`已清除 ${doneCount} 条已完成任务`);
}

function clearAllTasks() {
  if (!taskLists[currentSheet] || taskLists[currentSheet].length === 0) {
    showToast('当前子表没有任务');
    return;
  }
  if (!confirm(`确定清空当前子表的所有任务吗？此操作不可恢复。`)) return;
  taskLists[currentSheet] = [];
  collapsedTaskGroups.clear();
  saveTaskLists();
  renderTasks();
  showToast('已清空所有任务');
}

// ===== 任务数据持久化 =====
function loadTaskLists() {
  try {
    const data = localStorage.getItem(TASK_STORAGE_KEY);
    if (data) {
      taskLists = JSON.parse(data);
    }
  } catch (e) {
    console.error('加载任务列表失败:', e);
    taskLists = {};
  }
}

function saveTaskLists() {
  try {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(taskLists));
  } catch (e) {
    console.error('保存任务列表失败:', e);
  }
}

// ===== Start =====
document.addEventListener('DOMContentLoaded', async () => {
  bindAuthEvents();
  // 纯前端模式：直接走飞书登录流程
  showLogin();
  await feishuLogin();
});
