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
