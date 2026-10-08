#!/usr/bin/env node
'use strict';
/**
 * check-doc-links.js — 文档链接可达性检查（静态，不开浏览器）
 *
 * 为什么需要它：validate-doc 只看单个 HTML 的结构，看不到“这个链接点过去是什么”。
 * 真实语料里出现过近 200 条相对链接指向 .md（而不是同名 HTML 孪生）、手写目录里的死链、源码引用指向已不存在的文件。
 *
 * 用法：
 *   node check-doc-links.js [--json] [--strict] [--root <dir>] (--all | <file.html> ...)
 *   --all    扫 <root>/doc/*.html 与 <root>/doc/tech-docs/*.html（含 index 页）
 *   --strict 警告（如源码引用行号越界）也算失败
 *
 * 检查项（error 使退出码为 1；warning 仅在 --strict 下失败）：
 *   missing-target     error    相对链接指向的文件/目录不存在
 *   missing-anchor     error    目标是 .html 但没有对应 id/name；或同页 #锚点 不存在
 *                               （class="source-ref" 的源码引用除外：它的 #L10 是行号，目标即便是 .html 源文件也只按行数校验）
 *   md-link-with-twin  error    链接指向 .md，而同名 .html 孪生已存在（读者会点进裸 Markdown）
 *   line-out-of-range  warning  源码引用 #L10-L20 的行号超出目标文件行数（引用已漂移）
 * 退出码：0 通过；1 有 error（--strict 时含 warning）；2 用法错误（无目标/文件不存在）。
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const strict = argv.includes('--strict');
const rootAt = argv.indexOf('--root');
const root = path.resolve(rootAt === -1 ? process.cwd() : argv[rootAt + 1] || '');
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--root');

function usageError(message) {
  if (asJson) console.log(JSON.stringify({ schemaVersion: 1, tool: 'doc-links', fatal: message }));
  else console.error(`ERROR ${message}`);
  process.exit(2);
}

function listHtml(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.html$/i.test(f)).sort().map(f => path.join(dir, f)) : [];
}

const targets = argv.includes('--all')
  ? [...listHtml(path.join(root, 'doc')), ...listHtml(path.join(root, 'doc', 'tech-docs'))]
  : positional.map(f => path.resolve(f));
if (!targets.length) usageError('No document targets found (use --all or pass .html files)');
for (const t of targets) if (!fs.existsSync(t) || !fs.statSync(t).isFile()) usageError(`Not a file: ${t}`);

const readCache = new Map();
const read = file => {
  if (!readCache.has(file)) readCache.set(file, fs.readFileSync(file, 'utf8'));
  return readCache.get(file);
};
const idCache = new Map();
function anchorsOf(file) {
  if (!idCache.has(file)) {
    const ids = new Set();
    for (const m of read(file).matchAll(/\b(?:id|name)\s*=\s*"([^"]+)"/gi)) ids.add(m[1]);
    idCache.set(file, ids);
  }
  return idCache.get(file);
}
const lineCount = file => read(file).replace(/\n$/, '').split('\n').length;

const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const safeDecodeURI = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };

function checkFile(file) {
  const html = read(file);
  // <script>/<style> 内部是代码不是标记；保留开标签，因为 src= 在开标签里。
  // 用空格抹掉内容而不是删掉：markup 与 html 偏移一一对应，lineAt 报出的才是真实行号。
  const blank = s => s.replace(/[^\n]/g, ' ');
  const markup = html
    .replace(/(<(?:script|style)\b[^>]*>)([\s\S]*?)(<\/(?:script|style)\s*>)/gi, (_, open, body, close) => open + blank(body) + close)
    .replace(/<!--[\s\S]*?-->/g, blank);
  const issues = [];
  let links = 0;
  const lineAt = index => html.slice(0, index).split('\n').length;

  for (const tag of markup.matchAll(/<(a|link|img|script|source|iframe)\b[^>]*>/gi)) {
    const attr = tag[0].match(/\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (!attr) continue;
    const raw = decode((attr[1] !== undefined ? attr[1] : attr[2]).trim());
    if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(raw)) continue;   // 协议 / 协议相对 / 根相对：无法静态判定
    links++;
    const line = lineAt(tag.index);
    const hashAt = raw.indexOf('#');
    const pathPart = (hashAt === -1 ? raw : raw.slice(0, hashAt)).replace(/\?.*$/, '');
    const fragment = hashAt === -1 ? '' : safeDecodeURI(raw.slice(hashAt + 1));
    const issue = (kind, severity, message) => issues.push({ kind, severity, href: raw, line, message });
    const sourceRef = /\bclass\s*=\s*(?:"[^"]*|'[^']*)\bsource-ref\b/i.test(tag[0]);   // {{path:line}} 生成的链接

    if (!pathPart) {   // 同页锚点
      if (fragment && !anchorsOf(file).has(fragment)) issue('missing-anchor', 'error', `same-page anchor #${fragment} has no matching id`);
      continue;
    }
    const target = path.resolve(path.dirname(file), safeDecodeURI(pathPart));
    if (!fs.existsSync(target)) { issue('missing-target', 'error', `target does not exist: ${path.relative(root, target).split(path.sep).join('/')}`); continue; }
    if (!fs.statSync(target).isFile()) continue;

    if (/\.md$/i.test(target)) {
      const twin = target.replace(/\.md$/i, '.html');
      if (fs.existsSync(twin)) issue('md-link-with-twin', 'error', `points to Markdown although ${path.basename(twin)} exists`);
      continue;
    }
    if (/\.html?$/i.test(target) && !sourceRef) {   // 源码引用指向 .html 源文件时，#L1 是行号，落到下面的行数校验
      if (fragment && !anchorsOf(target).has(fragment)) issue('missing-anchor', 'error', `${path.basename(target)} has no id/name "${fragment}"`);
      continue;
    }
    const range = fragment.match(/^L(\d+)(?:-L?(\d+))?$/);   // 源码引用 file#L10-L20
    if (range) {
      const last = Number(range[2] || range[1]);
      const total = lineCount(target);
      if (last > total) issue('line-out-of-range', 'warning', `reference ends at line ${last} but ${path.basename(target)} has ${total} lines`);
    }
  }
  return { file: path.relative(root, file).split(path.sep).join('/'), links, issues };
}

const results = targets.map(checkFile);
const all = results.flatMap(r => r.issues);
const summary = {
  files: results.length,
  links: results.reduce((n, r) => n + r.links, 0),
  errors: all.filter(i => i.severity === 'error').length,
  warnings: all.filter(i => i.severity === 'warning').length,
};
const failed = summary.errors > 0 || (strict && summary.warnings > 0);

if (asJson) {
  console.log(JSON.stringify({ schemaVersion: 1, tool: 'doc-links', summary, files: results.filter(r => r.issues.length) }, null, 2));
} else {
  for (const r of results) for (const i of r.issues) console.log(`${i.severity.toUpperCase().padEnd(7)} ${r.file}:${i.line} [${i.kind}] ${i.href} — ${i.message}`);
  console.log(`\nLINKS: ${summary.files} files, ${summary.links} relative links, ${summary.errors} errors, ${summary.warnings} warnings`);
}
process.exit(failed ? 1 : 0);
