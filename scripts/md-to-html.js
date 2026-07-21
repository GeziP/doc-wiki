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

const args = process.argv.slice(2);
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
    filePattern: f => f.endsWith('_Design.md'),
    bodyAttr: 'data-doctype="tech-design"',
    generatorMeta: 'doc-writer module',
    brand: 'Module Docs',
    needsMermaid: true,
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
      if (meta.implFile) rows.push(`<dt>实现文件</dt><dd><code>${meta.implFile}</code></dd>`);
      if (meta.testFile) rows.push(`<dt>测试文件</dt><dd><code>${meta.testFile}</code></dd>`);
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
    filePattern: f => /Architecture_Design\.md$|Detailed_Design.*\.md$|Requirements.*\.md$/.test(f),
    bodyAttr: 'data-doctype="system-design"',
    generatorMeta: 'doc-writer system',
    brand: 'System Docs',
    needsMermaid: true,
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
      if (meta.srcPath) rows.push(`<dt>源码位置</dt><dd><code>${meta.srcPath}</code></dd>`);
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
    templatePath: path.resolve(__dirname, '..', 'templates', 'guide.html'),
    filePattern: f => /Guide\.md$/i.test(f),
    bodyAttr: 'data-doctype="guide"',
    generatorMeta: 'doc-writer guide',
    brand: 'Guide',
    needsMermaid: true,
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
      if (meta.srcPath) rows.push(`<dt>源码位置</dt><dd><code>${meta.srcPath}</code></dd>`);
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
function detectType(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (/Guide\.md$/i.test(path.basename(filePath))) return 'guide';
  if (/doc\/tech-docs\//.test(normalized) || /_Design\.md$/.test(normalized)) return 'module';
  if (/Architecture|Detailed|Requirements/.test(path.basename(filePath))) return 'system';
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

function parseMdMeta(lines, typeConfig) {
  const meta = {};
  for (const line of lines) {
    if (/^\|\s*文档版本/.test(line) || /^\|\s*项目\s*\|/.test(line)) continue;
    if (/^\|[-\s|]+\|$/.test(line)) continue;
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim();
      // Common keys
      if (key === '文档版本' || key === 'Version') meta.version = val;
      else if (key === '编写日期' || key === 'Date') meta.writeDate = val;
      else if (key === '更新日期' || key === 'Updated') meta.updateDate = val;
      else if (key === '目标读者' || key === 'Audience') meta.audience = val;
      // Type-specific keys
      else if (typeConfig.extraMetaKeys[key]) {
        meta[typeConfig.extraMetaKeys[key]] = val;
      }
    }
  }
  return meta;
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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

  const meta = parseMdMeta(metaLines, typeConfig);
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
  return { title, meta, sections };
}

function inlineMarkdown(text) {
  let out = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  out = out
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // {{file:line}} source references
  out = out.replace(/\{\{([^}]+?)\}\}/g, (_, ref) => {
    const parts = ref.match(/^(.+?):(\d+)(?:-(\d+))?$/);
    if (parts) {
      const file = parts[1];
      const start = parts[2];
      const end = parts[3] ? `-${parts[3]}` : '';
      const href = `${file}#L${start}${end ? '-L' + end : ''}`;
      return `<a class="source-ref" href="${href}"><code>${file}:${start}${end}</code></a>`;
    }
    return `<code>${escapeHtml(ref)}</code>`;
  });
  return out;
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
  return content;
}

function mdBodyToHtml(body, needsMermaid) {
  const lines = body.split('\n');
  const out = [];
  let inCode = false;
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
    out.push(`<blockquote><p>${inlineMarkdown(content)}</p></blockquote>`);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^```/.test(line)) {
      if (!inCode) {
        flushList(); flushOl(); flushTable(); flushBlockquote();
        inCode = true;
        codeLang = line.replace(/^```/, '').trim();
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

    if (inCode) { codeLines.push(line); continue; }

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
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
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

    if (/^### /.test(line)) {
      flushList(); flushOl(); flushTable();
      const heading = line.replace(/^### /, '').trim();
      const h3id = 'sec-' + heading.replace(/[^\w一-鿿]/g, '').toLowerCase().slice(0, 30);
      out.push(`<h3 id="${h3id}">${inlineMarkdown(heading)}</h3>`);
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

  flushList(); flushOl(); flushTable(); flushBlockquote();
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
  const { title, meta, sections } = parsed;
  const brand = typeConfig.brand || 'Documentation';
  const lang = docLang || 'zh-CN';
  const mermaidScript = typeConfig.needsMermaid
    ? '\n  <script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.0/mermaid.min.js"></script>'
    : '';
  const projectName = meta.projectName || title;

  // Guide layout uses <section> instead of <details>
  if (typeConfig.layout === 'section') {
    const sectionsHtml = sections.map(s => {
      const id = sectionId(s.heading, typeConfig);
      const bodyHtml = mdBodyToHtml(s.body, typeConfig.needsMermaid);
      return `
      <section class="doc-section" id="${id}">
        <h2 id="${id}-h">${s.heading}</h2>
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
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
  <style>${template.css}</style>
</head>
<body ${typeConfig.bodyAttr}>

<div class="topbar">
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
${sectionsHtml}
  </main>
</div>

<footer class="doc-footer">
  <p>${escapeHtml(projectName)} — 技术指导文档</p>
  <p>${escapeHtml(metaLine)}</p>
</footer>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>${mermaidScript}
  <script>${template.js}</script>
</body>
</html>`;
  }

  // Default layout: details-based (module / system)
  const sectionsHtml = sections.map(s => {
    const id = sectionId(s.heading, typeConfig);
    const open = typeConfig.shouldBeOpen(s.heading) ? ' open' : '';
    const bodyHtml = mdBodyToHtml(s.body, typeConfig.needsMermaid);
    return `
      <details${open} id="${id}">
        <summary><h2 id="${id}-h">${s.heading}</h2></summary>
        <div class="section-body">
${bodyHtml}
        </div>
      </details>`;
  }).join('\n');

  const metaRows = typeConfig.buildMetaRows(meta);

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="${typeConfig.generatorMeta}">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
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
        <span class="doc-version">${meta.version || 'V1.0'}</span>
        <h1>${escapeHtml(title)}</h1>
        <dl class="meta-grid">
          ${metaRows}
        </dl>
      </header>

${sectionsHtml}

    </article>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>${mermaidScript}
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
    fs.writeFileSync(cfg.outputPath, html, 'utf-8');
    console.log(`  OK    index.html (${count} docs)`);
  }
}

// ============================================================
// Main
// ============================================================

if (!convertAll && !shouldGenerateIndex && files.length === 0) {
  console.log('Usage: node md-to-html.js [--type module|system|guide] [--all] [--index] [--force] [--dry-run] [file.md ...]');
  console.log('  --type     Specify doc type (auto-detected from path if omitted)');
  console.log('  --all      Convert all matching .md files');
  console.log('  --index    Generate index.html navigation page');
  console.log('  --lang     HTML lang attribute (default: zh-CN)');
  console.log('  --force    Overwrite existing HTML files');
  console.log('  --dry-run  Preview without writing');
  process.exit(0);
}

// Resolve type
const resolvedType = docType || (files.length > 0 ? detectType(files[0]) : 'module');
const typeConfig = TYPE_CONFIG[resolvedType];
if (!typeConfig) {
  console.error(`  ERROR Unknown type: ${resolvedType}. Use 'module', 'system', or 'guide'.`);
  process.exit(1);
}

const template = readTemplate(typeConfig.templatePath);

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
    const scanDir = typeConfig.scanDir;
    targets = fs.readdirSync(scanDir)
      .filter(f => f.endsWith('.md') && typeConfig.filePattern(f))
      .map(f => path.join(scanDir, f));
  } else {
    targets = files.map(f => path.resolve(f));
  }

  let converted = 0;
  let skipped = 0;

  for (const mdPath of targets) {
    if (!fs.existsSync(mdPath)) {
      console.log(`  SKIP  ${mdPath} (not found)`);
      skipped++;
      continue;
    }

    const htmlPath = mdPath.replace(/\.md$/, '.html');
    if (fs.existsSync(htmlPath) && !force) {
      console.log(`  SKIP  ${path.basename(mdPath)} (HTML already exists)`);
      skipped++;
      continue;
    }

    const md = fs.readFileSync(mdPath, 'utf-8');
    const parsed = parseMarkdownSections(md, typeConfig);
    const html = buildHtml(parsed, template, typeConfig);

    if (dryRun) {
      console.log(`  DRY   ${path.basename(mdPath)} -> ${path.basename(htmlPath)} (${parsed.sections.length} sections)`);
    } else {
      fs.writeFileSync(htmlPath, html, 'utf-8');
      console.log(`  OK    ${path.basename(mdPath)} -> ${path.basename(htmlPath)} (${parsed.sections.length} sections)`);
    }
    converted++;
  }

  console.log(`\nDone: ${converted} converted, ${skipped} skipped${dryRun ? ' (dry run)' : ''}`);
}
