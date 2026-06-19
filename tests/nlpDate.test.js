const test = require('node:test');
const assert = require('node:assert/strict');

test('isValidDate validation', async () => {
  const { isValidDate } = await import('../js/utils/nlpDateExtractor.js');
  assert.equal(isValidDate(2023, 1, 28), true); // Feb 28
  assert.equal(isValidDate(2023, 1, 29), false); // Feb 29 2023 (Not leap)
  assert.equal(isValidDate(2024, 1, 29), true); // Feb 29 2024 (Leap)
  assert.equal(isValidDate(2023, 3, 31), false); // Apr 31
});

test('Ambiguous Date Formats MM/DD/YYYY vs DD/MM/YYYY', async () => {
  const { extractDate } = await import('../js/utils/nlpDateExtractor.js');
  const now = new Date(2023, 0, 1);

  // Default MM/DD/YYYY
  const res1 = extractDate("The deadline is 03/04/2023", now);
  // Expect March 4, 2023
  assert.equal(new Date(res1).toISOString().startsWith('2023-03-04'), true);

  // Fallback to DD/MM/YYYY when XX > 12
  const res2 = extractDate("The deadline is 15/04/2023", now);
  // Expect April 15, 2023
  assert.equal(new Date(res2).toISOString().startsWith('2023-04-15'), true);
});

test('Natural Language Phrases', async () => {
  const { extractDate } = await import('../js/utils/nlpDateExtractor.js');
  const now = new Date(2023, 5, 10); // June 10, 2023

  // Mid-month
  const midJan = extractDate("Submit by mid-January", now);
  assert.equal(new Date(midJan).toISOString().startsWith('2024-01-15'), true); // Next year Jan

  const midJune = extractDate("Submit by mid-June", now);
  assert.equal(new Date(midJune).toISOString().startsWith('2023-06-15'), true);

  // Beginning of next month
  const beginningNext = extractDate("due beginning of next month", now);
  assert.equal(new Date(beginningNext).toISOString().startsWith('2023-07-01'), true);

  // First Monday of next month
  const firstMonNext = extractDate("due first Monday of next month", now);
  // Next month is July 2023. July 1, 2023 is Saturday (day 6).
  // First Monday should be July 3, 2023.
  assert.equal(new Date(firstMonNext).toISOString().startsWith('2023-07-03'), true);
});

test('Graceful fallback for invalid parsed calendar dates', async () => {
  const { extractDate } = await import('../js/utils/nlpDateExtractor.js');
  const now = new Date(2023, 0, 1);

  // February 30th is invalid, should return null (so fallback handles it in caller)
  const invalidDate = extractDate("due on Feb 30", now);
  assert.equal(invalidDate, null);
});
