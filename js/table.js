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

