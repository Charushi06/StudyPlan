import test from 'node:test';
import assert from 'node:assert/strict';

import { joinMarkup } from '../js/utils/taskMarkup.mjs';

test('joinMarkup preserves each section in order', () => {
  assert.equal(
    joinMarkup('<div>actions</div>', '<div>due</div>', '<div>week</div>', '<div>done</div>'),
    '<div>actions</div><div>due</div><div>week</div><div>done</div>'
  );
});

test('joinMarkup skips empty markup fragments', () => {
  assert.equal(
    joinMarkup('<div>actions</div>', '', null, '<div>done</div>'),
    '<div>actions</div><div>done</div>'
  );
});
