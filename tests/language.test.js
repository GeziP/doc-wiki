'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { lint, validateTerms } = require('../scripts/lint-doc-language');

test('Chinese/English warnings are advisory; hedges and conditions are preserved', () => {
  const source = '请求可能失败。除非重试关闭，否则最多重试 3 次。\nThe request may have failed. It might be a timeout. It could fail again.';
  assert.deepEqual(lint(source, { mode: 'strict' }), []);
  assert.equal(source.includes('可能'), true);
  const problems = lint('无缝处理请求，必要时适当处理，然后返回。\nA seamless operation starts and then finishes.', { mode: 'strict' });
  assert(problems.some(i => i.rule === 'marketing'));
  assert(problems.some(i => i.rule === 'vague-reference'));
  assert(problems.some(i => i.rule === 'multi-action'));
  assert(problems.every(i => i.severity === 'warning'));
  assert(!lint('必要时适当处理，然后返回。').some(i => ['vague-reference', 'multi-action'].includes(i.rule)));
});

test('unresolved placeholders fail only in prose, including visible table cells', () => {
  const problems = lint('实际 {{NAME}}\n| 参数 | 含义 |\n| --- | --- |\n| 输入 | {{DESCRIPTION}} |\n`{{CODE}}`');
  assert.equal(problems.length, 2);
  assert(problems.every(i => i.rule === 'placeholder' && i.severity === 'error'));
  assert.deepEqual(problems.map(i => i.line), [1, 4]);
});

test('converter source shorthand is resolved syntax, not an unfinished template', () => {
  assert.deepEqual(lint('对应实现 {{scripts/lib/quality-report.js:22-28}}。单行 {{SKILL.md:1}}。'), []);
  const invalid = lint('未完成 {{MODULE_NAME}}。错误范围 {{scripts/lib/prose.js:28-22}}。零行 {{scripts/lib/prose.js:0}}。');
  assert.equal(invalid.length, 3);
  assert(invalid.every(i => i.rule === 'placeholder'));
});

test('Markdown fences, inline code, URLs, images and frontmatter do not produce findings', () => {
  const source = [
    '---', 'title: seamless {{TITLE}}', '---',
    '````cpp', 'seamless {{CODE}}', '```', 'still seamless {{CODE}}', '````',
    '> ~~~~mermaid', '> graph LR; seamless', '> ~~~~',
    '    seamless {{INDENTED}}', '``seamless `{{INLINE}}` ``',
    'https://example.com/seamless/{{URL}}', '[文档](https://example.com/seamless)',
    '![seamless {{ALT}}](image.png)', '[ref]: https://example.com/seamless',
  ].join('\r\n');
  assert.deepEqual(lint(source), []);
  const findings = lint(source + '\r\n实际 {{NAME}}');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, source.split('\r\n').length + 1);
  assert.equal(findings[0].column, 4);
});

test('visible link labels remain prose; destination and identifier code do not', () => {
  assert.equal(lint('[seamless](https://example.com/effortlessly)').length, 1);
  assert.equal(lint('[seamless][ref]').length, 1);
  assert.deepEqual(lint('[文档](https://example.com/a_(seamless))'), []);
});

test('HTML excludes code/runtime/SVG/Mermaid but checks visible prose and entities', () => {
  const source = [
    '<style>.seamless {}</style><script>const x = "{{X}}";</script>',
    '<pre class="code"><code>seamless {{CODE}}</code></pre>',
    '<code>seamless</code><svg><text>seamless {{SVG}}</text></svg>',
    '<div class="mermaid"><div>seamless</div>{{DIAGRAM}}</div>',
    '<!-- seamless {{COMMENT}} -->',
    '<p>seam&#108;ess {{NAME}}</p>',
  ].join('\r\n');
  const findings = lint(source, { format: 'html' });
  assert.equal(findings.length, 2);
  assert(findings.every(i => i.line === 6));
  assert.equal(findings.find(i => i.rule === 'marketing').column, 4);
  assert.equal(findings.find(i => i.rule === 'placeholder').column, 18);
  assert.deepEqual(lint('<pre>seamless {{UNCLOSED}}', { format: 'html' }), []);
});

test('explicit terms respect English identifier boundaries, permitted aliases and Chinese terms', () => {
  const terms = validateTerms({ version: 1, terms: [
    { canonical: '任务', aliases: ['Task'], identifiers: ['task_id'], forbidden: ['作业'] },
    { canonical: 'remove', aliases: [], forbidden: ['erase'] },
  ] });
  const findings = lint('任务 Task task_id 作业。Erase the record; eraser and erase_id remain. `作业 erase`', { terms });
  assert.equal(findings.length, 2);
  assert(findings.every(i => i.rule === 'forbidden-term' && i.severity === 'error'));
  assert.deepEqual(lint('Task task_id 任务 eraser erase_id', { terms }), []);
  assert.throws(() => validateTerms({ terms: [] }), /version/);
  assert.throws(() => validateTerms({ version: 1, terms: [{ canonical: 'Task', forbidden: ['Task'] }] }), /allowed/);
  assert.throws(() => validateTerms({ version: 1, terms: [{ canonical: 'Task', aliases: '任务' }] }), /aliases/);
  assert.throws(() => validateTerms({ version: 1, terms: [{ canonical: 'Task' }, { canonical: 'task' }] }), /unique/);
  assert.throws(() => validateTerms({ version: 1, terms: [{ canonical: '任务', aliases: ['Job'] }, { canonical: '作业', aliases: ['Job'] }] }), /multiple concepts/);
});

test('sentence length is a configurable-mode advisory, not a reason to drop precision', () => {
  const words = Array.from({ length: 23 }, () => 'condition').join(' ');
  assert.deepEqual(lint(words), []);
  assert.equal(lint(words, { mode: 'strict' })[0].rule, 'long-sentence');
  const chinese = '条件'.repeat(36) + '可能失败。';
  assert.equal(lint(chinese)[0].severity, 'warning');
  assert.deepEqual(lint(chinese, { disabled: ['long-sentence'] }), []);
});
