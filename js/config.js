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

