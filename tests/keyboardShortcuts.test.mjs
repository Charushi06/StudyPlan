import test from 'node:test';
import assert from 'node:assert/strict';

const { normalizeKey, mapKeyToAction } = await import('../js/utils/keyboardShortcuts.js');

// --- normalizeKey -------------------------------------------------------
test('normalizeKey lowercases single chars', () => {
  assert.equal(normalizeKey({ key: 'P' }), 'p');
  assert.equal(normalizeKey({ key: 'A', ctrlKey: false, metaKey: false }), 'a');
});

test('normalizeKey keeps named keys lowercased', () => {
  assert.equal(normalizeKey({ key: 'Escape' }), 'escape');
  assert.equal(normalizeKey({ key: 'ArrowDown' }), 'arrowdown');
  assert.equal(normalizeKey({ key: 'Delete' }), 'delete');
  assert.equal(normalizeKey({ key: 'Enter' }), 'enter');
});

test('normalizeKey prefixes modifier combos with ctrl+', () => {
  assert.equal(normalizeKey({ key: 'Enter', ctrlKey: true }), 'ctrl+enter');
  assert.equal(normalizeKey({ key: 'Enter', metaKey: true }), 'ctrl+enter');
  assert.equal(normalizeKey({ key: '?', shiftKey: true }), '?');
});

// --- mapKeyToAction: global shortcuts -----------------------------------
test('global view shortcuts fire in every view', () => {
  assert.equal(mapKeyToAction('p', 'calendar'), 'go-calendar');
  assert.equal(mapKeyToAction('c', 'all-tasks'), 'go-all-tasks');
  assert.equal(mapKeyToAction('f', 'archived'), 'go-focus');
  assert.equal(mapKeyToAction('n', 'focus'), 'new-task');
  assert.equal(mapKeyToAction('?', 'review'), 'toggle-help');
  assert.equal(mapKeyToAction('escape', 'calendar'), 'escape');
});

// --- mapKeyToAction: list views -----------------------------------------
for (const view of ['calendar', 'all-tasks', 'archived']) {
  test(`list actions are bound in ${view}`, () => {
    assert.equal(mapKeyToAction('arrowdown', view), 'focus-next');
    assert.equal(mapKeyToAction('arrowup', view), 'focus-prev');
    assert.equal(mapKeyToAction('enter', view), 'open-task');
    assert.equal(mapKeyToAction(' ', view), 'open-task');
    assert.equal(mapKeyToAction('ctrl+enter', view), 'complete-task');
    assert.equal(mapKeyToAction('delete', view), 'delete-task');
  });
}

test('archive vs restore depends on view', () => {
  assert.equal(mapKeyToAction('a', 'all-tasks'), 'archive-task');
  assert.equal(mapKeyToAction('a', 'archived'), 'restore-task');
  assert.equal(mapKeyToAction('a', 'calendar'), 'archive-task');
});

// --- mapKeyToAction: focus view -----------------------------------------
test('focus view binds timer toggle and nav', () => {
  assert.equal(mapKeyToAction(' ', 'focus'), 'toggle-timer');
  assert.equal(mapKeyToAction('arrowdown', 'focus'), 'focus-next');
  assert.equal(mapKeyToAction('arrowup', 'focus'), 'focus-prev');
  // 'a' is unbound in focus (no task list to archive/restore).
  assert.equal(mapKeyToAction('a', 'focus'), null);
  // Global nav shortcuts still apply inside focus view.
  assert.equal(mapKeyToAction('n', 'focus'), 'new-task');
  assert.equal(mapKeyToAction('f', 'focus'), 'go-focus');
});

// --- return null for unbound --------------------------------------------
test('unbound keys return null', () => {
  assert.equal(mapKeyToAction('z', 'calendar'), null);
  assert.equal(mapKeyToAction('q', 'focus'), null);
});
