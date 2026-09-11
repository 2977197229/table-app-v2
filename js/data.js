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

