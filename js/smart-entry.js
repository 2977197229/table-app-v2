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

