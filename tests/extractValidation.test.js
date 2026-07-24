const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_EXTRACTION_TEXT_LENGTH,
  validateExtractionText,
} = require('../backend/utils/extractValidation.js');

test('validateExtractionText accepts a normal-sized prompt', () => {
  const result = validateExtractionText('Submit math homework by tomorrow.');

  assert.equal(result.ok, true);
  assert.equal(result.text, 'Submit math homework by tomorrow.');
});

test('validateExtractionText rejects oversized input with a helpful error', () => {
  const longText = 'a'.repeat(MAX_EXTRACTION_TEXT_LENGTH + 1);
  const result = validateExtractionText(longText);

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 413);
  assert.match(result.error, /maximum allowed length/i);
});
