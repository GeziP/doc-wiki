'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { issue, makeReport, compareBaseline } = require('../scripts/lib/quality-report');

const problem = (file, content, line = 1) => issue({ file, rule: 'placeholder', severity: 'error', message: 'Placeholder', context: content, line });
const report = issues => makeReport('test', ['a/doc.md', 'b/doc.md'], { mode: 'explain' }, issues);

test('baseline identity distinguishes directories and remains stable when lines move', () => {
  const a = problem('a/doc.md', '{{A}}', 1), moved = problem('a/doc.md', '{{A}}', 20);
  const b = problem('b/doc.md', '{{A}}');
  assert.equal(a.id, moved.id);
  assert.notEqual(a.id, b.id);
  const delta = compareBaseline(report([moved, b]), report([a]));
  assert.equal(delta.added.length, 1);
  assert.equal(delta.unchanged, 1);
});

test('fixing an old finding cannot pay for a different new finding', () => {
  const delta = compareBaseline(report([problem('a/doc.md', '{{NEW}}')]), report([problem('a/doc.md', '{{OLD}}')]));
  assert.equal(delta.added.length, 1);
  assert.equal(delta.resolved.length, 1);
});

test('additional occurrences fail even with an existing identity; deletions are improvements', () => {
  const a = problem('a/doc.md', '{{A}}');
  assert.equal(compareBaseline(report([a, a]), report([a])).added.length, 1);
  assert.equal(compareBaseline(report([]), report([a])).resolved.length, 1);
});

test('mismatched scope, tool, configuration and malformed baselines are rejected', () => {
  const original = report([]);
  for (const changed of [
    { ...original, targets: ['a/doc.md'] }, { ...original, tool: 'other' },
    { ...original, profile: { mode: 'strict' } },
  ]) assert.throws(() => compareBaseline(changed, original), /same tool/);
  assert.throws(() => compareBaseline(original, {}), /schema/);
  assert.throws(() => compareBaseline(original, { ...original, issues: [{ id: 'bad' }] }), /issue/);
});
