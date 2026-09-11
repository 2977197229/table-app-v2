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

