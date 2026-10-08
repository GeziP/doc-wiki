#!/usr/bin/env node
'use strict';
/**
 * check-doc-fidelity.js — Markdown → HTML 孪生保真度检查。
 *
 * validate-doc.js 只检查 HTML 自身的结构，看不到“Markdown 里有、HTML 里没有”的内容。
 * 本脚本把 .md 与同目录同名 .html 做往返比对：行内代码、围栏代码块、标题、表格；
 * 另外报告停在“## 目录”段里、会被转换器随生成侧栏一并丢弃的非目录内容（toc-swallowed）。
 * 不改写任何文件；只报告丢失或被改写的内容。
 *
 * Usage:
 *   node check-doc-fidelity.js [--json] [--root <dir>] --all
 *   node check-doc-fidelity.js [--json] [--root <dir>] doc/a.md doc/tech-docs/B_Design.md
 *
 * --all 检查 <root>/doc/*.md 与 <root>/doc/tech-docs/*.md 中已有 .html 孪生的文档。
 * Exit codes: 0 = 保真, 1 = 发现丢失, 2 = 参数错误或缺少 HTML 孪生
 */

const fs = require('fs');
const path = require('path');
const { parseSourceReference } = require('./lib/source-reference');
const { decodeEntities } = require('./lib/prose');

const args = process.argv.slice(2);
const valueFlags = ['--root'];
const knownFlags = [...valueFlags, '--all', '--json', '--help'];
function fail(message) {
  console.error(message);
  process.exit(2);
}
for (let i = 0; i < args.length; i++) {
  if (valueFlags.includes(args[i])) {
    if (!args[i + 1] || args[i + 1].startsWith('--')) fail(`Missing value for ${args[i]}`);
    i++;
  } else if (args[i].startsWith('--') && !knownFlags.includes(args[i])) fail(`Unknown option: ${args[i]}`);
}
const jsonOutput = args.includes('--json');
const rootIdx = args.indexOf('--root');
const ROOT = rootIdx !== -1 ? path.resolve(args[rootIdx + 1]) : process.cwd();
const explicit = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--root');

if (args.includes('--help') || (!args.includes('--all') && explicit.length === 0)) {
  console.log('Usage: node check-doc-fidelity.js [--json] [--root <dir>] (--all | file.md ...)');
  process.exit(0);
}

// ---------- shared normalisation ----------
const collapse = (s) => s.replace(/\s+/g, ' ').trim();
const textOf = (html) => decodeEntities(html.replace(/<[^>]+>/g, '')).text;
function expandRefs(s) {
  return s.replace(/\{\{([^{}\n]+)\}\}/g, (whole, ref) => {
    const source = parseSourceReference(ref);
    return source ? source.label : ref;
  });
}
// 标题/表头/行内文本比较用：去掉 Markdown 标记，保留可见文字
function plain(s) {
  return collapse(expandRefs(s).replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, ''));
}
function lines(text) { return text.replace(/\r\n?/g, '\n').split('\n'); }
// 围栏正文比较键：逐行去首尾空白、丢弃空行
const blockKey = (text) => lines(text).map(l => l.trim()).filter(Boolean).join('\n');
// mermaid 的两处有意修复不算内容改写：{..} → 【..】（防止被当成菱形节点）、-.> → -.->
const mermaidKey = (text) => blockKey(text).replace(/【/g, '{').replace(/】/g, '}').replace(/-\.->/g, '-.>');
// 转换器对 mermaid 正文先解一次 HTML 实体（作者历史上写过 &gt; / &lt;），比对时 Markdown 侧同样先解一次
const decodeMermaid = (text) => text.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const tableCells = (line) => line.split(/(?<!\\)\|/).slice(1, -1).map(c => plain(c.replace(/\\\|/g, '|')));

// 目录条目：`- [标题](#锚点)`，可嵌套、可有序。转换器把“## 目录”到第一条 `---`（或下一个 ## 标题）之间的内容
// 整段换成生成的侧栏目录，所以这个区间里除条目以外的任何内容（术语表、说明、代码块…）都会无声丢失。
const TOC_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\[[^\]]*\]\([^)]*\)\s*$/;

// ---------- Markdown side ----------
function markdownFacts(source) {
  const spans = [];      // 行内代码（含 {{file:line}} 展开后的标签）
  const fences = [];     // { key } 围栏代码块
  const headings = [];   // h2-h4 可见文字
  const tables = [];     // 表头签名
  let rows = 0;
  let fence = null;
  let skipToc = false, inMeta = false, inComment = false;
  let tableOpen = false, tableSkipped = false;
  const suspects = [];   // 围栏内部出现“带 info string 的开启行”：关闭围栏不能带 info string，多半是把关闭围栏误写成了 ```text
  const all = lines(source);
  let lineNo = 0;
  const swallowed = { count: 0, first: null };   // 目录段里“不是目录条目”的内容
  const swallow = (text) => {
    swallowed.count++;
    swallowed.first = swallowed.first || { at: lineNo, text: text.trim().slice(0, 60) };
  };

  for (const line of all) {
    lineNo++;
    const body = line.replace(/^\s*(?:>\s*)*/, '').replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '');
    let marker = body.match(/^\s*(`{3,}|~{3,})(.*)$/);
    // CommonMark：反引号围栏的 info string 不能含反引号（```x``` 是行内代码，不是围栏开启行）
    if (marker && !fence && marker[1][0] === '`' && marker[2].includes('`')) marker = null;
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) {
        if (!fence.skip) fences.push({ key: fence.lang === 'mermaid' ? mermaidKey(decodeMermaid(fence.text.join('\n'))) : blockKey(fence.text.join('\n')) });
        fence = null;
      } else {
        fence.text.push(fence.quoted ? line.replace(/^\s*(?:>\s?)+/, '') : line);
        // 误写的关闭围栏一定不短于开启围栏；更短的反引号串是合法嵌套示例，不报
        if (marker && marker[1][0] === '`' && marker[1].length >= fence.length && marker[2].trim() && !fence.suspect && !/^(?:markdown|md)$/i.test(fence.lang)) {
          fence.suspect = true;
          suspects.push({ open: fence.openLine, at: lineNo, text: line.trim().slice(0, 40) });
        }
      }
      continue;
    }
    if (marker) {
      if (skipToc) swallow(line);
      fence = {
        char: marker[1][0], length: marker[1].length, text: [], skip: skipToc, openLine: lineNo,
        lang: marker[2].trim().split(/\s+/)[0], quoted: /^\s*>/.test(line),
      };
      tableOpen = false;
      continue;
    }

    if (inComment) { if (/-->/.test(line)) inComment = false; continue; }
    if (/^\s*<!--/.test(line) && !/-->/.test(line)) { inComment = true; continue; }

    const h2 = line.match(/^## (.+?)\s*$/);
    if (h2) {
      skipToc = /^(目录|Table of Contents)$/i.test(h2[1].trim());
      inMeta = /^(文档信息|Document Info)/i.test(h2[1].trim());
    }
    if (skipToc) {
      if (/^---$/.test(line)) skipToc = false;   // 转换器：目录段吞到第一条 --- 为止（含该行），其后恢复正常转换
      else if (line.trim() && !h2 && !TOC_ITEM.test(line)) swallow(line);
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+?)\s*#*\s*$/);
    if (heading && !(heading[1] === '##' && inMeta)) headings.push(plain(heading[2]));

    // 表格：连续以 | 开头的行；文档信息区里的表格行被转换器消费为元数据，不计入
    if (/^\s*\|/.test(line)) {
      if (!tableOpen) {
        tableOpen = true;
        tableSkipped = inMeta;
        if (!tableSkipped) tables.push(tableCells(line).join('|'));
      }
      if (!tableSkipped && !/^\s*\|[\s:|-]+\|\s*$/.test(line)) rows++;
    } else tableOpen = false;

    // 行内代码与 {{file:line}}
    const rest = line.replace(/(`+)(?!`)(.+?)(?<!`)\1(?!`)/g, (whole, ticks, code) => {
      const text = code.trim().replace(/\\\|/g, '|');
      const lone = text.match(/^\{\{([^{}\n]+)\}\}$/);
      const source = lone && parseSourceReference(lone[1]);
      spans.push(collapse(source ? source.label : text));
      return ' ';
    });
    for (const m of rest.matchAll(/\{\{([^{}\n]+?)\}\}/g)) {
      const source = parseSourceReference(m[1]);
      if (source) spans.push(source.label);
    }
  }
  return { spans, fences, headings, tables, rows, suspects, swallowed, unclosedFence: Boolean(fence) };
}

// ---------- HTML side ----------
function htmlFacts(source) {
  let html = source.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  const blocks = [];     // { key }
  // <pre class="mermaid"> 与普通 <pre>；<div class="mermaid"> 的 class 须恰为 mermaid（不含 mermaid-wrap）
  html = html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (m, attrs, inner) => {
    const mermaid = /\bclass\s*=\s*"(?:[^"]*\s)?mermaid(?:\s[^"]*)?"/i.test(attrs);
    blocks.push({ key: mermaid ? mermaidKey(textOf(inner)) : blockKey(textOf(inner)) });
    return ' ';
  });
  html = html.replace(/<div\b[^>]*\bclass\s*=\s*"(?:[^"]*\s)?mermaid(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/div>/gi, (m, inner) => {
    blocks.push({ key: mermaidKey(textOf(inner)) });
    return ' ';
  });
  const codes = [...html.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gi)].map(m => collapse(textOf(m[1])));
  const headings = [...html.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => plain(textOf(m[2])));
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(m => {
    const firstRow = (m[1].match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i) || [, ''])[1];
    return [...firstRow.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c => plain(textOf(c[1]))).join('|');
  });
  const rows = (html.match(/<tr\b/gi) || []).length;
  return { codes, blocks, headings, tables, rows };
}

function multisetMissing(wanted, available) {
  const pool = new Map();
  for (const item of available) pool.set(item, (pool.get(item) || 0) + 1);
  const missing = [];
  for (const item of wanted) {
    const left = pool.get(item) || 0;
    if (left > 0) pool.set(item, left - 1); else missing.push(item);
  }
  return missing;
}

// 找到与缺失围栏最接近的 HTML 块，指出第一处不同的行
function fenceDiff(key, candidates) {
  const wanted = key.split('\n');
  let best = null;
  for (const candidate of candidates) {
    const got = candidate.split('\n');
    let i = 0;
    while (i < wanted.length && i < got.length && wanted[i] === got[i]) i++;
    if (!best || i > best.i) best = { i, got };
  }
  const head = (wanted[0] || '(empty)').slice(0, 60);
  if (!best || best.i === 0) return head;
  return `${head} … first difference at block line ${best.i + 1}: md=${(wanted[best.i] || '(end)').slice(0, 70)} | html=${(best.got[best.i] || '(end)').slice(0, 70)}`;
}

function compare(md, html) {
  const issues = [];
  // Markdown 自身围栏不配对（文末仍在围栏内）：之后的内容都会被当成代码，比对结果不可信，单独报告
  if (md.unclosedFence) issues.push({ kind: 'fence-unbalanced', detail: 'a code fence is never closed; everything after it renders as code' });
  // 配对“成功”但错位：关闭围栏写成了 ```text，后面的章节被吞进代码块；MD 与 HTML 一致，所以只有这条能发现
  for (const s of md.suspects) {
    issues.push({ kind: 'fence-suspect', detail: `line ${s.at} (${s.text}) looks like a fence opener inside the fence opened at line ${s.open}; a closing fence cannot carry an info string, so that fence is probably still open and swallows what follows` });
  }
  // 内容停在“## 目录”段里：转换器与上面所有比对都跳过该区间，MD 与 HTML 看起来“一致”，所以只有这条能发现
  if (md.swallowed.count) {
    const { at, text } = md.swallowed.first;
    issues.push({ kind: 'toc-swallowed', detail: `${md.swallowed.count} line(s) under the 目录 heading are not TOC entries (first: line ${at} "${text}"); the converter replaces that section with the generated sidebar and drops them — move them into a real section` });
  }
  for (const span of multisetMissing(md.spans, html.codes)) issues.push({ kind: 'code-missing', detail: span });
  const available = html.blocks.map(b => b.key);
  for (const key of multisetMissing(md.fences.map(f => f.key), available)) {
    issues.push({ kind: 'fence-missing', detail: fenceDiff(key, available) });
  }
  for (const heading of multisetMissing(md.headings, html.headings)) issues.push({ kind: 'heading-altered', detail: heading });
  for (const table of multisetMissing(md.tables, html.tables)) issues.push({ kind: 'table-missing', detail: table.slice(0, 100) });
  return issues;
}

// ---------- targets ----------
function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => path.join(dir, f));
}
let targets;
if (args.includes('--all')) {
  targets = [...listMd(path.join(ROOT, 'doc')), ...listMd(path.join(ROOT, 'doc', 'tech-docs'))]
    .filter(md => fs.existsSync(md.replace(/\.md$/, '.html')));
} else {
  targets = explicit.map(f => path.resolve(ROOT, f));
}

const report = [];
let missingTwin = 0;
for (const md of targets) {
  const htmlPath = md.replace(/\.md$/, '.html');
  const rel = path.relative(ROOT, md).replace(/\\/g, '/');
  if (!fs.existsSync(md) || !fs.existsSync(htmlPath)) {
    missingTwin++;
    report.push({ file: rel, error: 'missing md or html twin', issues: [] });
    continue;
  }
  const issues = compare(markdownFacts(fs.readFileSync(md, 'utf-8')), htmlFacts(fs.readFileSync(htmlPath, 'utf-8')));
  report.push({ file: rel, issues });
}

const total = report.reduce((n, r) => n + r.issues.length, 0);
if (jsonOutput) {
  console.log(JSON.stringify({ schemaVersion: 1, tool: 'doc-fidelity', files: report, summary: { files: report.length, issues: total, missingTwin } }));
} else {
  for (const r of report) {
    if (r.error) { console.log(`  ERROR ${r.file}: ${r.error}`); continue; }
    if (!r.issues.length) { console.log(`  OK    ${r.file}`); continue; }
    console.log(`  LOSS  ${r.file} (${r.issues.length})`);
    const byKind = new Map();
    for (const i of r.issues) byKind.set(i.kind, [...(byKind.get(i.kind) || []), i.detail]);
    for (const [kind, details] of byKind) {
      for (const d of details.slice(0, 5)) console.log(`          [${kind}] ${d}`);
      if (details.length > 5) console.log(`          [${kind}] ... +${details.length - 5} more`);
    }
  }
  console.log(`\n${report.length} file(s), ${total} fidelity issue(s)${missingTwin ? `, ${missingTwin} missing twin(s)` : ''}`);
}
process.exit(missingTwin ? 2 : total ? 1 : 0);
