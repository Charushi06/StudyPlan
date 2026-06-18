const test = require('node:test');
const assert = require('node:assert/strict');

const { escapeCSVField } = require('../backend/controllers/csvDownload.controller.js');

// ---------------------------------------------------------------------------
// escapeCSVField unit tests
// ---------------------------------------------------------------------------

test('escapeCSVField wraps a plain value in double quotes', () => {
  assert.equal(escapeCSVField('hello'), '"hello"');
});

test('escapeCSVField handles numeric values', () => {
  assert.equal(escapeCSVField(42), '"42"');
  assert.equal(escapeCSVField(3.14), '"3.14"');
});

test('escapeCSVField returns empty quoted field for null', () => {
  assert.equal(escapeCSVField(null), '""');
});

test('escapeCSVField returns empty quoted field for undefined', () => {
  assert.equal(escapeCSVField(undefined), '""');
});

test('escapeCSVField returns empty quoted field for empty string', () => {
  assert.equal(escapeCSVField(''), '""');
});

test('escapeCSVField escapes an embedded double quote by doubling it', () => {
  assert.equal(escapeCSVField('say "hello"'), '"say ""hello"""');
});

test('escapeCSVField wraps a value containing a comma', () => {
  const result = escapeCSVField('Math, Chapter 5');
  assert.equal(result, '"Math, Chapter 5"');
  // The comma must not appear outside the enclosing quotes.
  assert.ok(result.startsWith('"'));
  assert.ok(result.endsWith('"'));
});

test('escapeCSVField wraps a value containing a newline', () => {
  const result = escapeCSVField('line 1\nline 2');
  assert.equal(result, '"line 1\nline 2"');
});

test('escapeCSVField wraps a value containing a CRLF', () => {
  const result = escapeCSVField('line 1\r\nline 2');
  assert.equal(result, '"line 1\r\nline 2"');
});

// ---------------------------------------------------------------------------
// CSV injection protection
// ---------------------------------------------------------------------------

test('escapeCSVField prefixes = formula with a tab', () => {
  const result = escapeCSVField('=SUM(A1:A10)');
  assert.ok(result.startsWith('"\t'), `Expected tab prefix, got: ${result}`);
  assert.ok(result.includes('=SUM(A1:A10)'));
});

test('escapeCSVField prefixes + formula with a tab', () => {
  const result = escapeCSVField('+cmd|/C calc');
  assert.ok(result.startsWith('"\t'));
});

test('escapeCSVField prefixes - formula with a tab', () => {
  const result = escapeCSVField('-2+3');
  assert.ok(result.startsWith('"\t'));
});

test('escapeCSVField prefixes @ formula with a tab', () => {
  const result = escapeCSVField('@SUM(1+1)');
  assert.ok(result.startsWith('"\t'));
});

test('escapeCSVField prefixes hyperlink formula with a tab', () => {
  const result = escapeCSVField('=HYPERLINK("https://example.com")');
  assert.ok(result.startsWith('"\t'));
  assert.ok(result.includes('=HYPERLINK'));
});

test('escapeCSVField does not alter a value that does not start with a formula character', () => {
  assert.equal(escapeCSVField('Normal text'), '"Normal text"');
  assert.equal(escapeCSVField('100'), '"100"');
  assert.equal(escapeCSVField('2026-05-30'), '"2026-05-30"');
});

// ---------------------------------------------------------------------------
// Full-row and multi-row CSV construction
// ---------------------------------------------------------------------------

function buildRow(fields) {
  return fields.map(escapeCSVField).join(',');
}

function buildCsv(rows) {
  return rows.map(buildRow).join('\r\n');
}

test('a row with only clean values has the correct column count', () => {
  const headers = ['Task ID', 'Subject', 'Title', 'Due At', 'Status', 'Priority', 'Confidence Score', 'Notes'];
  const row = ['1', 'Math', 'Chapter 5', '2026-06-01', 'pending', 'high', '0.9', 'Study tonight'];
  const line = buildRow(row);
  const columnCount = line.split('","').length;
  assert.equal(columnCount, headers.length);
});

test('a field containing a comma does not increase the column count', () => {
  const row = ['1', 'Math, Science', 'Chapter 5, Part 2', '2026-06-01', 'pending', 'high', '0.9', 'Review chapter 5, then 6'];
  const line = buildRow(row);
  // Split by unquoted commas is tricky; verify column count via quote-aware parse.
  // A simpler structural check: every value is enclosed in quotes.
  const cells = line.split('","');
  assert.equal(cells.length, 8);
});

test('a field containing a newline does not add extra rows to the CSV', () => {
  const data = [
    ['1', 'Math', 'Review chapter 5\nReview chapter 6', '2026-06-01', 'pending', 'high', '0.9', 'multi-line notes\nline 2'],
  ];
  const csv = buildCsv(data);
  // The newlines inside fields are enclosed in quotes, so splitting on CRLF
  // should yield exactly one row (no extra row boundary introduced by CRLF
  // because the embedded newline is LF-only inside the quoted field).
  const crlfRows = csv.split('\r\n');
  assert.equal(crlfRows.length, 1);
});

test('multiple rows are separated by CRLF', () => {
  const data = [
    ['1', 'Math', 'Task A', '2026-06-01', 'pending', 'high', '0.9', ''],
    ['2', 'Science', 'Task B', '2026-06-02', 'done', 'low', '1.0', ''],
  ];
  const csv = buildCsv(data);
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 2);
});

test('formula-prefixed title does not appear as a formula in the cell value', () => {
  const title = '=HYPERLINK("https://evil.example.com","Click me")';
  const result = escapeCSVField(title);
  // Must start with the tab prefix inside the quotes, not the = character.
  assert.ok(!result.startsWith('"='), `Field must not start with "= but got: ${result}`);
  assert.ok(result.startsWith('"\t'));
});

test('mixed special characters are handled correctly', () => {
  const value = 'She said "hello, world"\nSecond line';
  const result = escapeCSVField(value);
  assert.equal(result, '"She said ""hello, world""\nSecond line"');
});

// ---------------------------------------------------------------------------
// Regression: all non-notes fields must now be escaped
// ---------------------------------------------------------------------------

test('regression: subject_name containing a comma does not split into extra columns', () => {
  const subject = 'Math, Physics';
  const escaped = escapeCSVField(subject);
  // Must be wrapped in quotes so the comma is not a delimiter.
  assert.ok(escaped.startsWith('"'));
  assert.ok(escaped.endsWith('"'));
  assert.ok(!escaped.slice(1, -1).startsWith('"'));
});

test('regression: title containing a newline does not produce an extra CSV row', () => {
  const title = 'Review chapter 5\nReview chapter 6';
  const escaped = escapeCSVField(title);
  assert.equal(escaped, '"Review chapter 5\nReview chapter 6"');
});

test('regression: notes field is escaped identically to other fields', () => {
  const notes = 'She said "hi", then left.\nNew line.';
  const escaped = escapeCSVField(notes);
  assert.equal(escaped, '"She said ""hi"", then left.\nNew line."');
});

test('regression: numeric id is serialized as a quoted string', () => {
  assert.equal(escapeCSVField(7), '"7"');
});

test('regression: date field with no special characters is unchanged inside quotes', () => {
  assert.equal(escapeCSVField('2026-05-30T12:00:00Z'), '"2026-05-30T12:00:00Z"');
});
