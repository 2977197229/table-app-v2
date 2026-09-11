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
            ${file.url ? `<a href="${escapeHtml(file.url)}" target="_blank">${escapeHtml(getDisplayFileName(file))}</a>` : `<span>${escapeHtml(getDisplayFileName(file))}</span>${file.tooLarge ? ' <em>(超大，用网盘)</em>' : file.localOnly ? ' <em>(本地)</em>' : ''}`}
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
      if (file.size > 3 * 1024 * 1024) {
        showToast(`${file.name} 超过3MB，建议使用网盘链接方式记录`, 'warning');
        account[type].push({
          id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2),
          name: getDisplayFileName({ name: file.name }),
          size: file.size,
          type: file.type,
          tooLarge: true,
          uploadedAt: new Date().toISOString()
        });
        continue;
      }

      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });

      showToast(`正在上传 ${file.name}...`);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileData: base64Data
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '上传失败');
      }

      const result = await res.json();
      account[type].push({
        id: result.fileKey,
        name: getDisplayFileName({ name: file.name }),
        size: file.size,
        type: file.type,
        fileKey: result.fileKey,
        url: result.url,
        uploadedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('上传文件失败：', err);
      showToast(`上传失败：${file.name} - ${err.message}`, 'error');
      account[type].push({
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        name: getDisplayFileName({ name: file.name }),
        size: file.size,
        type: file.type,
        localOnly: true,
        uploadedAt: new Date().toISOString()
      });
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

