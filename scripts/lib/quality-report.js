'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCHEMA_VERSION = 1;
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  }
  return value;
}
function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function relativeFile(file, root) {
  return path.relative(root, path.resolve(file)).split(path.sep).join('/');
}
function issue({ file, rule, severity, message, line, column, context, key }) {
  const identity = { file, rule, severity, key: key ?? context ?? message };
  return { id: digest(identity), file, rule, severity, message,
    ...(line !== undefined ? { line } : {}),
    ...(column !== undefined ? { column } : {}),
    ...(context !== undefined ? { context } : {}) };
}
function makeReport(tool, targets, profile, issues, extra = {}) {
  return {
    schemaVersion: SCHEMA_VERSION, tool,
    targets: [...new Set(targets)].sort(), profile: stable(profile),
    issues,
    summary: {
      files: new Set(targets).size,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
    },
    ...extra,
  };
}
function validateReport(value) {
  if (!value || value.schemaVersion !== SCHEMA_VERSION || typeof value.tool !== 'string' ||
      !Array.isArray(value.targets) || !value.targets.every(t => typeof t === 'string') ||
      !value.profile || !Array.isArray(value.issues)) throw new Error('Invalid quality baseline schema');
  for (const i of value.issues) {
    if (!i || !/^[a-f0-9]{64}$/.test(i.id) || typeof i.file !== 'string' ||
        !value.targets.includes(i.file) || typeof i.rule !== 'string' ||
        !['error', 'warning'].includes(i.severity) || typeof i.message !== 'string') {
      throw new Error('Invalid quality baseline issue');
    }
  }
  return value;
}
function compareBaseline(current, previous) {
  validateReport(current);
  validateReport(previous);
  if (current.tool !== previous.tool || digest(current.targets) !== digest(previous.targets) ||
      digest(current.profile) !== digest(previous.profile)) {
    throw new Error('Baseline requires the same tool, target set and check configuration');
  }
  // A multiset catches additional copies of an existing finding. Line numbers are not identity.
  const oldCounts = new Map();
  const newCounts = new Map();
  for (const i of previous.issues) oldCounts.set(i.id, (oldCounts.get(i.id) || 0) + 1);
  for (const i of current.issues) newCounts.set(i.id, (newCounts.get(i.id) || 0) + 1);
  const consume = (items, counts) => items.filter(i => {
    const n = counts.get(i.id) || 0;
    if (n) { counts.set(i.id, n - 1); return false; }
    return true;
  });
  return {
    added: consume(current.issues, new Map(oldCounts)),
    resolved: consume(previous.issues, new Map(newCounts)),
    unchanged: current.issues.length - consume(current.issues, new Map(oldCounts)).length,
  };
}
function gate(report, { baseline, strict = false } = {}) {
  if (baseline) report.baseline = compareBaseline(report, readJson(baseline));
  const findings = report.baseline ? report.baseline.added : report.issues;
  // Input failures must never be accepted as historical debt.
  if (report.issues.some(i => i.rule.startsWith('input/')) || findings.some(i => i.severity === 'error')) return 1;
  return strict && findings.some(i => i.severity === 'warning') ? 2 : 0;
}

module.exports = { digest, relativeFile, issue, makeReport, compareBaseline, gate, readJson };
