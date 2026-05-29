const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

let nlpDateExtractorModule;

async function loadNlpDateExtractor() {
  if (!nlpDateExtractorModule) {
    const source = readFileSync(
      join(__dirname, '..', 'js', 'utils', 'nlpDateExtractor.js'),
      'utf8'
    );
    const encodedSource = Buffer.from(source).toString('base64');
    // Load the browser ESM helper without changing the CommonJS package mode.
    nlpDateExtractorModule = import(`data:text/javascript;base64,${encodedSource}`);
  }

  return nlpDateExtractorModule;
}

function assertLocalDate(date, year, monthIndex, day) {
  assert.equal(date.getFullYear(), year);
  assert.equal(date.getMonth(), monthIndex);
  assert.equal(date.getDate(), day);
}

test('extractDate resolves day after tomorrow two days from now', async () => {
  const { extractDate } = await loadNlpDateExtractor();
  const now = new Date(2026, 4, 29, 10, 0, 0, 0);

  const tomorrow = new Date(extractDate('submit math homework tomorrow', now));
  const dayAfterTomorrow = new Date(
    extractDate('submit math homework day after tomorrow', now)
  );

  assertLocalDate(tomorrow, 2026, 4, 30);
  assertLocalDate(dayAfterTomorrow, 2026, 4, 31);
  assert.equal(
    dayAfterTomorrow.getTime() - tomorrow.getTime(),
    24 * 60 * 60 * 1000
  );
});
