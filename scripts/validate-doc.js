#!/usr/bin/env node
/**
 * validate-doc.js — Unified HTML doc validator for module/system/guide docs
 *
 * Unified HTML doc validator for doc-writer skill.
 * Checks: Mermaid, headings, code blocks, tables, inline markdown,
 * collapsible sections, TOC, HTML skeleton, source references, glossary, scope.
 *
 * Usage:
 *   node validate-doc.js --type module doc/tech-docs/Task_Design.html
 *   node validate-doc.js --type system doc/Scheduler_Architecture_Design.html
 *   node validate-doc.js --type guide doc/guide.html
 *   node validate-doc.js --fix file.html
 *   node validate-doc.js --fix --all
 *   node validate-doc.js --strict
 *
 * Exit codes: 0 = all passed, 1 = has errors, 2 = has warnings (strict mode)
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const doFix = args.includes('--fix');
const convertAll = args.includes('--all');
const strict = args.includes('--strict');
const isNewDoc = args.includes('--new-doc');
const testInteractive = args.includes('--test-interactive');
const typeIdx = args.indexOf('--type');
const rootIdx = args.indexOf('--root');
const docType = typeIdx !== -1 ? args[typeIdx + 1] : null;
const files = args.filter((a, i) => !a.startsWith('--') && (typeIdx === -1 || i !== typeIdx + 1) && (rootIdx === -1 || i !== rootIdx + 1));

// Resolve project root: --root flag > CWD > fallback
const PROJECT_ROOT = rootIdx !== -1
  ? path.resolve(args[rootIdx + 1])
  : process.cwd();

const DIRS = {
  module: path.join(PROJECT_ROOT, 'doc', 'tech-docs'),
  system: path.join(PROJECT_ROOT, 'doc'),
  guide: PROJECT_ROOT, // guide.html in project root
};

if (!convertAll && files.length === 0) {
  console.log('Usage: node validate-doc.js [--fix] [--strict] [--new-doc] [--root <dir>] [--type module|system|guide] [file.html ...]');
  console.log('  --fix      Auto-fix issues and write back');
  console.log('  --all      Validate all doc HTML (all types)');
  console.log('  --type     Specify doc type for --all scanning');
  console.log('  --root     Project root directory (default: CWD)');
  console.log('  --strict   Treat warnings as errors');
  console.log('  --new-doc  Require source refs, glossary, scope (for newly generated docs)');
  console.log('  --test-interactive  Test interaction features (progressive disclosure, dark mode, etc.)');
  process.exit(0);
}

// ============================================================
// Report collector
// ============================================================
class Report {
  constructor(file) {
    this.file = file;
    this.checks = [];
  }
  pass(cat, msg) { this.checks.push({ category: cat, status: 'pass', message: msg }); }
  warn(cat, msg) { this.checks.push({ category: cat, status: 'warn', message: msg }); }
  fail(cat, msg) { this.checks.push({ category: cat, status: 'fail', message: msg }); }
  fixed(cat, msg) { this.checks.push({ category: cat, status: 'fixed', message: msg }); }

  print() {
    const cats = {};
    for (const c of this.checks) {
      if (!cats[c.category]) cats[c.category] = [];
      cats[c.category].push(c);
    }
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${this.file}`);
    console.log(`${'='.repeat(60)}`);
    for (const [cat, items] of Object.entries(cats)) {
      const passed = items.filter(i => i.status === 'pass').length;
      const warns = items.filter(i => i.status === 'warn').length;
      const fails = items.filter(i => i.status === 'fail').length;
      const fixed = items.filter(i => i.status === 'fixed').length;
      const total = items.length;
      let icon, detail;
      if (fails > 0) {
        icon = '\x1b[31m✗\x1b[0m';
        detail = `${fails} fail${fixed ? `, ${fixed} auto-fixed` : ''}`;
      } else if (warns > 0) {
        icon = '\x1b[33m!\x1b[0m';
        detail = `${warns} warning${fixed ? `, ${fixed} auto-fixed` : ''}`;
      } else if (fixed > 0) {
        icon = '\x1b[36m✓\x1b[0m';
        detail = `${passed + fixed}/${total} (auto-fixed ${fixed})`;
      } else {
        icon = '\x1b[32m✓\x1b[0m';
        detail = `${passed}/${total} valid`;
      }
      console.log(`  [${icon}] ${cat} (${detail})`);
      for (const item of items) {
        if (item.status === 'pass') continue;
        const sym = item.status === 'fail' ? '  ✗' : item.status === 'warn' ? '  !' : '  ~';
        console.log(`      ${sym} ${item.message}`);
      }
    }
    const totalFail = this.checks.filter(c => c.status === 'fail').length;
    const totalWarn = this.checks.filter(c => c.status === 'warn').length;
    console.log('');
    return { fail: totalFail, warn: totalWarn };
  }
}

// ============================================================
// Validation checks
// ============================================================

/** 1. Mermaid 块校验 */
function checkMermaid(html, report, fix) {
  const cat = 'Mermaid 块';
  const re = /(?:<div class="mermaid">|<pre class="mermaid">)([\s\S]*?)(?:<\/div>|<\/pre>)/g;
  let m, count = 0, issues = [];
  let fixedHtml = html;

  while ((m = re.exec(html)) !== null) {
    count++;
    const block = m[1];
    const blockIssues = [];

    if (/&gt;|&lt;|&amp;/.test(block)) blockIssues.push('contains HTML entities');
    if (/-\.\>(?!-)/.test(block)) blockIssues.push('dotted arrow should be -.-> not -.>');
    if (/\["[^"]*\{[^}]*\}[^"]*"\]/.test(block)) blockIssues.push('curly braces in labels');
    if (/sequenceDiagram/.test(block)) {
      const seqLines = block.split('\n').filter(l => {
        const t = l.trim();
        if (/^(graph|flowchart|sequenceDiagram|stateDiagram)/.test(t)) return false;
        return /->(?!>)/.test(t);
      });
      if (seqLines.length > 0) blockIssues.push('bare -> in sequence diagram');
    }
    if (block.trim().length === 0) blockIssues.push('empty mermaid block');

    if (blockIssues.length === 0) continue;
    issues.push({ index: count, problems: blockIssues });

    if (fix) {
      let fixed = block;
      fixed = fixed.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
      fixed = fixed.replace(/-\.\>(?!-)/g, '-.->');
      fixed = fixed.replace(/\["([^"]*(?:\{[^}]*)+[^"]*)"\]/g, (_, inner) =>
        '["' + inner.replace(/\{/g, '【').replace(/\}/g, '】') + '"]'
      );
      if (/sequenceDiagram/.test(fixed)) fixed = fixed.replace(/->(?!>)/g, '->>');
      if (fixed !== block) {
        fixedHtml = fixedHtml.replace(block, fixed);
        report.fixed(cat, `Block #${count}: ${blockIssues.join('; ')}`);
      } else {
        report.fail(cat, `Block #${count}: ${blockIssues.join('; ')}`);
      }
    } else {
      report.fail(cat, `Block #${count}: ${blockIssues.join('; ')}`);
    }
  }

  if (count === 0) report.pass(cat, 'No Mermaid blocks found');
  else if (issues.length === 0) report.pass(cat, `${count}/${count} blocks valid`);
  return fixedHtml;
}

/** 2. 章节标题 ID 校验 */
function checkHeadingIds(html, report, fix) {
  const cat = '章节标题 ID';
  const h2Re = /<h2([^>]*)>([\s\S]*?)<\/h2>/g;
  const h3Re = /<h3([^>]*)>([\s\S]*?)<\/h3>/g;
  const ids = new Map();
  const missing = [];
  const duplicates = [];
  let fixedHtml = html;

  function checkHeading(match, tag) {
    const attrs = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    if (!idMatch) {
      missing.push({ tag, text });
    } else {
      const id = idMatch[1];
      if (ids.has(id)) duplicates.push({ id, first: ids.get(id), second: text });
      else ids.set(id, text);
    }
  }

  let m;
  while ((m = h2Re.exec(html)) !== null) checkHeading(m, 'h2');
  while ((m = h3Re.exec(html)) !== null) checkHeading(m, 'h3');

  if (missing.length === 0 && duplicates.length === 0) {
    report.pass(cat, `${ids.size} headings with unique IDs`);
  } else {
    if (missing.length > 0) {
      if (fix) {
        for (const item of missing) {
          const genId = 'sec-' + item.text.replace(/[^\w一-鿿]/g, '').toLowerCase().slice(0, 20);
          const escapedText = item.text.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
          const tagRe = new RegExp(`(<${item.tag})(>\\s*${escapedText})`);
          fixedHtml = fixedHtml.replace(tagRe, `$1 id="${genId}"$2`);
          report.fixed(cat, `${item.tag} "${item.text}" — assigned id="${genId}"`);
        }
      } else {
        report.fail(cat, `${missing.length} heading(s) missing id`);
      }
    }
    if (duplicates.length > 0) {
      for (const d of duplicates) {
        if (fix) {
          let occurrence = 0;
          fixedHtml = fixedHtml.replace(new RegExp(`(id=")${d.id}(")`, 'g'), match => {
            occurrence++;
            return occurrence > 1 ? `${d.id}-${occurrence}"` : match;
          });
          report.fixed(cat, `Duplicate id="${d.id}" — renamed`);
        } else {
          report.warn(cat, `Duplicate id="${d.id}" (${d.first} / ${d.second})`);
        }
      }
    }
  }
  return fixedHtml;
}

/** 3. 代码块校验 */
function checkCodeBlocks(html, report, fix) {
  const cat = '代码块';
  const re = /<(figure|div) class="code-block"([^>]*)>([\s\S]*?)<\/\1>/g;
  let m, count = 0, missingLang = 0, unescaped = 0;
  let fixedHtml = html;

  while ((m = re.exec(html)) !== null) {
    count++;
    const attrs = m[2];
    const content = m[3];
    if (!/data-lang=/.test(attrs) || /data-lang=""/.test(attrs)) missingLang++;
    const codeContent = content.replace(/<[^>]+>/g, '');
    if (/[<>]/.test(codeContent) && !/&lt;|&gt;/.test(content)) unescaped++;
  }

  // Strip code-block wrappers before counting bare <pre><code>
  const htmlWithoutFigures = html.replace(/<(figure|div) class="code-block"[\s\S]*?<\/\1>/g, '');
  const bareCodeRe = /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g;
  let bareCount = 0;
  while ((m = bareCodeRe.exec(htmlWithoutFigures)) !== null) bareCount++;

  if (count === 0 && bareCount === 0) report.pass(cat, 'No code blocks found');
  else {
    if (missingLang === 0 && count > 0) report.pass(cat, `${count} code blocks all have language tags`);
    else if (missingLang > 0) report.warn(cat, `${missingLang}/${count} code blocks missing language tag`);
    if (unescaped > 0) report.warn(cat, `${unescaped} code block(s) with unescaped < >`);
    if (bareCount > 0) {
      if (fix) {
        fixedHtml = fixedHtml.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)\/code>\s*\/pre>/g, (match, inner) => {
          report.fixed(cat, `Wrapped bare <pre><code> in <div class="code-block">`);
          return `<div class="code-block"><pre><code>${inner}</code></pre></div>`;
        });
      } else {
        report.warn(cat, `${bareCount} bare <pre><code> outside code-block wrapper`);
      }
    }
  }
  return fixedHtml;
}

/** 4. 表格校验 */
function checkTables(html, report) {
  const cat = '表格';
  const re = /<div class="table-wrapper"><table>([\s\S]*?)<\/table><\/div>/g;
  let m, count = 0, issues = [];

  while ((m = re.exec(html)) !== null) {
    count++;
    const table = m[1];
    const tableIssues = [];
    if (!/<thead>/.test(table)) tableIssues.push('missing <thead>');
    if (!/<tbody>/.test(table)) tableIssues.push('missing <tbody>');
    if (tableIssues.length > 0) issues.push(`Table #${count}: ${tableIssues.join(', ')}`);
  }

  if (count === 0) report.pass(cat, 'No tables found');
  else if (issues.length === 0) report.pass(cat, `${count} tables properly structured`);
  else issues.forEach(i => report.warn(cat, i));
}

/** 5. 内联 Markdown 校验 */
function checkInlineMarkdown(html, report) {
  const cat = '内联 Markdown';
  const bodyRe = /<div class="section-body">([\s\S]*?)<\/div>/g;
  let m, rawLinks = 0, rawBold = 0;

  while ((m = bodyRe.exec(html)) !== null) {
    const stripped = m[1]
      .replace(CODE_BLOCK_STRIP_RE, '')
      .replace(/<code[^>]*>[\s\S]*?<\/code>/g, '');
    const links = stripped.match(/\[[^\]]+\]\([^)]+\)/g);
    if (links) rawLinks += links.length;
    const bold = stripped.match(/\*\*[^*]+\*\*/g);
    if (bold) rawBold += bold.length;
  }

  if (rawLinks === 0 && rawBold === 0) report.pass(cat, 'Inline markdown properly converted');
  else {
    if (rawLinks > 0) report.warn(cat, `${rawLinks} raw markdown link(s) not converted`);
    if (rawBold > 0) report.warn(cat, `${rawBold} raw **bold** pattern(s) not converted`);
  }
}

/** 6. 可折叠章节校验 */
function checkCollapsibleSections(html, report) {
  const cat = '可折叠章节';
  // Strip <style> and <script> blocks to avoid false positives from CSS comments
  const htmlBody = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const detailsRe = /<details([^>]*)>([\s\S]*?)<\/details>/g;
  let m, count = 0, missingSummary = 0, openCount = 0;

  while ((m = detailsRe.exec(htmlBody)) !== null) {
    count++;
    if (/ open/.test(m[1])) openCount++;
    if (!/<summary>/.test(m[2])) missingSummary++;
  }

  const openDetails = (htmlBody.match(/<details/g) || []).length;
  const closeDetails = (htmlBody.match(/<\/details>/g) || []).length;
  const orphaned = Math.abs(openDetails - closeDetails);

  if (count === 0) report.pass(cat, 'No collapsible sections found');
  else {
    if (missingSummary > 0) report.warn(cat, `${missingSummary} <details> missing <summary>`);
    else report.pass(cat, `${count} sections (${openCount} open, ${count - openCount} collapsed)`);
    if (orphaned > 0) report.fail(cat, `Mismatched <details>: ${openDetails} open vs ${closeDetails} close`);
  }
}

/** 7. TOC 完整性校验 */
function checkTOC(html, report, fix) {
  const cat = 'TOC 完整性';
  let fixedHtml = html;

  // Accept both toc-list and toc (nav-style)
  const tocMatch = html.match(/<ul class="toc-list"[^>]*>[\s\S]*?<\/ul>/)
    || html.match(/<nav[^>]*id="toc"[^>]*>[\s\S]*?<\/nav>/);
  if (!tocMatch) {
    const hasSidebar = /class="sidebar"/.test(html) || /id="toc"/.test(html);
    if (!hasSidebar) report.warn(cat, 'No TOC element found');
    else report.fail(cat, 'TOC element not found but sidebar exists');
    return fixedHtml;
  }

  const tocContent = tocMatch[0].replace(/<\/?(?:ul|nav)[^>]*>/g, '').trim();
  if (tocContent.length === 0 || (!/<li/.test(tocContent) && !/<a/.test(tocContent))) {
    if (fix) {
      const headings = [];
      const h2Re = /<h2[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g;
      let hm;
      while ((hm = h2Re.exec(html)) !== null) {
        headings.push({ id: hm[1], text: hm[2].replace(/<[^>]+>/g, '').trim() });
      }
      if (headings.length === 0) {
        const detailsRe = /<details[^>]*id="([^"]+)"[^>]*>\s*<summary><h2>([\s\S]*?)<\/h2><\/summary>/g;
        while ((hm = detailsRe.exec(html)) !== null) {
          headings.push({ id: hm[1], text: hm[2].replace(/<[^>]+>/g, '').trim() });
        }
      }
      if (headings.length > 0) {
        const tocItems = headings.map(h => `<li><a href="#${h.id}">${h.text}</a></li>`).join('\n');
        // Replace the ENTIRE matched element (including wrapper tag), not just inner content
        // to avoid matching whitespace at the beginning of the file
        const newToc = tocMatch[0].startsWith('<ul')
          ? `<ul class="toc-list">\n${tocItems}\n</ul>`
          : `<nav id="toc">\n${tocItems}\n</nav>`;
        fixedHtml = fixedHtml.replace(tocMatch[0], newToc);
        report.fixed(cat, `Generated TOC with ${headings.length} entries`);
      } else {
        report.fail(cat, 'TOC is empty and no headings with IDs found');
      }
    } else {
      // If JS dynamically builds the TOC at runtime, empty static TOC is expected
      const hasDynamicTOC = /buildTOC|function\s+buildTOC/.test(html);
      if (hasDynamicTOC) {
        report.pass(cat, 'TOC is empty in static HTML (JS buildTOC will populate at runtime)');
      } else {
        report.fail(cat, 'TOC is empty');
      }
    }
  } else {
    const tocLinks = tocContent.match(/href="#([^"]+)"/g) || [];
    const ids = new Set();
    const idRe = /\bid="([^"]+)"/g;
    let idm;
    while ((idm = idRe.exec(html)) !== null) ids.add(idm[1]);
    let broken = 0;
    for (const link of tocLinks) {
      const targetId = link.match(/href="#([^"]+)"/)[1];
      if (!ids.has(targetId)) broken++;
    }
    if (broken === 0) report.pass(cat, `TOC has ${tocLinks.length} entries, all links valid`);
    else report.warn(cat, `TOC has ${broken} broken link(s)`);
  }
  return fixedHtml;
}

/** 8. HTML 骨架校验 */
function checkHtmlSkeleton(html, report) {
  const cat = 'HTML 骨架';
  const checks = [
    { test: /<meta charset="utf-8"/i, name: 'charset' },
    { test: /<meta name="viewport"/i, name: 'viewport' },
    { test: /<html[^>]*lang="/i, name: 'lang' },
    { test: /<title>[^<]+<\/title>/i, name: '<title>' },
    { test: /<!doctype html>/i, name: 'doctype' },
  ];
  const missing = checks.filter(c => !c.test.test(html)).map(c => c.name);
  if (missing.length === 0) report.pass(cat, `All ${checks.length} skeleton elements present`);
  else report.warn(cat, `Missing: ${missing.join(', ')}`);
}

/** 9. 源码引用校验 (Phase 2) */
function checkSourceRefs(html, report) {
  const cat = '源码引用';
  const hasSourceRef = /class="source-ref"/.test(html);
  const hasSourcesBlock = /class="sources-block"/.test(html);
  const hasRelevantSources = /class="relevant-sources"/.test(html);

  if (!hasSourceRef && !hasSourcesBlock && !hasRelevantSources) {
    const msg = 'No source references found (source-ref, sources-block, relevant-sources)';
    isNewDoc ? report.fail(cat, msg) : report.warn(cat, msg);
  } else {
    if (hasSourceRef) report.pass(cat, 'Source reference links found');
    if (hasSourcesBlock) report.pass(cat, 'Sources blocks found');
    if (hasRelevantSources) report.pass(cat, 'Relevant sources block found');
  }

  // #5: Validate source-ref href contains file:line pattern
  // Only require line numbers for code files, not .md/.html/.css/.json
  const NO_LINE_REQUIRED = /\.(md|html|htm|css|json|yaml|yml|toml|xml|svg|txt|csv|sql|sh|bat|ps1)(\b|$)/i;
  if (hasSourceRef) {
    const refRe = /<a[^>]*class="source-ref"[^>]*href="([^"]*)"[^>]*>/g;
    let refM, emptyRefs = 0, noLineRefs = 0;
    while ((refM = refRe.exec(html)) !== null) {
      const href = refM[1];
      if (!href || href.trim() === '') { emptyRefs++; continue; }
      // Skip line number check for non-code files
      if (NO_LINE_REQUIRED.test(href)) continue;
      if (!/#L\d+/.test(href) && !/:L?\d+/.test(href)) noLineRefs++;
    }
    if (emptyRefs > 0) report.warn(cat, `${emptyRefs} source-ref(s) with empty href`);
    if (noLineRefs > 0) report.warn(cat, `${noLineRefs} source-ref(s) missing line number in href (expected #L<num>)`);
  }
}

/** 10. 术语表校验 (Phase 3) */
function checkGlossary(html, report) {
  const cat = '术语表';
  const hasGlossary = /id="sec-glossary"/.test(html) || /术语表/.test(html);
  if (hasGlossary) report.pass(cat, 'Glossary section found');
  else {
    const msg = 'No glossary section found';
    isNewDoc ? report.fail(cat, msg) : report.warn(cat, msg);
  }
}

/** 11. Scope 声明校验 (Phase 4) */
function checkScopeBlock(html, report) {
  const cat = 'Scope 声明';
  const hasScope = /class="scope-block"/.test(html);
  if (hasScope) report.pass(cat, 'Scope block found');
  else {
    const msg = 'No scope block found';
    isNewDoc ? report.fail(cat, msg) : report.warn(cat, msg);
  }
}

/** 12. 视觉约束校验 (Anti-AI-Slop) */
function checkVisualConstraints(html, report) {
  const cat = '视觉约束';
  const bodyHtml = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  let issues = 0;

  // Check for external image URLs
  const extImgRe = /<img[^>]+src\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  let m;
  while ((m = extImgRe.exec(bodyHtml)) !== null) {
    report.warn(cat, `External image: ${m[1].slice(0, 60)}...`);
    issues++;
  }

  // Check for linear-gradient in inline styles
  if (/style\s*=\s*"[^"]*linear-gradient/i.test(bodyHtml)) {
    report.warn(cat, 'Inline linear-gradient detected — use solid CSS variables');
    issues++;
  }

  // Check for box-shadow in inline styles (skip CSS variables)
  const inlineShadowRe = /style\s*=\s*"[^"]*box-shadow\s*:\s*(?!var\()/gi;
  if (inlineShadowRe.test(bodyHtml)) {
    report.warn(cat, 'Inline box-shadow detected — avoid large shadows');
    issues++;
  }

  // Check for blur filter in inline styles
  if (/style\s*=\s*"[^"]*filter\s*:\s*blur/i.test(bodyHtml)) {
    report.warn(cat, 'Inline blur filter detected — not allowed');
    issues++;
  }

  // Check for hardcoded colors in SVGs (not using CSS variables)
  const svgBlocks = bodyHtml.match(/<svg[\s\S]*?<\/svg>/gi) || [];
  let svgHardcodedColors = 0;
  for (const svg of svgBlocks) {
    const colorAttrs = svg.match(/(?:fill|stroke)\s*=\s*"(#[0-9a-fA-F]{3,8})"/g) || [];
    for (const attr of colorAttrs) {
      if (!/var\(/.test(attr)) svgHardcodedColors++;
    }
  }
  if (svgHardcodedColors > 0) {
    report.warn(cat, `${svgHardcodedColors} SVG color(s) without CSS variable — use var(--name, fallback)`);
    issues++;
  }

  // Check for pure black #000 or pure white #fff in body content
  const pureBlackWhite = bodyHtml.match(/(?:color|background|fill|stroke)\s*[:=]\s*["']?\s*(?:#000000|#000|#ffffff|#fff)\b/gi) || [];
  if (pureBlackWhite.length > 0) {
    report.warn(cat, `${pureBlackWhite.length} pure black (#000) or pure white (#fff) — use warm variants`);
    issues++;
  }

  // Check for translateY hover patterns in inline styles
  if (/translateY\s*\(\s*-\d+px\s*\)/i.test(bodyHtml)) {
    report.warn(cat, 'translateY hover effect detected — use border-color change instead');
    issues++;
  }

  // #2: Check for hardcoded hex colors in inline styles (excluding SVG var() fallbacks)
  const inlineStyleColors = bodyHtml.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  const hexInStyle = inlineStyleColors.match(/style\s*=\s*"[^"]*(?:color|background)\s*:\s*#[0-9a-fA-F]{3,8}/gi) || [];
  if (hexInStyle.length > 0) {
    report.warn(cat, `${hexInStyle.length} inline hardcoded color(s) — use CSS variables`);
    issues++;
  }

  // #8: Check for external URLs in CSS background-image
  const cssUrlExternal = bodyHtml.match(/style\s*=\s*"[^"]*url\s*\(\s*['"]?https?:\/\//gi) || [];
  if (cssUrlExternal.length > 0) {
    report.warn(cat, `${cssUrlExternal.length} external URL(s) in CSS background-image`);
    issues++;
  }

  if (issues === 0) {
    report.pass(cat, 'No anti-slop violations found');
  }
}

// ============================================================
// 13. SVG Diagram Guardrails
// ============================================================
function checkSvgGuardrails(html, report) {
  const cat = 'SVG Guardrails';
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (!bodyMatch) return;
  const body = bodyMatch[0];

  const svgBlocks = body.match(/<svg[\s\S]*?<\/svg>/gi) || [];
  if (svgBlocks.length === 0) {
    report.pass(cat, 'No SVG diagrams found');
    return;
  }

  let issues = 0;
  svgBlocks.forEach((svg, i) => {
    const lines = svg.split('\n').length;
    if (lines > 80) {
      report.warn(cat, `SVG #${i + 1}: ${lines} lines (limit: 80) — consider splitting or using Mermaid`);
      issues++;
    }

    const nodes = (svg.match(/<(?:rect|circle|ellipse|polygon)\s/gi) || []).length;
    if (nodes > 12) {
      report.warn(cat, `SVG #${i + 1}: ${nodes} shape nodes (limit: 12) — consider Mermaid for complex diagrams`);
      issues++;
    }
    if (nodes > 0 && nodes < 4) {
      report.pass(cat, `SVG #${i + 1}: only ${nodes} nodes — text description might suffice`);
    }

    const fills = svg.match(/fill\s*=\s*"var\(--([^,)]+)/g) || [];
    const strokes = svg.match(/stroke\s*=\s*"var\(--([^,)]+)/g) || [];
    const varNames = new Set();
    [...fills, ...strokes].forEach(m => {
      const name = m.match(/var\(--([^,)]+)/);
      if (name) varNames.add(name[1].replace(/-(?:bg|text|border|accent).*/, '').replace(/^(bg|text|border|accent).*/, '$1'));
    });

    if (!svg.includes('role="img"')) {
      report.warn(cat, `SVG #${i + 1}: missing role="img" for accessibility`);
      issues++;
    }
    if (!svg.includes('aria-label')) {
      report.warn(cat, `SVG #${i + 1}: missing aria-label for accessibility`);
      issues++;
    }
  });

  if (issues === 0) {
    report.pass(cat, `${svgBlocks.length} SVG diagram(s) passed guardrails`);
  }
}

// ============================================================
// 14. Figure Captions
// ============================================================
function checkFigCaptions(html, report, isNewDoc) {
  const cat = 'Figure Captions';
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (!bodyMatch) return;
  const body = bodyMatch[0];

  let issues = 0;

  // SVG diagrams in <figure class="diagram"> should have <figcaption>
  const svgFigures = body.match(/<figure[^>]*class="[^"]*diagram[^"]*"[^>]*>[\s\S]*?<\/figure>/gi) || [];
  const figNumRe = /图\s*\d+[\.\-]\d+\s*[—–-]/;
  svgFigures.forEach((fig, i) => {
    if (!/<figcaption/.test(fig)) {
      report.warn(cat, `SVG figure #${i + 1}: missing <figcaption> — add numbered caption (e.g., "图 1.1 — 描述")`);
      issues++;
    } else {
      const caption = fig.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/);
      if (caption && !figNumRe.test(caption[1])) {
        report.warn(cat, `SVG figure #${i + 1}: <figcaption> missing numbering format "图 X.X — 描述"`);
        issues++;
      }
    }
  });

  // Mermaid diagrams in <div class="mermaid-wrap"> should have <figcaption>
  const mermaidWraps = body.match(/<div[^>]*class="[^"]*mermaid-wrap[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi)
    || body.match(/<div[^>]*class="[^"]*mermaid-wrap[^"]*"[^>]*>[\s\S]*?<\/div>/gi)
    || [];
  mermaidWraps.forEach((wrap, i) => {
    if (!/<figcaption/.test(wrap)) {
      report.warn(cat, `Mermaid diagram #${i + 1}: missing <figcaption> inside .mermaid-wrap`);
      issues++;
    } else {
      const caption = wrap.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/);
      if (caption && !figNumRe.test(caption[1])) {
        report.warn(cat, `Mermaid diagram #${i + 1}: <figcaption> missing numbering format "图 X.X — 描述"`);
        issues++;
      }
    }
  });

  // Standalone <svg> in body (not inside <figure>) should also have caption context
  const standaloneSvgs = body.match(/<svg[\s\S]*?<\/svg>/gi) || [];
  const svgsInFigure = svgFigures.length;
  const orphanSvgs = standaloneSvgs.length - svgsInFigure;
  if (orphanSvgs > 0) {
    const msg = `${orphanSvgs} SVG(s) not wrapped in <figure class="diagram">`;
    isNewDoc ? report.fail(cat, msg) : report.warn(cat, msg);
  }

  if (issues === 0 && (svgFigures.length + mermaidWraps.length) > 0) {
    report.pass(cat, `${svgFigures.length + mermaidWraps.length} diagram(s) have proper captions`);
  } else if (svgFigures.length + mermaidWraps.length === 0) {
    report.pass(cat, 'No diagrams requiring captions');
  }
}

// ============================================================
// 15. Empty Section Bodies (#3)
// ============================================================
function checkEmptySections(html, report) {
  const cat = 'Empty Sections';
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (!bodyMatch) return;
  const body = bodyMatch[0];

  const sectionBodyRe = /<div class="section-body">\s*<\/div>/g;
  const total = (body.match(sectionBodyRe) || []).length;
  if (total > 0) {
    report.fail(cat, `${total} empty section body(ies) — AI slop pattern, must have content`);
  } else {
    report.pass(cat, 'No empty sections');
  }
}

// ============================================================
// 16. Duplicate Content Detection (#7)
// ============================================================
function checkDuplicateContent(html, report) {
  const cat = 'Duplicate Content';
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (!bodyMatch) return;
  const body = bodyMatch[0];

  // Check duplicate callouts (same text inside callout)
  const calloutRe = /<div class="callout[^"]*">([\s\S]*?)<\/div>/g;
  const calloutTexts = [];
  let cm;
  while ((cm = calloutRe.exec(body)) !== null) {
    const text = cm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > 20) calloutTexts.push(text);
  }
  const dupCallouts = calloutTexts.filter((t, i) => calloutTexts.indexOf(t) !== i);
  if (dupCallouts.length > 0) {
    report.warn(cat, `${dupCallouts.length} duplicate callout(s) with identical text`);
  }

  // Check duplicate paragraphs (>50 chars, exact match after stripping tags)
  const pRe = /<p>([\s\S]*?)<\/p>/g;
  const pTexts = [];
  let pm;
  while ((pm = pRe.exec(body)) !== null) {
    const text = pm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > 50) pTexts.push(text);
  }
  const dupParas = pTexts.filter((t, i) => pTexts.indexOf(t) !== i);
  if (dupParas.length > 0) {
    report.warn(cat, `${dupParas.length} duplicate paragraph(s) (>50 chars)`);
  }

  if (dupCallouts.length === 0 && dupParas.length === 0) {
    report.pass(cat, 'No duplicate content detected');
  }
}

// ============================================================
// 17. Content Density Check (warn-level)
// ============================================================
function checkContentDensity(html, report) {
  const cat = 'Content Density';
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (!bodyMatch) return;
  const body = bodyMatch[0];

  const sectionRe = /<(?:details|section)[^>]*id="(sec-[^"]*)"[^>]*>([\s\S]*?)(?:<\/details>|<\/section>)/g;
  let sm;
  const sections = [];
  while ((sm = sectionRe.exec(body)) !== null) {
    sections.push({ id: sm[1], content: sm[2] });
  }

  if (sections.length === 0) {
    report.warn(cat, 'No identifiable sections found');
    return;
  }

  let thinCount = 0;
  const thinSections = [];

  for (const sec of sections) {
    const c = sec.content;
    const paras = (c.match(/<p>/g) || []).length;
    const structs =
      (c.match(/<table/g) || []).length +
      (c.match(/<pre/g) || []).length +
      (c.match(/<ul>|<ol>/g) || []).length +
      (c.match(/mermaid-wrap|class="diagram"/g) || []).length;
    if (paras < 2 && structs < 1) {
      thinCount++;
      thinSections.push(sec.id);
    }
  }

  const totalCodeBlocks = (body.match(/<pre/g) || []).length;
  const codeRatio = sections.length > 0 ? totalCodeBlocks / sections.length : 0;

  const totalParas = (body.match(/<p>/g) || []).length;
  const paraRatio = sections.length > 0 ? totalParas / sections.length : 0;

  if (thinCount > 0) {
    report.warn(cat, `${thinCount} thin section(s) (<2 paragraphs and no structural element): ${thinSections.join(', ')}`);
  }
  if (codeRatio < 0.5) {
    report.warn(cat, `Low code density: ${totalCodeBlocks} code blocks across ${sections.length} sections (ratio ${codeRatio.toFixed(1)}, expect ≥0.5)`);
  }
  if (paraRatio < 2) {
    report.warn(cat, `Low paragraph density: ${totalParas} paragraphs across ${sections.length} sections (ratio ${paraRatio.toFixed(1)}, expect ≥2)`);
  }

  if (thinCount === 0 && codeRatio >= 0.5 && paraRatio >= 2) {
    report.pass(cat, `${sections.length} sections, ${totalParas} paragraphs, ${totalCodeBlocks} code blocks — density OK`);
  }
}

// ============================================================
// 17. Progressive Disclosure (fullpower mode)
// ============================================================
function checkProgressiveDisclosure(html, report) {
  const cat = 'Progressive Disclosure';
  // Extract body content
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  if (!bodyMatch) return;
  const body = bodyMatch[0];

  // Count H2 sections
  const h2Count = (body.match(/<h2[\s>]/gi) || []).length;
  if (h2Count === 0) {
    report.pass(cat, 'No H2 sections found');
    return;
  }

  // Count progressive disclosure elements
  const summaryCount = (body.match(/class="section-summary"/gi) || []).length;
  const detailsOpenCount = (body.match(/<details\s[^>]*open/gi) || []).length;
  const detailsCollapsedCount = (body.match(/<details(?!\s[^>]*open)[\s>]/gi) || []).length;

  let issues = 0;

  if (summaryCount < h2Count) {
    report.warn(cat, `Only ${summaryCount}/${h2Count} H2 sections have section-summary (Layer 1)`);
    issues++;
  }
  if (detailsOpenCount === 0) {
    report.warn(cat, 'No default-open <details> found (Layer 2 missing)');
    issues++;
  }
  if (detailsCollapsedCount === 0) {
    report.warn(cat, 'No collapsed <details> found (Layer 3 missing)');
    issues++;
  }

  if (issues === 0) {
    report.pass(cat, `${h2Count} H2 sections with progressive disclosure (summary: ${summaryCount}, details-open: ${detailsOpenCount}, details-collapsed: ${detailsCollapsedCount})`);
  }
}

// ============================================================
// 18. Interaction Features (fullpower mode)
// ============================================================
function checkInteractionFeatures(html, report) {
  const cat = 'Interaction Features';
  let issues = 0;

  // I2: details/summary pairing
  const detailsCount = (html.match(/<details[\s>]/gi) || []).length;
  const summaryCount = (html.match(/<summary[\s>]/gi) || []).length;
  if (detailsCount !== summaryCount) {
    report.fail(cat, `<details> (${detailsCount}) ≠ <summary> (${summaryCount}) — structure broken`);
    issues++;
  }

  // I3: Code highlighting — all <code> in <pre> should have language class
  const codeBlocks = html.match(/<pre><code[^>]*>[\s\S]*?<\/code><\/pre>/gi) || [];
  let missingLang = 0;
  codeBlocks.forEach(block => {
    if (!/class="language-/.test(block)) missingLang++;
  });
  if (missingLang > 0) {
    report.warn(cat, `${missingLang}/${codeBlocks.length} code blocks missing language class`);
    issues++;
  }

  // I4: Dark mode
  if (!html.includes('[data-theme="dark"]') && !html.includes('prefers-color-scheme: dark')) {
    report.warn(cat, 'No dark mode CSS found ([data-theme="dark"] or prefers-color-scheme)');
    issues++;
  }

  // I6: Search-friendly IDs — no duplicates
  const idMatches = html.match(/\bid="([^"]+)"/g) || [];
  const ids = idMatches.map(m => m.match(/id="([^"]+)"/)[1]);
  const seen = new Set();
  const duplicates = [];
  ids.forEach(id => {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  });
  if (duplicates.length > 0) {
    report.fail(cat, `Duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
    issues++;
  }

  // I7: SVG accessibility
  const svgBlocks = html.match(/<svg[\s\S]*?<\/svg>/gi) || [];
  let svgIssues = 0;
  svgBlocks.forEach((svg, i) => {
    if (!svg.includes('role="img"')) { svgIssues++; }
    if (!svg.includes('aria-label')) { svgIssues++; }
  });
  if (svgIssues > 0) {
    report.warn(cat, `${svgIssues} SVG accessibility issues (missing role="img" or aria-label)`);
    issues++;
  }

  if (issues === 0) {
    report.pass(cat, `All interaction features OK (${detailsCount} details, ${codeBlocks.length} code blocks, ${svgBlocks.length} SVGs)`);
  }
}

// ============================================================
// Main
// 剥离代码块内容的通用正则：兼容两种 wrapper（figure/div class="code-block"）
// 与 <code> 带属性形态（<code class="language-cpp">）——只匹配 /<pre><code>/
// 会漏掉带属性的 code，导致 C++ 模板参数 vector<pair<>> 的合法转义
// 被 checkEscapedHtml 误报为"结构性标签被转义"。
const CODE_BLOCK_STRIP_RE = /<(?:figure|div) class="code-block"[^>]*>[\s\S]*?\/(?:figure|div)>|<pre[^>]*>\s*<code[^>]*>[\s\S]*?\/code>\s*\/pre>/g;

/** HTML 转义回归：结构性标签被转成文本（&lt;div&gt; 显示为字面量） */
function checkEscapedHtml(html, report) {
  const cat = 'HTML 转义回归';
  // 剥掉代码块内容（C++ 模板 <T>, <int64_t> 等保留转义是合法的）
  const stripped = html
    .replace(CODE_BLOCK_STRIP_RE, '')
    .replace(/<code[^>]*>[\s\S]*?\/code>/g, '');

  const tags = ['div', '/div', 'details', '/details', 'summary', '/summary', 'p', '/p'];
  let total = 0;
  const detail = [];
  for (const t of tags) {
    const re = new RegExp('&lt;' + t.replace('/', '\\/'), 'g');
    const n = (stripped.match(re) || []).length;
    if (n > 0) { detail.push(t + ':' + n); total += n; }
  }

  if (total === 0) report.pass(cat, '无错误转义的结构性 HTML 标签');
  else report.fail(cat, total + ' 处结构性标签被转义为文本 (' + detail.join(', ') + ')');
}

// ============================================================

function validateFile(filePath, fix) {
  let html = fs.readFileSync(filePath, 'utf-8');
  const report = new Report(path.basename(filePath));
  const originalHtml = html;

  // Original 8 checks
  html = checkMermaid(html, report, fix);
  html = checkHeadingIds(html, report, fix);
  html = checkCodeBlocks(html, report, fix);
  checkTables(html, report);
  checkInlineMarkdown(html, report);
  checkCollapsibleSections(html, report);
  html = checkTOC(html, report, fix);
  checkHtmlSkeleton(html, report);
  checkEscapedHtml(html, report);

  // New checks (Phase 2-4)
  checkSourceRefs(html, report);
  checkGlossary(html, report);
  checkScopeBlock(html, report);

  // Visual constraint checks
  checkVisualConstraints(html, report);

  // Diagram guardrails
  checkSvgGuardrails(html, report);
  checkFigCaptions(html, report, isNewDoc);

  // Content quality
  checkEmptySections(html, report);
  checkDuplicateContent(html, report);
  checkContentDensity(html, report);

  // Interaction tests (fullpower mode)
  if (testInteractive) {
    checkProgressiveDisclosure(html, report);
    checkInteractionFeatures(html, report);
  }

  const result = report.print();

  if (fix && html !== originalHtml) {
    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(`  \x1b[36m[written]\x1b[0m ${filePath}`);
  }
  return result;
}

// Collect targets
let targets = [];
if (convertAll) {
  const types = docType ? [docType] : ['module', 'system', 'guide'];
  for (const t of types) {
    const dir = DIRS[t];
    if (!dir || !fs.existsSync(dir)) continue;
    if (t === 'module') {
      targets.push(...fs.readdirSync(dir)
        .filter(f => f.endsWith('_Design.html'))
        .map(f => path.join(dir, f)));
    } else if (t === 'system') {
      targets.push(...fs.readdirSync(dir)
        .filter(f => f.endsWith('.html') && /Architecture|Design/.test(f) && !f.includes('index'))
        .map(f => path.join(dir, f)));
      // Also include tech-docs for system scans
      const techDir = path.join(dir, 'tech-docs');
      if (fs.existsSync(techDir)) {
        targets.push(...fs.readdirSync(techDir)
          .filter(f => f.endsWith('_Design.html'))
          .map(f => path.join(techDir, f)));
      }
    } else if (t === 'guide') {
      const guidePath = path.join(dir, 'guide.html');
      if (fs.existsSync(guidePath)) targets.push(guidePath);
    }
  }
} else {
  targets = files.map(f => path.resolve(f));
}

let totalFail = 0, totalWarn = 0;

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP  ${filePath} (not found)`);
    continue;
  }
  const result = validateFile(filePath, doFix);
  totalFail += result.fail;
  totalWarn += result.warn;
}

console.log(`\n${'='.repeat(60)}`);
if (totalFail === 0 && totalWarn === 0) {
  console.log(`  \x1b[32mALL PASSED\x1b[0m — ${targets.length} file(s) validated`);
} else {
  const parts = [];
  if (totalFail > 0) parts.push(`\x1b[31m${totalFail} error(s)\x1b[0m`);
  if (totalWarn > 0) parts.push(`\x1b[33m${totalWarn} warning(s)\x1b[0m`);
  console.log(`  ${parts.join(', ')} across ${targets.length} file(s)`);
}

if (totalFail > 0) process.exit(1);
if (strict && totalWarn > 0) process.exit(2);
process.exit(0);
