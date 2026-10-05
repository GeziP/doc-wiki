#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { digest, relativeFile, issue, makeReport, gate, readJson } = require('./lib/quality-report');
const { proseSegments, location } = require('./lib/prose');
const { parseSourceReference } = require('./lib/source-reference');

const RULES = ['placeholder', 'forbidden-term', 'long-sentence', 'marketing', 'vague-reference', 'multi-action'];
function validateTerms(config) {
  if (!config || config.version !== 1 || !Array.isArray(config.terms)) throw new Error('Terms config requires version: 1 and terms: []');
  const names = new Set(), reserved = new Set(), banned = new Set(), owners = new Map();
  for (const t of config.terms) {
    if (!t || typeof t.canonical !== 'string' || !t.canonical.trim() || t.canonical !== t.canonical.trim() || names.has(t.canonical.toLowerCase())) throw new Error('Each term needs a unique nonempty canonical name');
    names.add(t.canonical.toLowerCase());
    for (const field of ['aliases', 'forbidden', 'identifiers']) {
      if (t[field] !== undefined && (!Array.isArray(t[field]) || !t[field].every(s => typeof s === 'string' && s.trim() && s === s.trim()))) throw new Error(`Invalid ${field} for ${t.canonical}`);
    }
    for (const s of [t.canonical, ...(t.aliases || []), ...(t.identifiers || [])]) {
      const name = s.toLowerCase();
      if (owners.has(name) && owners.get(name) !== t.canonical) throw new Error(`Name maps to multiple concepts: ${s}`);
      owners.set(name, t.canonical);
      reserved.add(name);
    }
    for (const s of t.forbidden || []) {
      if (banned.has(s.toLowerCase())) throw new Error(`Duplicate forbidden alias: ${s}`);
      banned.add(s.toLowerCase());
    }
  }
  for (const s of banned) if (reserved.has(s)) throw new Error(`Forbidden alias is also an allowed name or identifier: ${s}`);
  return config;
}
function termMatches(text, term) {
  const result = [];
  // Match on the original string: lowercasing Unicode can change its length.
  const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  for (const match of text.matchAll(pattern)) {
    const pos = match.index;
    // ASCII names must match whole identifier words (task != task_id or multitask).
    const leftOK = !/^[\w]/.test(term) || !/[\w]/.test(text[pos - 1] || '');
    const rightOK = !/[\w]$/.test(term) || !/[\w]/.test(text[pos + term.length] || '');
    if (leftOK && rightOK) result.push(pos);
  }
  return result;
}
function lint(source, { file = '<stdin>', format = 'markdown', mode = 'explain', terms = { version: 1, terms: [] }, disabled = [] } = {}) {
  const findings = [];
  for (const segment of proseSegments(source, format)) {
    // Source paths are code identifiers, not prose; retain offsets for nearby text.
    const text = segment.text.replace(/\{\{([^{}\n]+)\}\}/g, (whole, value) =>
      parseSourceReference(value) ? ' '.repeat(whole.length) : whole);
    const add = (rule, severity, message, index = 0, key) => {
      if (!disabled.includes(rule)) findings.push(issue({ file, rule, severity, message,
        ...location(source, segment.offset + (segment.offsets[index] ?? index)), context: text.replace(/\s+/g, ' ').trim(), key }));
    };
    for (const m of text.matchAll(/\{\{([^{}\n]+)\}\}/g)) {
      if (!parseSourceReference(m[1])) add('placeholder', 'error', `Unresolved placeholder: ${m[0]}`, m.index, `${text}|${m[0]}`);
    }
    for (const term of terms.terms) {
      for (const alias of term.forbidden || []) {
        for (const index of termMatches(text, alias)) add('forbidden-term', 'error', `Use "${term.canonical}" instead of forbidden alias "${alias}"`, index, `${text}|${term.canonical}|${alias}`);
      }
    }
    for (const m of text.matchAll(/\b(?:seamless(?:ly)?|effortless(?:ly)?|blazing-fast|world-class|cutting-edge)\b|无缝|极致|业界领先|完美无缺/gi)) {
      add('marketing', 'warning', 'Quality claim: provide evidence or use a concrete description', m.index, `${text}|${m[0].toLowerCase()}`);
    }
    // Never flag modality/hedges: may, might, could, 可能 etc. are content.
    if (mode === 'strict') {
      for (const m of text.matchAll(/必要时|适当处理|相关操作|视情况而定|\bas (?:needed|appropriate)\b/gi)) add('vague-reference', 'warning', 'Specify the condition or action if the source supports it', m.index, `${text}|${m[0]}`);
      if (/然后|接着|随后|\b(?:and then|then)\b/i.test(text)) add('multi-action', 'warning', 'Review whether this procedure needs separate numbered actions');
    }
    // One physical line at a time; wrapped sentences may escape this heuristic.
    for (const m of text.matchAll(/[^。！？.!?]+[。！？.!?]?/g)) {
      const sentence = m[0].trim();
      const cjk = (sentence.match(/[\u3400-\u9fff]/g) || []).length;
      const words = (sentence.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
      const limit = mode === 'strict' ? 20 : 25;
      if (cjk > (mode === 'strict' ? 50 : 70) || words > limit) {
        add('long-sentence', 'warning', `Review sentence length (${cjk} CJK characters, ${words} English words); preserve conditions and modality`, m.index, sentence.replace(/\s+/g, ' '));
      }
    }
  }
  return findings;
}
function parseArgs(args) {
  const opts = { mode: 'explain', root: process.cwd(), disabled: [], files: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { opts.files.push(...args.slice(i + 1)); break; }
    if (['--json', '--strict', '--help'].includes(a)) { opts[a.slice(2)] = true; continue; }
    if (['--mode', '--root', '--terms', '--disable', '--baseline'].includes(a)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${a}`);
      if (a === '--disable') opts.disabled = value.split(',');
      else opts[a.slice(2)] = value;
    } else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else opts.files.push(a);
  }
  if (!['strict', 'explain'].includes(opts.mode)) throw new Error('Mode must be strict or explain');
  for (const rule of opts.disabled) if (!RULES.includes(rule)) throw new Error(`Unknown rule: ${rule}`);
  opts.root = path.resolve(opts.root);
  return opts;
}
function main(args) {
  const json = args.includes('--json');
  try {
    const opts = parseArgs(args);
    if (opts.help || !opts.files.length) {
      const usage = 'node lint-doc-language.js [--mode strict|explain] [--terms terms.json] [--json] [--strict] [--disable rule,...] [--baseline report.json] [--root dir] file.md|file.html ...';
      if (json) console.log(JSON.stringify({ usage, rules: RULES })); else console.log(usage);
      return 0;
    }
    const terms = opts.terms ? validateTerms(readJson(opts.terms)) : { version: 1, terms: [] };
    const targets = [...new Set(opts.files.map(f => path.resolve(f)))];
    const issues = targets.flatMap(target => {
      const file = relativeFile(target, opts.root);
      try {
        const source = fs.readFileSync(target, 'utf8');
        return lint(source, { file, format: /\.html?$/i.test(target) ? 'html' : 'markdown', mode: opts.mode, terms, disabled: opts.disabled });
      } catch (error) { return [issue({ file, rule: 'input/read', severity: 'error', message: error.message })]; }
    });
    const report = makeReport('doc-language', targets.map(f => relativeFile(f, opts.root)),
      { engine: 3, mode: opts.mode, terms: digest(terms), disabled: [...new Set(opts.disabled)].sort(), strict: !!opts.strict }, issues);
    const code = gate(report, opts);
    if (opts.json) console.log(JSON.stringify(report, null, 2));
    else {
      for (const i of issues) console.log(`${i.file}:${i.line || 1}:${i.column || 1} ${i.severity} ${i.rule}: ${i.message}`);
      console.log(`${report.summary.files} file(s), ${report.summary.errors} error(s), ${report.summary.warnings} warning(s). Structural checks only; meaning and facts require review.`);
      if (report.baseline) console.log(`Baseline: ${report.baseline.added.length} added, ${report.baseline.resolved.length} resolved`);
    }
    return code;
  } catch (error) {
    if (json) console.log(JSON.stringify({ schemaVersion: 1, tool: 'doc-language', fatal: error.message }));
    else console.error(error.message);
    return 1;
  }
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { lint, validateTerms, parseArgs, main };
