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

