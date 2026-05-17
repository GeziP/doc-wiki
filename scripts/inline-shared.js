#!/usr/bin/env node
/**
 * inline-shared.js — Sync shared CSS/JS into doc templates.
 *
 * Modes:
 *   --sync              Sync all templates in ../templates/ with current CSS/JS
 *   --sync <file.html>  Sync a specific template
 *   <template.html>     Legacy: replace INLINE markers (original behavior)
 *
 * Sync replaces content between @sync markers in templates:
 *   /* @sync:doc-shell.css:start *​/  ...  /* @sync:doc-shell.css:end *​/
 *   /* @sync:doc-shell.js:start *​/   ...  /* @sync:doc-shell.js:end *​/
 *   /* @sync:skin-switcher.js:start *​/ ... /* @sync:skin-switcher.js:end *​/
 *
 * --init <file.html>   One-time migration: restructure a template to use
 *                       @sync markers (replaces CSS/JS with doc-shell content).
 */

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = __dirname;
const TEMPLATES_DIR = path.resolve(SCRIPTS_DIR, '..', 'templates');
const args = process.argv.slice(2);

const SHARED_FILES = {
  'doc-shell.css': path.join(SCRIPTS_DIR, 'doc-shell.css'),
  'doc-shell.js': path.join(SCRIPTS_DIR, 'doc-shell.js'),
  'skin-switcher.js': path.join(SCRIPTS_DIR, 'skin-switcher.js'),
};

function readShared(name) {
  const p = SHARED_FILES[name];
  if (!p || !fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

// Per-template CSS variable overrides (intentional deviations from doc-shell.css)
const CSS_OVERRIDES = {
  'module-design.html': [
    ':root { --line-height: 1.65; --max-width: 880px; --toc-width: 220px; }',
  ].join('\n'),
};

// Per-template CSS that's unique to that template type
const CSS_EXTRAS = {
  'guide.html': `
.hero {
  background: var(--bg-tertiary); color: var(--text);
  padding: 60px 24px 50px; text-align: center;
  border-bottom: 1px solid var(--border);
}
.hero h1 { font-size: 2.2rem; font-weight: 800; margin-bottom: 8px; letter-spacing: -.02em; }
.hero p { max-width: 600px; margin: 0 auto 12px; color: var(--text-secondary); font-size: 1.05rem; }
.hero .meta { font-size: 0.82rem; color: var(--text-muted); }
`,
  'module-design.html': `
.code-block pre code.hljs { padding: 0; background: none; font-size: inherit; }
.diagram figcaption { margin-top: 8px; font-size: 13px; color: var(--text-faint); font-style: italic; }
`,
  'system-design.html': `
.module-panel { margin: 8px 0; }
.module-panel > summary {
  padding: 10px 16px; background: var(--bg-secondary);
  cursor: pointer; font-weight: 700; font-size: 16px;
  list-style: none; user-select: none;
  border: 1px solid var(--border); border-radius: 8px;
}
.module-panel > summary::-webkit-details-marker { display: none; }
.module-panel > summary::before {
  content: "\\25B8"; display: inline-block; width: 16px;
  color: var(--text-faint); transition: transform .15s;
}
.module-panel[open] > summary::before { transform: rotate(90deg); }
.module-panel > summary:hover { background: var(--bg-tertiary); }
.module-panel > .module-body {
  padding: 16px 20px; border: 1px solid var(--border);
  border-top: none; border-radius: 0 0 8px 8px;
}
`,
};

// hljs dark mode CSS (shared by module and system)
const HLJS_DARK_CSS = `
[data-theme="dark"] .hljs { background: var(--code-bg); }
[data-theme="dark"] .hljs-keyword { color: #ff7b72; }
[data-theme="dark"] .hljs-string, [data-theme="dark"] .hljs-attr { color: #a5d6ff; }
[data-theme="dark"] .hljs-comment { color: #8b949e; }
[data-theme="dark"] .hljs-type, [data-theme="dark"] .hljs-built_in { color: #ffa657; }
[data-theme="dark"] .hljs-number { color: #79c0ff; }
[data-theme="dark"] .hljs-function { color: #d2a8ff; }
[data-theme="dark"] .hljs-class .hljs-title { color: #ffa657; }
[data-theme="dark"] .hljs-meta { color: #79c0ff; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .hljs { background: var(--code-bg); }
  :root:not([data-theme="light"]) .hljs-keyword { color: #ff7b72; }
  :root:not([data-theme="light"]) .hljs-string { color: #a5d6ff; }
  :root:not([data-theme="light"]) .hljs-comment { color: #8b949e; }
  :root:not([data-theme="light"]) .hljs-type { color: #ffa657; }
}
`;

// ============================================================
// Sync mode: replace content between @sync markers
// ============================================================
function syncFile(filePath) {
  let original = fs.readFileSync(filePath, 'utf8');
  // #16: Strip UTF-8 BOM if present
  if (original.charCodeAt(0) === 0xFEFF) {
    original = original.slice(1);
    console.log('  Stripped UTF-8 BOM from %s', path.basename(filePath));
  }
  let html = original;
  let errors = [];

  for (const [name] of Object.entries(SHARED_FILES)) {
    let content = readShared(name);
    if (!content) continue;
    // #16: Strip BOM from source files too
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

    const startMarker = `/* @sync:${name}:start */`;
    const endMarker = `/* @sync:${name}:end */`;

    if (!html.includes(startMarker)) continue;

    // #13: Validate end marker exists
    if (!html.includes(endMarker)) {
      errors.push(`${name}: start marker found but end marker missing — skipping to prevent data loss`);
      continue;
    }

    // #14: Check for duplicate start markers
    const startCount = html.split(startMarker).length - 1;
    if (startCount > 1) {
      errors.push(`${name}: ${startCount} start markers found (expected 1) — skipping to prevent corruption`);
      continue;
    }

    const re = new RegExp(
      escapeRegex(startMarker) + '[\\s\\S]*?' + escapeRegex(endMarker),
      'g'
    );
    html = html.replace(re, startMarker + '\n' + content.trim() + '\n' + endMarker);
    console.log('  Synced %s (%d bytes)', name, content.length);
  }

  if (errors.length > 0) {
    errors.forEach(e => console.error('  ERROR: ' + e));
    return false;
  }

  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log('  Written: %s', path.basename(filePath));
    return true;
  } else if (html.includes('@sync:')) {
    console.log('  Up to date: %s', path.basename(filePath));
    return false;
  } else {
    console.log('  No @sync markers found in %s', path.basename(filePath));
    return false;
  }
}

// ============================================================
// Init mode: one-time migration to add @sync markers
// ============================================================
function initFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);

  // 1. Replace main <style> block with doc-shell.css + overrides
  const css = readShared('doc-shell.css');
  if (css) {
    const overrides = CSS_OVERRIDES[fileName] || '';
    const extras = CSS_EXTRAS[fileName] || '';
    const needsHljs = fileName !== 'guide.html';
    const hljsCss = needsHljs ? HLJS_DARK_CSS : '';

    const newStyle = [
      '/* @sync:doc-shell.css:start */',
      css.trim(),
      '/* @sync:doc-shell.css:end */',
      '',
      '/* === Template-specific overrides === */',
      overrides,
      extras.trim(),
      hljsCss.trim(),
    ].filter(Boolean).join('\n');

    html = html.replace(
      /(<style[^>]*>)[\s\S]*?(<\/style>)/i,
      '$1\n' + newStyle + '\n  $2'
    );
    console.log('  Replaced CSS with doc-shell.css + overrides');
  }

  // 2. Replace inline <script> with doc-shell.js + skin-switcher.js
  const docJs = readShared('doc-shell.js');
  const skinJs = readShared('skin-switcher.js');

  if (docJs) {
    // Find the LAST inline <script> (not CDN)
    const scriptRe = /(<script(?!\s+src)[^>]*>)([\s\S]*?)(<\/script>)/gi;
    let lastMatch = null, lastIndex = -1;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      lastMatch = m;
      lastIndex = m.index;
    }

    if (lastMatch) {
      const newJs = [
        '/* @sync:doc-shell.js:start */',
        docJs.trim(),
        '/* @sync:doc-shell.js:end */',
        '',
        skinJs ? '/* @sync:skin-switcher.js:start */' : '',
        skinJs ? skinJs.trim() : '',
        skinJs ? '/* @sync:skin-switcher.js:end */' : '',
      ].filter(Boolean).join('\n');

      const before = html.substring(0, lastIndex);
      const after = html.substring(lastIndex + lastMatch[0].length);
      html = before + lastMatch[1] + '\n' + newJs + '\n' + lastMatch[3] + after;
      console.log('  Replaced JS with doc-shell.js + skin-switcher.js');
    }
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log('  Written: %s (%d bytes)', fileName, html.length);
}

// ============================================================
// Legacy mode: replace INLINE markers
// ============================================================
function legacyInline(templatePath, outputPath) {
  let html = fs.readFileSync(templatePath, 'utf8');

  const css = readShared('doc-shell.css');
  if (css) {
    html = html.replace(/\/\*\s*INLINE:doc-shell\.css\s*\*\//g, css);
    console.log('  Inlined doc-shell.css (%d bytes)', css.length);
  }

  const js = readShared('doc-shell.js');
  if (js) {
    html = html.replace(/\/\*\s*INLINE:doc-shell\.js\s*\*\//g, js);
    console.log('  Inlined doc-shell.js (%d bytes)', js.length);
  }

  const skin = readShared('skin-switcher.js');
  if (skin) {
    html = html.replace(/\/\*\s*INLINE:skin-switcher\.js\s*\*\//g, skin);
    console.log('  Inlined skin-switcher.js (%d bytes)', skin.length);
  }

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log('Written: %s', outputPath);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// CLI
// ============================================================
if (args.includes('--sync')) {
  const fileArg = args.find(a => a !== '--sync' && !a.startsWith('--'));
  if (fileArg) {
    syncFile(path.resolve(fileArg));
  } else {
    const templates = fs.readdirSync(TEMPLATES_DIR)
      .filter(f => f.endsWith('.html') && !f.includes('index'));
    console.log('Syncing %d templates...', templates.length);
    templates.forEach(t => {
      console.log('\n[%s]', t);
      syncFile(path.join(TEMPLATES_DIR, t));
    });
  }
} else if (args.includes('--init')) {
  const fileArg = args.find(a => a !== '--init' && !a.startsWith('--'));
  if (!fileArg) {
    console.error('Usage: node inline-shared.js --init <template.html>');
    process.exit(1);
  }
  initFile(path.resolve(fileArg));
} else if (args.length >= 1) {
  const templatePath = path.resolve(args[0]);
  const outputPath = args[1] ? path.resolve(args[1]) : templatePath;
  legacyInline(templatePath, outputPath);
} else {
  console.log('Usage:');
  console.log('  node inline-shared.js --sync              Sync all templates');
  console.log('  node inline-shared.js --sync <file.html>  Sync specific template');
  console.log('  node inline-shared.js --init <file.html>  Init template with markers');
  console.log('  node inline-shared.js <template.html>     Legacy inline markers');
  process.exit(0);
}
