'use strict';

// Shared contract for the converter's {{file:start-end}} shorthand.
// This validates syntax only; the caller/reviewer must verify the source itself.
function parseSourceReference(value) {
  const match = value.match(/^([^{}\n]+?):([1-9]\d*)(?:-([1-9]\d*))?$/);
  if (!match || (match[3] && Number(match[3]) < Number(match[2]))) return null;
  const [, file, start, end] = match;
  return {
    file, start, end,
    label: `${file}:${start}${end ? '-' + end : ''}`,
    href: `${file}#L${start}${end ? '-L' + end : ''}`,
  };
}
module.exports = { parseSourceReference };
