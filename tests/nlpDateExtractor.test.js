process.env.TZ = 'UTC';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

let nlpDateExtractorModule;

async function loadNlpDateExtractor() {
  if (!nlpDateExtractorModule) {
    const moduleUrl = pathToFileURL(
      resolve(__dirname, '..', 'js', 'utils', 'nlpDateExtractor.js')
    );
    nlpDateExtractorModule = import(moduleUrl.href);
  }

  return nlpDateExtractorModule;
}

function assertUtcDate(date, year, monthIndex, day) {
  assert.equal(date.getUTCFullYear(), year);
  assert.equal(date.getUTCMonth(), monthIndex);
  assert.equal(date.getUTCDate(), day);
}

test('extractDate resolves day after tomorrow two days from now', async () => {
  const { extractDate } = await loadNlpDateExtractor();
  const now = new Date(Date.UTC(2026, 4, 29, 10, 0, 0, 0));

  const tomorrow = new Date(extractDate('submit math homework tomorrow', now));
  const dayAfterTomorrow = new Date(
    extractDate('submit math homework day after tomorrow', now)
  );

  assertUtcDate(tomorrow, 2026, 4, 30);
  assertUtcDate(dayAfterTomorrow, 2026, 4, 31);
  assert.equal(
    dayAfterTomorrow.getTime() - tomorrow.getTime(),
    24 * 60 * 60 * 1000
  );
});
