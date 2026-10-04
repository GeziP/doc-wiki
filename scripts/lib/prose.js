'use strict';

// A conservative, dependency-free scanner, not a complete Markdown/HTML parser.
// Mask rather than delete syntax to preserve UTF-16 offsets and original line numbers.
function blank(text) { return text.replace(/[^\r\n]/g, ' '); }
function mask(text, pattern) { return text.replace(pattern, blank); }
function decodeEntities(text) {
  const offsets = [];
  let decoded = '', previous = 0;
  const append = (value, index, literal = false) => {
    decoded += value;
    for (let i = 0; i < value.length; i++) offsets.push(index + (literal ? i : 0));
  };
  for (const match of text.matchAll(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:\d+|x[\da-f]+);/gi)) {
    append(text.slice(previous, match.index), previous, true);
    const token = match[0];
    const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
    const n = token[2].toLowerCase() === 'x' ? parseInt(token.slice(3, -1), 16) : parseInt(token.slice(2, -1), 10);
    const value = named[token.toLowerCase()] || (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : token);
    append(value, match.index);
    previous = match.index + token.length;
  }
  append(text.slice(previous), previous, true);
  return { text: decoded, offsets };
}
function maskHtml(text) {
  text = mask(text, /<!--[\s\S]*?(?:-->|$)/g);
  text = mask(text, /<(pre|code|script|style|svg|textarea)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi);
  // Mermaid containers can be nested. Hide their content up to the matching element.
  const start = /<(div|pre)\b([^>]*\bclass\s*=\s*(?:"[^"]*\bmermaid\b[^"]*"|'[^']*\bmermaid\b[^']*'|mermaid)[^>]*)>/gi;
  let m;
  while ((m = start.exec(text))) {
    const tag = m[1];
    const tokens = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
    tokens.lastIndex = start.lastIndex;
    let depth = 1, end = text.length, t;
    while ((t = tokens.exec(text))) {
      depth += t[0].startsWith('</') ? -1 : 1;
      if (!depth) { end = tokens.lastIndex; break; }
    }
    text = text.slice(0, m.index) + blank(text.slice(m.index, end)) + text.slice(end);
    start.lastIndex = end;
  }
  return mask(text, /<[^>]*>/g);
}
function maskMarkdown(text) {
  const lines = text.split(/(?<=\n)/);
  let fence = null;
  let frontmatter = lines[0]?.trim() === '---';
  text = lines.map((line, index) => {
    if (frontmatter) {
      if (index && /^(---|\.\.\.)\s*$/.test(line.trim())) frontmatter = false;
      return blank(line);
    }
    // Fences may be nested in list items or blockquotes; over-masking is preferable to linting code.
    const body = line.replace(/^\s*(?:>\s*)*/, '').replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '');
    const marker = body.match(/^\s*(`{3,}|~{3,})(.*)/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return blank(line);
    }
    if (marker) { fence = { char: marker[1][0], length: marker[1].length }; return blank(line); }
    if (/^(?: {4}|\t)/.test(line)) return blank(line);
    if (/^\s*\[[^\]]+\]:/.test(line)) return blank(line);
    return line;
  }).join('');
  // Matching backtick runs, including multiline inline code.
  text = mask(text, /(`+)(?!`)[\s\S]*?\1(?!`)/g);
  text = mask(text, /!\[[^\]]*\]\([^\n]*?\)|!\[[^\]]*\]\[[^\]]*\]/g);
  // Keep visible link labels; mask only destination and Markdown delimiters.
  text = text.replace(/\[([^\]\n]+)\]\((?:[^()\n]|\([^()\n]*\))*\)|\[([^\]\n]+)\]\[[^\]\n]*\]/g,
    (whole, inline, ref) => ' ' + (inline ?? ref) + blank(whole.slice(1 + (inline ?? ref).length)));
  return text;
}
function proseSegments(source, format) {
  let masked = format === 'html' ? source : maskMarkdown(source);
  masked = maskHtml(masked);
  masked = mask(masked, /\b(?:https?:\/\/|www\.)[^\s<>]+/gi);
  const segments = [];
  let offset = 0;
  for (const raw of masked.split(/\r?\n/)) {
    // Table cells are separate prose, never one compound sentence.
    let col = 0;
    for (const cell of raw.split('|')) {
      const leading = cell.search(/\S/);
      if (leading >= 0 && !/^\s*[:\-\s]+$/.test(cell)) {
        const decoded = decodeEntities(cell.trim());
        segments.push({ ...decoded, offset: offset + col + leading });
      }
      col += cell.length + 1;
    }
    offset += raw.length + (source.slice(offset + raw.length, offset + raw.length + 2) === '\r\n' ? 2 : 1);
  }
  return segments;
}
function location(source, offset) {
  const before = source.slice(0, offset);
  const last = before.lastIndexOf('\n');
  return { line: (before.match(/\n/g) || []).length + 1, column: offset - last };
}
module.exports = { proseSegments, location, decodeEntities };
