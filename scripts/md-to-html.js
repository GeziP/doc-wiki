#!/usr/bin/env node
/**
 * md-to-html.js — Unified Markdown→HTML converter for all doc types.
 *
 * Supports module, system, and guide document types with type-specific strategies.
 *
 * Usage:
 *   node md-to-html.js --type module doc/tech-docs/Task_Design.md
 *   node md-to-html.js --type system doc/Scheduler_Architecture_Design.md
 *   node md-to-html.js --type guide  doc/MyProject_Guide.md
 *   node md-to-html.js --type module --all
 *   node md-to-html.js --type system --all
 *   node md-to-html.js --type guide  --all
 *   node md-to-html.js --type module --index "ProjectName" "description"
 *   node md-to-html.js --dry-run --all
 *   node md-to-html.js --type module --all --force
 *
 * Auto-detection: if --type is omitted, the script guesses from the file path.
 */

const fs = require('fs');
const path = require('path');
const { parseSourceReference } = require('./lib/source-reference');

const args = process.argv.slice(2);
const valueFlags = ['--type', '--root', '--lang'];
const switchFlags = ['--all', '--force', '--index', '--dry-run', '--help'];
for (let i = 0; i < args.length; i++) {
  if (valueFlags.includes(args[i])) {
    if (!args[i + 1] || args[i + 1].startsWith('--')) {
      console.error(`ERROR Missing value for ${args[i]}`);
      process.exit(1);
    }
    i++;
  } else if (args[i].startsWith('--') && !switchFlags.includes(args[i])) {
    console.error(`ERROR Unknown option: ${args[i]}`);
    process.exit(1);
  }
}
const dryRun = args.includes('--dry-run');
const convertAll = args.includes('--all');
const force = args.includes('--force');
const shouldGenerateIndex = args.includes('--index');
const typeIdx = args.indexOf('--type');
const rootIdx = args.indexOf('--root');
const langIdx = args.indexOf('--lang');
const docType = typeIdx !== -1 ? args[typeIdx + 1] : null;
const docLang = langIdx !== -1 ? args[langIdx + 1] : null;
const files = args.filter((a, i) => !a.startsWith('--') && (typeIdx === -1 || i !== typeIdx + 1) && (rootIdx === -1 || i !== rootIdx + 1) && (langIdx === -1 || i !== langIdx + 1));

// Resolve project root: --root flag > CWD > fallback
const PROJECT_ROOT = rootIdx !== -1
  ? path.resolve(args[rootIdx + 1])
  : process.cwd();

// ============================================================
// Type-specific configuration
// ============================================================

const TYPE_CONFIG = {
  module: {
    scanDir: path.join(PROJECT_ROOT, 'doc', 'tech-docs'),
    templatePath: path.resolve(__dirname, '..', 'templates', 'module-design.html'),
    filePattern: f => /_Design\.md$/i.test(f),
    bodyAttr: 'data-doctype="tech-design"',
    generatorMeta: 'doc-writer module',
    brand: 'Module Docs',
    needsMermaid: true,
    vendorRel: '../assets/vendor/',  // 内网可移植：JS/CSS 本地 vendor（checkNoCdnAssets 强制）
    sectionIdMap: {
      '1': 'sec-overview', '2': 'sec-goals', '3': 'sec-arch',
      '4': 'sec-concepts', '5': 'sec-state', '6': 'sec-flow',
      '7': 'sec-impl', '8': 'sec-api', '9': 'sec-usage',
      '10': 'sec-faq', '11': 'sec-tests'
    },
    shouldBeOpen(heading) {
      if (/^(1|2|3|4|7|8|9|11)\./.test(heading)) return true;
      if (/附录|常见问题|状态机|流程图|appendix|faq|state machine|flow diagram/i.test(heading)) return false;
      return true;
    },
    buildMetaRows(meta) {
      const rows = [];
      if (meta.implFile) rows.push(`<dt>实现文件</dt><dd>${metaCode(meta.implFile)}</dd>`);
      if (meta.testFile) rows.push(`<dt>测试文件</dt><dd>${metaCode(meta.testFile)}</dd>`);
      if (meta.relatedDocs) rows.push(`<dt>关联文档</dt><dd>${inlineMarkdown(meta.relatedDocs)}</dd>`);
      if (meta.writeDate) rows.push(`<dt>编写日期</dt><dd>${meta.writeDate}</dd>`);
      if (meta.updateDate) rows.push(`<dt>更新日期</dt><dd>${meta.updateDate}</dd>`);
      return rows.join('\n          ');
    },
    extraMetaKeys: {
      '实现文件': 'implFile', 'Source File': 'implFile',
      '测试文件': 'testFile', 'Test File': 'testFile',
      '关联文档': 'relatedDocs', 'Related Docs': 'relatedDocs',
    },
    indexConfig: {
      templatePath: path.resolve(__dirname, '..', 'templates', 'module-index.html'),
      outputPath: path.join(PROJECT_ROOT, 'doc', 'tech-docs', 'index.html'),
      projectNameDefault: 'Project',
      projectDescDefault: '模块设计文档集',
      getCards(htmlFiles, scanDir) {
        const metaPath = path.join(scanDir, 'doc-meta.json');
        let moduleMeta = {}, groupLabels = {}, orderedGroups = [];
        if (fs.existsSync(metaPath)) {
          try {
            const raw = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            moduleMeta = raw.modules || {};
            groupLabels = raw.groups || {};
            orderedGroups = raw.groupOrder || Object.keys(groupLabels);
          } catch (e) { /* fallback to flat mode */ }
        }
        const items = htmlFiles.map(f => {
          const name = f.replace('_Design.html', '');
          const meta = moduleMeta[name] || { group: 'default', desc: name };
          return { name, file: f, ...meta };
        });
        if (orderedGroups.length === 0) {
          const cards = items.map(item => `
      <a class="card" href="${item.file}" data-keywords="${item.name.toLowerCase()}">
        <div class="card-name">${item.name}</div>
        <div class="card-desc">${item.desc}</div>
      </a>`).join('\n');
          return { filterButtons: '', cardGroups: `\n    <div class="card-grid">${cards}\n    </div>`, count: items.length };
        }
        const groups = [...new Set(items.map(f => f.group))];
        const filterButtons = groups.filter(g => groupLabels[g])
          .map(g => `<button class="filter-btn" data-filter="${g}">${groupLabels[g]}</button>`).join('\n    ');
        const cardGroups = [];
        for (const group of orderedGroups) {
          const groupItems = items.filter(f => f.group === group);
          if (groupItems.length === 0) continue;
          const label = groupLabels[group] || group;
          const cards = groupItems.map(item => `
      <a class="card" href="${item.file}" data-group="${item.group}" data-keywords="${item.name.toLowerCase()}">
        <div class="card-name">${item.name}</div>
        <div class="card-desc">${item.desc}</div>
        <span class="card-tag">${label}</span>
      </a>`).join('\n');
          cardGroups.push(`
    <div class="group-label" data-group="${group}">${label}</div>
    <div class="card-grid" data-group="${group}">${cards}
    </div>`);
        }
        return { filterButtons, cardGroups: cardGroups.join('\n'), count: items.length };
      }
    }
  },
  system: {
    scanDir: path.join(PROJECT_ROOT, 'doc'),
    templatePath: path.resolve(__dirname, '..', 'templates', 'system-design.html'),
    filePattern: f => /\.md$/i.test(f) && !/Guide\.md$/i.test(f),
    bodyAttr: 'data-doctype="system-design"',
    generatorMeta: 'doc-writer system',
    brand: 'System Docs',
    needsMermaid: true,
    vendorRel: 'assets/vendor/',  // 内网可移植：JS/CSS 本地 vendor（checkNoCdnAssets 强制）
    sectionIdMap: {
      '1': 'sec-overview', '2': 'sec-arch', '3': 'sec-diagram',
      '4': 'sec-modules', '5': 'sec-dataflow', '6': 'sec-thread',
      '7': 'sec-config', '8': 'sec-fault', '9': 'sec-perf',
      '10': 'sec-extension',
    },
    shouldBeOpen(heading) {
      if (/^(1|2|3|4)\./.test(heading)) return true;
      if (/概述|架构|系统架构图|核心模块/.test(heading)) return true;
      if (/附录|风险|未知|证据/.test(heading)) return false;
      return false;
    },
    buildMetaRows(meta) {
      const rows = [];
      if (meta.docType) rows.push(`<dt>文档类型</dt><dd>${meta.docType}</dd>`);
      if (meta.srcPath) rows.push(`<dt>源码位置</dt><dd>${metaCode(meta.srcPath)}</dd>`);
      if (meta.generatedBy) rows.push(`<dt>生成方式</dt><dd>${meta.generatedBy}</dd>`);
      if (meta.artifacts) rows.push(`<dt>关联产物</dt><dd>${inlineMarkdown(meta.artifacts)}</dd>`);
      if (meta.writeDate) rows.push(`<dt>编写日期</dt><dd>${meta.writeDate}</dd>`);
      if (meta.updateDate) rows.push(`<dt>更新日期</dt><dd>${meta.updateDate}</dd>`);
      return rows.join('\n          ');
    },
    extraMetaKeys: {
      '文档类型': 'docType', '源码位置': 'srcPath',
      '生成方式': 'generatedBy', '关联产物': 'artifacts',
    },
    indexConfig: {
      templatePath: path.resolve(__dirname, '..', 'templates', 'system-index.html'),
      outputPath: path.join(PROJECT_ROOT, 'doc', 'index.html'),
      projectNameDefault: 'Project',
      projectDescDefault: '系统设计文档集',
      getCards(htmlFiles, scanDir) {
        const metaPath = path.join(scanDir, 'doc-meta.json');
        let categories = {
          'Architecture': { label: '架构设计', desc: '系统整体架构、分层设计、组件关系' },
          'Design':       { label: '详细设计', desc: '核心概念、配置指南、API 使用' },
          'Requirements': { label: '需求文档', desc: '功能需求、非功能需求、验收标准' },
        };
        if (fs.existsSync(metaPath)) {
          try {
            const raw = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            if (raw.categories) categories = raw.categories;
          } catch (e) { /* use defaults */ }
        }
        function categorize(fn) {
          for (const key of Object.keys(categories)) {
            if (new RegExp(key, 'i').test(fn)) return key;
          }
          return Object.keys(categories)[0];
        }
        const items = htmlFiles.map(f => {
          const name = f.replace('.html', '');
          const cat = categorize(f);
          return { name, file: f, ...categories[cat] };
        });
        const groups = [...new Set(items.map(f => f.label))];
        const filterButtons = groups.map(g => `<button class="filter-btn" data-filter="${g}">${g}</button>`).join('\n    ');
        const cardGroups = [];
        for (const [cat, info] of Object.entries(categories)) {
          const catItems = items.filter(f => f.label === info.label);
          if (catItems.length === 0) continue;
          const cards = catItems.map(item => `
      <a class="card" href="${item.file}" data-group="${item.label}" data-keywords="${item.name.toLowerCase()}">
        <div class="card-name">${item.name}</div>
        <div class="card-desc">${item.desc}</div>
        <span class="card-tag">${item.label}</span>
      </a>`).join('\n');
          cardGroups.push(`
    <div class="group-label" data-group="${info.label}">${info.label}</div>
    <div class="card-grid" data-group="${info.label}">${cards}
    </div>`);
        }
        return { filterButtons, cardGroups: cardGroups.join('\n'), count: items.length };
      }
    }
  },
  guide: {
    scanDir: path.join(PROJECT_ROOT, 'doc'),
    additionalScanDirs: [PROJECT_ROOT],
    templatePath: path.resolve(__dirname, '..', 'templates', 'guide.html'),
    filePattern: f => /Guide\.md$/i.test(f),
    bodyAttr: 'data-doctype="guide"',
    generatorMeta: 'doc-writer guide',
    brand: 'Guide',
    needsMermaid: true,
    vendorRel: 'assets/vendor/',  // 内网可移植：JS/CSS 本地 vendor（checkNoCdnAssets 强制）
    layout: 'section',
    sectionIdMap: {
      '1': 'sec-overview', '2': 'sec-quickstart', '3': 'sec-arch',
      '4': 'sec-config', '5': 'sec-executor', '6': 'sec-signal',
      '7': 'sec-fault', '8': 'sec-test', '9': 'sec-advanced',
      '10': 'sec-faq',
    },
    shouldBeOpen() { return true; },
    buildMetaRows(meta) {
      const rows = [];
      if (meta.generatedBy) rows.push(`<dt>生成方式</dt><dd>${meta.generatedBy}</dd>`);
      if (meta.writeDate) rows.push(`<dt>编写日期</dt><dd>${meta.writeDate}</dd>`);
      if (meta.srcPath) rows.push(`<dt>源码位置</dt><dd>${metaCode(meta.srcPath)}</dd>`);
      return rows.join('\n          ');
    },
    extraMetaKeys: {
      '项目名': 'projectName', '源码位置': 'srcPath',
      '生成方式': 'generatedBy',
    },
    indexConfig: null,
  }
};

// Auto-detect type from file path
// P1（Codex PR r2）：消费者仓库无人 stage vendor——生成器自动落位。
// scripts/vendor 是随脚本分发的权威副本；按输出 HTML 的 vendorRel 解析目标目录，
// 缺失即拷（幂等；已存在不覆盖；只读文件系统静默跳过——缺失由 checkLocalAssets 兜底报告）。
function stageVendorAssets(htmlPath, vendorRel) {
  const srcDir = path.join(__dirname, 'vendor');
  if (!fs.existsSync(srcDir)) return;
  const targetDir = path.resolve(path.dirname(htmlPath), vendorRel);
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const f of fs.readdirSync(srcDir)) {
      const to = path.join(targetDir, f);
      if (!fs.existsSync(to)) fs.copyFileSync(path.join(srcDir, f), to);
    }
  } catch (e) { /* staging 尽力而为 */ }
}

function detectType(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  // 2026-09-16 二次勘误（Codex PR review）：目录判定必须先于名字判定——
  // doc/tech-docs/Detailed_Design.md 这类"撞系统名"的模块文档会被名字规则抢走，
  // 拿到 system 的 vendorRel（少一个 ../）→ 本地资产 404。正确优先级：
  // ① Guide 名 ② tech-docs 目录 ③ doc 根目录或系统名 ④ _Design 后缀。
if (/Guide\.md$/i.test(path.basename(filePath))) return 'guide';
  if (/doc\/tech-docs\//.test(normalized)) return 'module';
  if (/(?:^|\/)doc\/[^/]+$/i.test(normalized) || /Architecture|Detailed|Requirements/.test(path.basename(filePath))) return 'system';
  if (/_Design\.md$/.test(normalized)) return 'module';
  return 'module'; // default
}

// ============================================================
// Shared functions
// ============================================================

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readTemplate(templatePath) {
  const raw = fs.readFileSync(templatePath, 'utf-8');
  const styleMatch = raw.match(/<style>([\s\S]*?)<\/style>/);
  const scriptMatches = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  const lastScript = scriptMatches[scriptMatches.length - 1] || '';
  const jsMatch = lastScript.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return {
    css: styleMatch ? styleMatch[1] : '',
    js: jsMatch ? jsMatch[1] : ''
  };
}

// <scanDir>/doc-meta.json：项目级元数据（索引卡片分组 + 品牌名 + 源码链接前缀）。
//   brand       顶栏品牌名（缺省用类型默认值）
//   sourceBase  {{file:line}} 链接前缀："auto" = 从 HTML 所在目录回到项目根的相对路径；
//               其他字符串原样作前缀；缺省 = 不加前缀（href 即 {{}} 里写的路径）
const docMetaCache = new Map();
function loadDocMeta(typeConfig) {
  const metaPath = path.join(typeConfig.scanDir, 'doc-meta.json');
  if (!docMetaCache.has(metaPath)) {
    let meta = {};
    if (fs.existsSync(metaPath)) {
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); }
      catch (e) { console.error(`  WARN  ${path.relative(PROJECT_ROOT, metaPath)} is not valid JSON (${e.message}); ignored`); }
    }
    docMetaCache.set(metaPath, meta);
  }
  return docMetaCache.get(metaPath);
}

function resolveSourceBase(typeConfig, htmlPath) {
  const base = loadDocMeta(typeConfig).sourceBase;
  if (!base) return '';
  if (base === 'auto') {
    const rel = path.relative(path.dirname(htmlPath), PROJECT_ROOT).split(path.sep).join('/');
    return rel ? rel + '/' : '';
  }
  return String(base).replace(/\/?$/, '/');
}

// 同一文档内 id 唯一：多个"附录"/"术语表"章节会映射到同一个 id（sec-appendix），
// 导致重复 id、TOC 锚点跳错。后出现者追加 -2、-3…
let usedIds = new Set();
function uniqueId(id) {
  let candidate = id, n = 2;
  while (usedIds.has(candidate)) candidate = `${id}-${n++}`;
  usedIds.add(candidate);
  return candidate;
}
function uniqueSectionId(heading, typeConfig) {
  const id = uniqueId(sectionId(heading, typeConfig));
  usedIds.add(`${id}-h`);   // h2 的派生 id 一并占位
  return id;
}

// 元数据值：作者常把路径写成 `a.h`（自带反引号）。裸值包进 <code>；已带反引号的走行内渲染，
// 避免 <code>`a.h`</code> 把字面反引号显示给读者。
function metaCode(value) {
  return value.includes('`') ? inlineMarkdown(value) : `<code>${escapeHtml(value)}</code>`;
}

function parseMdMeta(lines, typeConfig) {
  const meta = { extra: [] };
  for (const [i, line] of lines.entries()) {
    if (/^\|\s*项目\s*\|/.test(line)) continue;
    if (/^\|[-\s:|]+\|$/.test(line)) continue;
    if (/^\|[-\s:|]+\|$/.test(lines[i + 1] || '')) continue;   // 表头行（紧邻分隔行之前），如 | 字段 | 值 |
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim();
      // Common keys
      if (key === '文档版本' || key === 'Version') meta.version = val;
      else if (key === '编写日期' || key === 'Date') meta.writeDate = val;
      else if (key === '更新日期' || key === 'Updated') meta.updateDate = val;
      // Type-specific keys
      else if (typeConfig.extraMetaKeys[key]) {
        meta[typeConfig.extraMetaKeys[key]] = val;
      }
      // 其余行（目标读者、关联文件、变更类型……）保留为附加元数据行，不再静默丢弃
      else meta.extra.push([key, val]);
    }
  }
  return meta;
}

// CommonMark 围栏状态机：开启 = 缩进 + ≥3 个反引号 + 不含反引号的 info string（列表项内缩进的围栏也算）；
// 关闭 = 反引号数 ≥ 开启行的纯反引号行。逐行推进，返回新状态（null = 围栏外）。
function nextFenceState(fence, line) {
  if (fence) {
    const close = line.match(/^\s*(`{3,})\s*$/);
    return close && close[1].length >= fence.len ? null : fence;
  }
  const open = line.match(/^(\s*)(`{3,})([^`]*)$/);
  return open ? { len: open[2].length, indent: open[1].length, lang: open[3].trim() } : null;
}

function parseMarkdownSections(content, typeConfig) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  let currentH2 = null;
  let currentBody = [];
  let metaLines = [];
  let listMetaLines = [];
  let inMeta = false;
  let title = '';
  let hadFirstH2 = false;
  let fence = null;
  // 整篇走完围栏状态机仍停在围栏内 = Markdown 本身围栏不配对：此时退回“按行切章节”的旧行为（否则未闭合围栏会吞掉全文标题），并告警。
  const fenceAware = lines.reduce(nextFenceState, null) === null;
  let prelude = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 围栏内的 # / ## / --- 是代码内容，不是文档结构：
    // 否则 ```markdown 示例里的 "## Cycle 1" 会把代码块劈成假章节，--- 行也会被吞掉。
    if (fenceAware) {
      const wasInFence = fence !== null;
      fence = nextFenceState(fence, line);
      if (wasInFence || fence) {
        (inMeta ? metaLines : currentBody).push(line);
        continue;
      }
    }

    if (/^# /.test(line) && !title) {
      title = line.replace(/^# /, '').trim();
      continue;
    }

    if (/^## 文档信息|^## Document Info/i.test(line)) { inMeta = true; continue; }
    if (inMeta) {
      if (/^---/.test(line) || /^## /.test(line)) {
        inMeta = false;
        if (/^## /.test(line)) i--;
      } else {
        metaLines.push(line);
      }
      continue;
    }

    if (/^## 目录|^## Table of Contents/i.test(line)) {
      while (i + 1 < lines.length && !(/^## /.test(lines[i + 1]) && !/^## 目录|^## Table of Contents/i.test(lines[i + 1]))) {
        i++;
        if (lines[i + 1] && /^---$/.test(lines[i + 1])) { i++; break; }
      }
      continue;
    }

    if (/^---$/.test(line)) continue;

    // List-style meta before first ## heading: - key: value
    if (!hadFirstH2 && /^-\s+.+:\s+.+/.test(line)) {
      listMetaLines.push(line);
      continue;
    }

    if (/^## /.test(line)) {
      if (!hadFirstH2) prelude = currentBody.join('\n').trim();   // 首个 ## 之前的内容（标题下的横幅、导语）
      hadFirstH2 = true;
      if (currentH2) {
        sections.push({ heading: currentH2, body: currentBody.join('\n') });
      }
      currentH2 = line.replace(/^## /, '').trim();
      currentBody = [];
      continue;
    }

    currentBody.push(line);
  }
  if (currentH2) {
    sections.push({ heading: currentH2, body: currentBody.join('\n') });
  }

  // 文档信息区：表格行进元数据；其余行（如 > **相关源码**：…）并回首节正文，不丢内容
  const metaTable = metaLines.filter(l => /^\s*\|/.test(l));
  const metaRest = metaLines.filter(l => !/^\s*\|/.test(l) && l.trim() !== '');
  if (metaRest.length && sections.length) sections[0].body = metaRest.join('\n') + '\n\n' + sections[0].body;
  const meta = parseMdMeta(metaTable, typeConfig);
  // Merge list-style meta (- key: value) into meta
  for (const lm of listMetaLines) {
    const m = lm.match(/^-\s+(.+?):\s+(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^`|`$/g, '');
    if (key === '文档版本' || key === 'Version') meta.version = val;
    else if (key === '编写日期' || key === 'Date') meta.writeDate = val;
    else if (key === '更新日期' || key === 'Updated') meta.updateDate = val;
    else if (typeConfig.extraMetaKeys[key]) meta[typeConfig.extraMetaKeys[key]] = val;
  }
  return { title, meta, sections, prelude, unbalancedFence: !fenceAware };
}

// {{file:line}} → <a class="source-ref">。href 前缀由当前文档的 sourceBase（doc-meta.json）决定；
// 绝对路径 / URL / 锚点不加前缀。
let currentSourceBase = '';
function sourceRefAnchor(source) {
  const external = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(source.file);
  return `<a class="source-ref" href="${external ? '' : currentSourceBase}${source.href}"><code>${source.label}</code></a>`;
}

function inlineMarkdown(text) {
  // 行内代码先摘出占位：其内容不得被强调/链接/{{引用}} 规则改写。
  // 旧顺序（先强调后代码）会把 C++ 指针签名 `T*, U*` 里的 * 当成 *斜体*：吞掉星号并插入 <em>，
  // 已发布文档里的 API 签名因此是错的，且没有任何校验器能发现。
  const codes = [];
  // 反引号按 CommonMark 的“等长反引号串”配对：``a`b`` 与 ```x``` 也是行内代码
  const shielded = text.replace(/(`+)(?!`)(.+?)(?<!`)\1(?!`)/g, (_, ticks, code) => {
    codes.push(ticks.length > 1 ? code.replace(/^ (.*\S.*) $/, '$1') : code);
    return `\uE000${codes.length - 1}\uE001`;
  });
  let out = shielded
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?=[^\s*])(.+?)(?<=[^\s*])\*/g, '<em>$1</em>')   // 强调不跨空白边界：`2 * 3 * 4` 不是斜体
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // {{file:line}} source references in prose
  out = out.replace(/\{\{([^}]+?)\}\}/g, (_, ref) => {
    const source = parseSourceReference(ref);
    return source ? sourceRefAnchor(source) : `<code>${escapeHtml(ref)}</code>`;
  });
  // 还原行内代码。整段只含一个 {{file:line}} 的代码（`{{src/a.h:1}}`，作者常见写法）渲染为源码引用锚点，
  // 不再产生 <code><a><code>…</code></a></code> 嵌套——validate-doc 会剥掉 <code> 内的锚点，
  // 嵌套输出曾让 HDSA 134 份文档被误报"无源码引用"。
  return out.replace(/\uE000(\d+)\uE001/g, (_, i) => {
    const code = codes[Number(i)];
    const lone = code.match(/^\{\{([^{}\n]+)\}\}$/);
    const source = lone && parseSourceReference(lone[1]);
    if (source) return sourceRefAnchor(source);
    return `<code>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`;
  });
}

/**
 * Fix common Mermaid syntax issues.
 */
function fixMermaidContent(content) {
  content = content.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  content = content.replace(/-\.\>(?!-)/g, '-.->');
  var prev;
  do {
    prev = content;
    content = content.replace(/\["([^"]*\{[^}]*)"\]/g, function(_, inner) {
      return '["' + inner.replace(/\{/g, '【').replace(/\}/g, '】') + '"]';
    });
  } while (content !== prev);
  // & < > 必须全部以 HTML 实体写入 —— 若原样输出，浏览器把 <br/>、以及 a1<b2 里的 <b2 当真标签解析，
  // mermaid.run 读 textContent 时标签内容消失（换行丢失、节点文字被吞到下一个 > 为止）。
  // 实体在 DOM textContent 里解码回字面量，mermaid 正常解析。
  content = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return content;
}

function mdBodyToHtml(body, needsMermaid) {
  const lines = body.split('\n');
  // 本段末尾仍在围栏内（作者漏写了关闭围栏）：补一个关闭围栏，代码原样保留；否则这段代码会被静默丢弃。
  const unclosed = lines.reduce(nextFenceState, null);
  if (unclosed) lines.push('`'.repeat(unclosed.len));
  const out = [];
  let inCode = false;
  let fence = null;   // nextFenceState 的当前围栏；content 行按开启行的缩进去缩进
  let codeLang = '';
  let codeLines = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listItems = [];
  let inOl = false;
  let olItems = [];
  let inBlockquote = false;
  let blockquoteLines = [];
  let pendingFigcaption = null;

  // 图注只服务紧随其后的 mermaid；后面不是 mermaid 时按普通说明文字输出，不得静默丢弃。
  function flushOrphanCaption() {
    if (!pendingFigcaption) return;
    out.push(`<p>${inlineMarkdown(pendingFigcaption)}</p>`);
    pendingFigcaption = null;
  }

  function flushList() {
    if (listItems.length) {
      out.push('<ul>');
      listItems.forEach(li => out.push(`  <li>${inlineMarkdown(li)}</li>`));
      out.push('</ul>');
      listItems = [];
      inList = false;
    }
  }

  function flushOl() {
    if (olItems.length) {
      out.push('<ol>');
      olItems.forEach(li => out.push(`  <li>${inlineMarkdown(li)}</li>`));
      out.push('</ol>');
      olItems = [];
      inOl = false;
    }
  }

  function flushTable() {
    // 第二行必须是 |---|---| 分隔行，否则不是合法表格（典型：表头粘在上一段末尾，首个数据行会被当成分隔行吞掉）。
    // 此时按文字原样输出：宁可难看，也不能静默丢数据行。
    const isDelimiter = r => r.length > 0 && r.every(c => /^:?-+:?$/.test(c));
    if (tableRows.length && (tableRows.length < 2 || !isDelimiter(tableRows[1]))) {
      tableRows.forEach(r => out.push(`<p>${inlineMarkdown(`| ${r.join(' | ')} |`)}</p>`));
      tableRows = [];
      inTable = false;
      return;
    }
    if (tableRows.length < 2) { tableRows = []; inTable = false; return; }
    out.push('<div class="table-wrapper"><table>');
    const headers = tableRows[0];
    out.push('<thead><tr>' + headers.map(h => `<th>${inlineMarkdown(h)}</th>`).join('') + '</tr></thead>');
    out.push('<tbody>');
    for (let r = 2; r < tableRows.length; r++) {
      out.push('<tr>' + tableRows[r].map(c => `<td>${inlineMarkdown(c)}</td>`).join('') + '</tr>');
    }
    out.push('</tbody></table></div>');
    tableRows = [];
    inTable = false;
  }

  function flushBlockquote() {
    if (!blockquoteLines.length) { inBlockquote = false; return; }
    const content = blockquoteLines.map(l => l.replace(/^>\s?/, '')).join(' ').trim();
    const inner = blockquoteLines.map(l => l.replace(/^>\s?/, '')).join('\n');
    blockquoteLines = [];
    inBlockquote = false;

    // Scope block: > **Scope**：... or > **Scope**: ...
    if (/^\*\*Scope\*\*[：:]/i.test(content)) {
      out.push(`<div class="scope-block">${inlineMarkdown(content)}</div>`);
      return;
    }
    // Figcaption: > 图 X.X — ... (store for next mermaid)
    if (/^图\s*\d+(\.\d+)?\s*[—–\-]/.test(content)) {
      pendingFigcaption = content;
      return;
    }
    // Source reference block: > **相关源码**: ... or > 相关源码：...
    if (/^\*?\*?相关源码\*?\*?[：:]/i.test(content)) {
      const refs = content.replace(/^\*?\*?相关源码\*?\*?[：:]\s*/i, '');
      out.push(`<div class="relevant-sources"><span class="sources-label">相关源码</span> ${inlineMarkdown(refs)}</div>`);
      return;
    }
    // Generic blockquote
    // 引用块里可以有多段、列表、表格：递归按块渲染（旧实现把所有行拼成一段，表格被压成一行文字）
    out.push(`<blockquote>\n${mdBodyToHtml(inner, needsMermaid)}\n</blockquote>`);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (pendingFigcaption && !inCode && !inBlockquote && line.trim() !== '' && !/^\s*```\s*mermaid/.test(line)) flushOrphanCaption();

    const prevFence = fence;
    fence = nextFenceState(fence, line);
    if (Boolean(prevFence) !== Boolean(fence)) {
      if (!inCode) {
        flushList(); flushOl(); flushTable(); flushBlockquote();
        inCode = true;
        codeLang = fence.lang;
        codeLines = [];
      } else {
        const content = codeLines.join('\n');
        if (codeLang === 'mermaid' && needsMermaid) {
          const figHtml = pendingFigcaption ? `<figcaption>${inlineMarkdown(pendingFigcaption)}</figcaption>` : '';
          out.push(`<div class="mermaid-wrap"><pre class="mermaid">\n${fixMermaidContent(content)}\n</pre>${figHtml}</div>`);
          pendingFigcaption = null;
        } else {
          const isAsciiArt = !codeLang || codeLang === '' || /[┌└├─│▼▶◀]/.test(content);
          if (isAsciiArt && !codeLang) {
            out.push(`<div class="code-block"><pre><code>${escapeHtml(content)}</code></pre></div>`);
          } else {
            const lang = codeLang || '';
            const langClass = lang ? ` class="language-${lang}"` : '';
            out.push(`<div class="code-block" data-lang="${lang}"><pre><code${langClass}>${escapeHtml(content)}</code></pre></div>`);
          }
        }
        inCode = false;
        codeLang = '';
      }
      continue;
    }

    if (inCode) { codeLines.push(line.replace(new RegExp(`^\\s{0,${fence.indent}}`), '')); continue; }

    // Raw HTML block: line is a standalone HTML tag like '<div ...>', '</div>',
    // '<details>', '<summary>...</summary>', '<p>...</p>'.
    // CommonMark 规范允许 markdown 中嵌入 raw HTML 块——直通不转义。
    if (/^<\/?[a-z][a-z0-9-]*\b[^>]*>(.*)$/i.test(line.trim()) && !line.trim().startsWith('<!--')) {
      flushList(); flushOl(); flushTable(); flushBlockquote();
      out.push(line);
      continue;
    }

    // Blockquote lines: > ...
    if (/^>\s?/.test(line)) {
      flushList(); flushOl(); flushTable();
      inBlockquote = true;
      blockquoteLines.push(line);
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    if (/^\|/.test(line)) {
      flushList(); flushOl();
      const cells = line.split(/(?<!\\)\|/).slice(1, -1).map(c => c.replace(/\\\|/g, '|').trim());   // \| 是单元格内的字面竖线
      if (!inTable) inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (/^[-*] /.test(line)) {
      flushOl(); flushTable();
      inList = true;
      listItems.push(line.replace(/^[-*] /, ''));
      continue;
    } else if (inList) {
      flushList();
    }

    if (/^\d+\. /.test(line)) {
      flushList(); flushTable();
      inOl = true;
      olItems.push(line.replace(/^\d+\. /, ''));
      continue;
    } else if (inOl) {
      flushOl();
    }

    // 正文里的次级 H1（如“# 以下为 V1.0 历史内容”分隔标题）：保留为醒目的分隔行，不进入目录结构
    if (/^# /.test(line)) {
      flushList(); flushOl(); flushTable();
      out.push(`<p class="doc-divider"><strong>${inlineMarkdown(line.replace(/^# /, '').trim())}</strong></p>`);
      continue;
    }

    if (/^### /.test(line)) {
      flushList(); flushOl(); flushTable();
      const heading = line.replace(/^### /, '').trim();
      const h3id = 'sec-' + heading.replace(/[^\w一-鿿]/g, '').toLowerCase().slice(0, 30);
      out.push(`<h3 id="${uniqueId(h3id)}">${inlineMarkdown(heading)}</h3>`);
      continue;
    }

    if (/^#### /.test(line)) {
      flushList(); flushOl(); flushTable();
      const heading = line.replace(/^#### /, '').trim();
      out.push(`<h4>${inlineMarkdown(heading)}</h4>`);
      continue;
    }

    if (line.trim() === '') { continue; }

    flushList(); flushOl(); flushTable();
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  flushList(); flushOl(); flushTable(); flushBlockquote(); flushOrphanCaption();
  return out.join('\n');
}

// ============================================================
// HTML builder
// ============================================================

function sectionId(heading, typeConfig) {
  const num = heading.match(/^(\d+)\./);
  if (num && typeConfig.sectionIdMap[num[1]]) return typeConfig.sectionIdMap[num[1]];
  if (/附录|appendix/i.test(heading)) return 'sec-appendix';
  if (/术语表|glossary/i.test(heading)) return 'sec-glossary';
  const partMatch = heading.match(/第(.+?)部分/);
  if (partMatch) return 'sec-part-' + partMatch[1];
  return 'sec-' + heading.replace(/[^\w\u4e00-\u9fff]/g, '').toLowerCase().slice(0, 20);
}

function buildHtml(parsed, template, typeConfig) {
  const { title, meta, sections, prelude } = parsed;
  usedIds = new Set();
  // 首个 ## 之前的内容（如“已过时”横幅）：紧随标题，始终可见，不进折叠节
  const preludeHtml = prelude ? `<div class="doc-prelude">\n${mdBodyToHtml(prelude, typeConfig.needsMermaid)}\n</div>\n` : '';
  const brand = loadDocMeta(typeConfig).brand || typeConfig.brand || 'Documentation';
  const lang = docLang || 'zh-CN';
  // 内网可移植契约：JS/CSS 一律本地 vendor（相对输出 HTML 的 doc 根）；禁 CDN——
// validate-doc.js checkNoCdnAssets 在校验层拒绝回归。资产见 doc/assets/vendor/。
const vendor = typeConfig.vendorRel || 'assets/vendor/';
const mermaidScript = typeConfig.needsMermaid
    ? `\n  <script src="${vendor}mermaid.min.js"></script>`
    : '';
const projectName = meta.projectName || title;

  // Guide layout uses <section> instead of <details>
  if (typeConfig.layout === 'section') {
    const sectionsHtml = sections.map(s => {
      const id = uniqueSectionId(s.heading, typeConfig);
      const bodyHtml = mdBodyToHtml(s.body, typeConfig.needsMermaid);
      return `
      <section class="section doc-section" id="${id}">
        <h2 class="section-title" id="${id}-h">${inlineMarkdown(s.heading)}</h2>
${bodyHtml}
      </section>`;
    }).join('\n');

    const metaLine = [
      meta.writeDate ? `生成日期: ${meta.writeDate}` : '',
      meta.generatedBy ? `生成方式: ${meta.generatedBy}` : '',
    ].filter(Boolean).join(' | ');

    return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="${typeConfig.generatorMeta}">
  <title>${escapeHtml(projectName)} — 技术指导文档</title>
  <link rel="stylesheet" href="${vendor}hl-github.min.css" media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)">
  <link rel="stylesheet" href="${vendor}hl-github-dark.min.css" media="(prefers-color-scheme: dark)">
  <style>${template.css}</style>
</head>
<body ${typeConfig.bodyAttr}>

<div class="topbar">
  <button class="btn-icon sidebar-toggle" onclick="toggleSidebar()" aria-label="Toggle sidebar" title="目录">&#9776;</button>
  <span class="topbar-brand">${escapeHtml(projectName)}</span>
  <span class="topbar-sep">/</span>
  <span class="topbar-title">技术指导文档</span>
  <div class="topbar-actions">
    <button class="btn-icon" onclick="toggleTheme()" aria-label="Toggle theme" title="切换主题">&#9681;</button>
  </div>
</div>

<div class="layout">
  <aside class="sidebar" id="sidebar">
    <div class="toc-title">目录</div>
    <nav id="toc"></nav>
  </aside>

  <main class="main-content">
${preludeHtml}${sectionsHtml}
  </main>
</div>

<footer class="doc-footer">
  <p>${escapeHtml(projectName)} — 技术指导文档</p>
  <p>${escapeHtml(metaLine)}</p>
</footer>

  <script src="${vendor}highlight.min.js"></script>${mermaidScript}
  <script>${template.js}</script>
</body>
</html>`;
  }

  // Default layout: details-based (module / system)
  const sectionsHtml = sections.map(s => {
    const id = uniqueSectionId(s.heading, typeConfig);
    const open = typeConfig.shouldBeOpen(s.heading) ? ' open' : '';
    const bodyHtml = mdBodyToHtml(s.body, typeConfig.needsMermaid);
    return `
      <details${open} id="${id}">
        <summary><h2 id="${id}-h">${inlineMarkdown(s.heading)}</h2></summary>
        <div class="section-body">
${bodyHtml}
        </div>
      </details>`;
  }).join('\n');

  const extraRows = (meta.extra || [])
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${inlineMarkdown(value)}</dd>`)
    .join('\n          ');
  const metaRows = [typeConfig.buildMetaRows(meta), extraRows].filter(Boolean).join('\n          ');

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="${typeConfig.generatorMeta}">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${vendor}hl-github.min.css" media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)">
  <link rel="stylesheet" href="${vendor}hl-github-dark.min.css" media="(prefers-color-scheme: dark)">
  <style>${template.css}</style>
</head>
<body ${typeConfig.bodyAttr}>

  <nav class="topbar">
    <span class="topbar-brand">${escapeHtml(brand)}</span>
    <span class="topbar-sep">/</span>
    <span class="topbar-title">${escapeHtml(title)}</span>
    <div class="topbar-actions">
      <button class="topbar-btn menu-toggle" onclick="toggleSidebar()" title="目录">&#9776;</button>
      <button class="topbar-btn" onclick="toggleTheme()" title="切换主题">&#9680;</button>
      <button class="topbar-btn" onclick="window.print()" title="打印">&#9113;</button>
    </div>
  </nav>

  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <nav><ul class="toc-list" id="toc"></ul></nav>
    </aside>

    <article class="main" id="content">
      <header class="doc-meta">
        <span class="doc-version">${inlineMarkdown(meta.version || 'V1.0')}</span>
        <h1>${escapeHtml(title)}</h1>
        <dl class="meta-grid">
          ${metaRows}
        </dl>
      </header>

${preludeHtml}${sectionsHtml}

    </article>
  </div>

  <script src="${vendor}highlight.min.js"></script>${mermaidScript}
  <script>${template.js}</script>
</body>
</html>`;
}

// ============================================================
// Index generation
// ============================================================

function generateIndex(typeConfig, projectName, projectDesc) {
  const cfg = typeConfig.indexConfig;
  if (!fs.existsSync(cfg.templatePath)) {
    console.log(`  ERROR ${path.basename(cfg.templatePath)} not found`);
    process.exit(1);
  }

  const tpl = fs.readFileSync(cfg.templatePath, 'utf-8');
  const scanDir = typeConfig.scanDir;

  const htmlFiles = fs.readdirSync(scanDir)
    .filter(f => f.endsWith('.html') && f !== 'index.html' && typeConfig.filePattern(f.replace('.html', '.md')));

  const { filterButtons, cardGroups, count } = cfg.getCards(htmlFiles, scanDir);

  let html = tpl
    .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
    .replace(/\{\{PROJECT_DESC\}\}/g, projectDesc)
    .replace('{{FILTER_BUTTONS}}', filterButtons)
    .replace('{{CARD_GROUPS}}', cardGroups);

  if (dryRun) {
    console.log(`  DRY   index.html (${count} docs)`);
  } else {
    if (tpl.includes('src="assets/vendor/')) stageVendorAssets(cfg.outputPath, TYPE_CONFIG.system.vendorRel);
    fs.writeFileSync(cfg.outputPath, html, 'utf-8');
    console.log(`  OK    index.html (${count} docs)`);
  }
}

// ============================================================
// Main
// ============================================================

if (args.includes('--help') || (!convertAll && !shouldGenerateIndex && files.length === 0)) {
  console.log('Usage: node md-to-html.js [--type module|system|guide] [--all] [--index] [--force] [--dry-run] [file.md ...]');
  console.log('  --type     Specify doc type (auto-detected from path if omitted)');
  console.log('  --all      Convert all matching .md files');
  console.log('  --index    Generate index.html navigation page');
  console.log('  --lang     HTML lang attribute (default: zh-CN)');
  console.log('  --force    Overwrite existing HTML files');
  console.log('  --dry-run  Preview without writing');
  process.exit(0);
}

// Resolve type — per-file when batch-mixed (2026-09-24 fix)
// Bug: previously the whole batch used files[0]'s type. Mixing tech-docs (module)
// with a root-level Architecture doc (system) produced wrong vendorRel → ../assets/
// → 404 → zero mermaid rendering. --type explicit keeps whole-batch same (back-compat).
const resolveTypeFor = (f) => docType || detectType(f);
const resolvedType = docType || (files.length > 0 ? resolveTypeFor(files[0]) : 'module');
const typeConfig = TYPE_CONFIG[resolvedType];
if (!typeConfig) {
  console.error(`  ERROR Unknown type: ${resolvedType}. Use 'module', 'system', or 'guide'.`);
  process.exit(1);
}

const templateCache = new Map();
function templateFor(type) {
  if (!templateCache.has(type))
    templateCache.set(type, readTemplate(TYPE_CONFIG[type].templatePath));
  return templateCache.get(type);
}
const template = templateFor(resolvedType);

if (shouldGenerateIndex) {
  if (!typeConfig.indexConfig) {
    console.error(`  ERROR --index is not supported for type '${resolvedType}'.`);
    process.exit(1);
  }
  const projectName = files[0] || typeConfig.indexConfig.projectNameDefault;
  const projectDesc = files[1] || typeConfig.indexConfig.projectDescDefault;
  generateIndex(typeConfig, projectName, projectDesc);
} else {
  let targets = [];
  if (convertAll) {
    const scanDirs = [typeConfig.scanDir, ...(typeConfig.additionalScanDirs || [])];
    targets = scanDirs.filter(dir => fs.existsSync(dir) && fs.statSync(dir).isDirectory())
      .flatMap(dir => fs.readdirSync(dir)
        .filter(f => /\.md$/i.test(f) && typeConfig.filePattern(f))
        .map(f => path.join(dir, f)));
  } else {
    targets = files.map(f => path.resolve(f));
  }

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  if (targets.length === 0) {
    console.error('ERROR No Markdown inputs found');
    process.exit(1);
  }

  for (const mdPath of targets) {
    if (!fs.existsSync(mdPath)) {
      console.error(`  ERROR ${mdPath} (not found)`);
      failed++;
      continue;
    }

    if (!/\.md$/i.test(mdPath) || !fs.statSync(mdPath).isFile()) {
      console.error(`  ERROR ${mdPath} (expected a Markdown file)`);
      failed++;
      continue;
    }
    const htmlPath = mdPath.replace(/\.md$/i, '.html');
    if (fs.existsSync(htmlPath) && !force) {
      console.log(`  SKIP  ${path.basename(mdPath)} (HTML already exists)`);
      skipped++;
      continue;
    }

    const md = fs.readFileSync(mdPath, 'utf-8');
    // Per-file type (2026-09-24): when --type not explicitly set, each file
    // gets its own detectType + template. Prevents batch-mixed type pollution.
    const fileConfig = docType ? typeConfig : TYPE_CONFIG[resolveTypeFor(mdPath)];
    currentSourceBase = resolveSourceBase(fileConfig, htmlPath);
    const fileTemplate = docType ? template : templateFor(resolveTypeFor(mdPath));
    const parsed = parseMarkdownSections(md, fileConfig);
    if (parsed.unbalancedFence) {
      console.log(`  WARN  ${path.basename(mdPath)}: unbalanced code fences (odd number of triple-backtick lines) - fix the Markdown, sections and code blocks may render wrongly`);
    }
    const html = buildHtml(parsed, fileTemplate, fileConfig);

    if (dryRun) {
      console.log(`  DRY   ${path.basename(mdPath)} -> ${path.basename(htmlPath)} (${parsed.sections.length} sections)`);
    } else {
      stageVendorAssets(htmlPath, (docType ? typeConfig : fileConfig).vendorRel || 'assets/vendor/');
      fs.writeFileSync(htmlPath, html, 'utf-8');
      console.log(`  OK    ${path.basename(mdPath)} -> ${path.basename(htmlPath)} (${parsed.sections.length} sections)`);
    }
    converted++;
  }

  console.log(`\nDone: ${converted} converted, ${skipped} skipped${failed ? `, ${failed} failed` : ''}${dryRun ? ' (dry run)' : ''}`);
  if (failed) process.exitCode = 1;
}
