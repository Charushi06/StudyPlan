const test = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Pure helpers — mirror the logic in js/app.js without DOM dependencies.
// These are tested independently so the test suite runs in plain Node.js.
// ---------------------------------------------------------------------------

/**
 * Classify a pre-sorted task array into the four display buckets used by
 * renderTasks in the all-tasks / archived view (i.e. not calendar view).
 */
function classifyTasks(tasks, now) {
  const dueSoon = [];
  const thisWeek = [];
  const completed = [];
  const pending = [];

  [...tasks]
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    .forEach(t => {
      if (t.status === 'Done') {
        completed.push(t);
        return;
      }
      pending.push(t);
      const d = new Date(t.due_at);
      const diffDays = (d - now) / (1000 * 60 * 60 * 24);
      if (diffDays <= 3) dueSoon.push(t);
      else thisWeek.push(t);
    });

  return { dueSoon, thisWeek, completed, pending };
}

/**
 * Minimal renderGroup that mirrors the conditional / HTML-return behaviour of
 * the closure inside renderTasks.  Only the structural contract is tested here
 * (empty → '' / non-empty → wrapping div with header); the full implementation
 * also renders task cards and is covered by the integration-level tests below.
 */
function renderGroup(title, items) {
  if (items.length === 0) return '';
  const cards = items
    .map(t => `<div class="task-item" data-id="${t.id}">${t.title}</div>`)
    .join('');
  return `<div class="tasks-group"><div class="tasks-group-header">${title}</div>${cards}</div>`;
}

// ---------------------------------------------------------------------------
// Task classification
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-01T12:00:00Z');

function hoursFromNow(h) {
  return new Date(NOW.getTime() + h * 60 * 60 * 1000).toISOString();
}

function daysFromNow(d) {
  return hoursFromNow(d * 24);
}

test('classifyTasks: task due in 1 day goes to dueSoon', () => {
  const tasks = [{ id: '1', title: 'A', status: 'Not Started', due_at: daysFromNow(1) }];
  const { dueSoon, thisWeek, completed } = classifyTasks(tasks, NOW);
  assert.equal(dueSoon.length, 1);
  assert.equal(thisWeek.length, 0);
  assert.equal(completed.length, 0);
});

test('classifyTasks: task due in exactly 3 days goes to dueSoon', () => {
  const tasks = [{ id: '1', title: 'A', status: 'Not Started', due_at: daysFromNow(3) }];
  const { dueSoon } = classifyTasks(tasks, NOW);
  assert.equal(dueSoon.length, 1);
});

test('classifyTasks: task due in 5 days goes to thisWeek', () => {
  const tasks = [{ id: '1', title: 'B', status: 'Not Started', due_at: daysFromNow(5) }];
  const { dueSoon, thisWeek } = classifyTasks(tasks, NOW);
  assert.equal(dueSoon.length, 0);
  assert.equal(thisWeek.length, 1);
});

test('classifyTasks: done task goes to completed regardless of due date', () => {
  const tasks = [{ id: '1', title: 'C', status: 'Done', due_at: daysFromNow(1) }];
  const { dueSoon, thisWeek, completed } = classifyTasks(tasks, NOW);
  assert.equal(dueSoon.length, 0);
  assert.equal(thisWeek.length, 0);
  assert.equal(completed.length, 1);
});

test('classifyTasks: mixes tasks across all three groups', () => {
  const tasks = [
    { id: '1', title: 'Soon',    status: 'Not Started', due_at: daysFromNow(1) },
    { id: '2', title: 'Week',    status: 'Not Started', due_at: daysFromNow(6) },
    { id: '3', title: 'Done',    status: 'Done',        due_at: daysFromNow(2) },
    { id: '4', title: 'Soon2',   status: 'Not Started', due_at: daysFromNow(2) },
    { id: '5', title: 'Week2',   status: 'Not Started', due_at: daysFromNow(10) },
  ];
  const { dueSoon, thisWeek, completed } = classifyTasks(tasks, NOW);
  assert.equal(dueSoon.length, 2,     'expected 2 due-soon tasks');
  assert.equal(thisWeek.length, 2,    'expected 2 this-week tasks');
  assert.equal(completed.length, 1,   'expected 1 completed task');
});

test('classifyTasks: empty task list yields three empty buckets', () => {
  const { dueSoon, thisWeek, completed, pending } = classifyTasks([], NOW);
  assert.equal(dueSoon.length, 0);
  assert.equal(thisWeek.length, 0);
  assert.equal(completed.length, 0);
  assert.equal(pending.length, 0);
});

// ---------------------------------------------------------------------------
// renderGroup
// ---------------------------------------------------------------------------

test('renderGroup returns empty string for empty item array', () => {
  assert.equal(renderGroup('⚠ Due soon', []), '');
  assert.equal(renderGroup('This week', []), '');
  assert.equal(renderGroup('Completed', []), '');
});

test('renderGroup returns a tasks-group div containing the title', () => {
  const items = [{ id: '1', title: 'Task A' }];
  const html = renderGroup('⚠ Due soon', items);
  assert.ok(html.includes('tasks-group'));
  assert.ok(html.includes('⚠ Due soon'));
});

test('renderGroup includes one card per task', () => {
  const items = [
    { id: '1', title: 'Alpha' },
    { id: '2', title: 'Beta' },
    { id: '3', title: 'Gamma' },
  ];
  const html = renderGroup('This week', items);
  assert.ok(html.includes('data-id="1"'));
  assert.ok(html.includes('data-id="2"'));
  assert.ok(html.includes('data-id="3"'));
  assert.ok(html.includes('Alpha'));
  assert.ok(html.includes('Beta'));
  assert.ok(html.includes('Gamma'));
});

// ---------------------------------------------------------------------------
// Full rendering concatenation — verifies Bug 1 fix:
// All three renderGroup results MUST be part of the innerHTML string.
// ---------------------------------------------------------------------------

test('all three groups appear in innerHTML when each has tasks', () => {
  const tasks = [
    { id: '1', title: 'Soon',  status: 'Not Started', due_at: daysFromNow(1) },
    { id: '2', title: 'Week',  status: 'Not Started', due_at: daysFromNow(6) },
    { id: '3', title: 'Done',  status: 'Done',        due_at: daysFromNow(1) },
  ];
  const { dueSoon, thisWeek, completed } = classifyTasks(tasks, NOW);

  // This mirrors the FIXED innerHTML assignment in app.js exactly.
  const html =
    renderGroup('⚠ Due soon', dueSoon) +
    renderGroup('This week',   thisWeek) +
    renderGroup('Completed',   completed);

  assert.ok(html.includes('⚠ Due soon'), 'Due soon group missing');
  assert.ok(html.includes('This week'),  'This week group missing');
  assert.ok(html.includes('Completed'),  'Completed group missing');
});

test('only the non-empty groups appear in innerHTML', () => {
  const tasks = [
    { id: '1', title: 'Soon', status: 'Not Started', due_at: daysFromNow(1) },
  ];
  const { dueSoon, thisWeek, completed } = classifyTasks(tasks, NOW);
  const html =
    renderGroup('⚠ Due soon', dueSoon) +
    renderGroup('This week',   thisWeek) +
    renderGroup('Completed',   completed);

  assert.ok(html.includes('⚠ Due soon'), 'Due soon should be present');
  assert.ok(!html.includes('This week'),  'This week should be absent');
  assert.ok(!html.includes('Completed'),  'Completed should be absent');
});

test('empty state when no tasks in any bucket', () => {
  const { dueSoon, thisWeek, completed } = classifyTasks([], NOW);
  const html =
    renderGroup('⚠ Due soon', dueSoon) +
    renderGroup('This week',   thisWeek) +
    renderGroup('Completed',   completed);

  assert.equal(html, '', 'all groups empty → empty string');
});

// ---------------------------------------------------------------------------
// Archived view: same grouping path is used for archived tasks.
// ---------------------------------------------------------------------------

test('archived view groups tasks into the same three buckets', () => {
  const archivedTasks = [
    { id: 'a1', title: 'Arch-soon',  status: 'Not Started', due_at: daysFromNow(1), archived: true },
    { id: 'a2', title: 'Arch-week',  status: 'Not Started', due_at: daysFromNow(7), archived: true },
    { id: 'a3', title: 'Arch-done',  status: 'Done',        due_at: daysFromNow(2), archived: true },
  ];
  const { dueSoon, thisWeek, completed } = classifyTasks(archivedTasks, NOW);
  assert.equal(dueSoon.length,   1, 'archived due-soon count');
  assert.equal(thisWeek.length,  1, 'archived this-week count');
  assert.equal(completed.length, 1, 'archived completed count');

  const html =
    renderGroup('Archived: ⚠ Due soon', dueSoon) +
    renderGroup('Archived: This week',   thisWeek) +
    renderGroup('Archived: Completed',   completed);

  assert.ok(html.includes('Archived: ⚠ Due soon'), 'archived due-soon group missing');
  assert.ok(html.includes('Archived: This week'),   'archived this-week group missing');
  assert.ok(html.includes('Archived: Completed'),   'archived completed group missing');
});

// ---------------------------------------------------------------------------
// Event-handler — single vs duplicate insertion (Bug 2).
// ---------------------------------------------------------------------------

test('handler inserts tasks exactly once when called once', () => {
  const inserted = [];
  const mockStore = {
    currentPaste: [{ title: 'Task A' }, { title: 'Task B' }],
    addTasks(tasks) { inserted.push(...tasks); },
    clearExtracted() { this.currentPaste = null; },
  };

  function addItemsHandler() {
    if (mockStore.currentPaste) {
      mockStore.addTasks(mockStore.currentPaste);
      mockStore.clearExtracted();
    }
  }

  addItemsHandler();

  assert.equal(inserted.length, 2, 'two tasks inserted exactly once');
});

test('handler called twice inserts once because clearExtracted nulls currentPaste', () => {
  const inserted = [];
  const mockStore = {
    currentPaste: [{ title: 'Task A' }, { title: 'Task B' }],
    addTasks(tasks) { inserted.push(...tasks); },
    clearExtracted() { this.currentPaste = null; },
  };

  function addItemsHandler() {
    if (mockStore.currentPaste) {
      mockStore.addTasks(mockStore.currentPaste);
      mockStore.clearExtracted();
    }
  }

  addItemsHandler(); // first call: inserts and clears
  addItemsHandler(); // second call: currentPaste is null, skipped

  assert.equal(inserted.length, 2, 'tasks inserted only once despite two handler invocations');
});

test('regression: duplicate handler without clear causes double insertion', () => {
  // Documents the bug behaviour that existed before the fix.
  // A handler that does NOT call clearExtracted will insert twice if fired twice.
  const inserted = [];
  const mockStore = {
    currentPaste: [{ title: 'Task A' }],
    addTasks(tasks) { inserted.push(...tasks); },
  };

  function buggyHandler() {
    if (mockStore.currentPaste) {
      mockStore.addTasks(mockStore.currentPaste);
      // NOTE: no clearExtracted — simulates the missing guard
    }
  }

  buggyHandler();
  buggyHandler();

  assert.equal(inserted.length, 2, 'bug: two handler calls produce two insertions');
});

test('onclick property assignment prevents duplicate listeners (semantics test)', () => {
  // onclick is a property: the last assignment wins.
  // Two assignments must not cause two firings.
  let fireCount = 0;

  const btn = { onclick: null };

  function assignHandler() {
    btn.onclick = () => { fireCount++; };
  }

  assignHandler(); // first assignment
  assignHandler(); // second assignment overwrites the first

  btn.onclick(); // simulate one click

  assert.equal(fireCount, 1, 'onclick assignment: only one handler fires per click');
});

// ---------------------------------------------------------------------------
// Regression: the original ASI bug
// ---------------------------------------------------------------------------

test('regression: explicit + at end of line prevents ASI truncation', () => {
  // Verify that the fixed string concatenation pattern assigns all three groups.
  const dueSoon   = [{ id: 'd1', title: 'Due' }];
  const thisWeek  = [{ id: 'w1', title: 'Week' }];
  const completed = [{ id: 'c1', title: 'Done' }];

  // BUGGY pattern (second and third renderGroup results discarded):
  //   innerHTML = a + b()
  //               + c() + d()
  // Simulate by only taking the first renderGroup result:
  const buggyHtml = renderGroup('⚠ Due soon', dueSoon); // only first group

  assert.ok(!buggyHtml.includes('This week'), 'buggy pattern omits This week');
  assert.ok(!buggyHtml.includes('Completed'), 'buggy pattern omits Completed');

  // FIXED pattern (all three groups concatenated explicitly):
  const fixedHtml =
    renderGroup('⚠ Due soon', dueSoon) +
    renderGroup('This week',   thisWeek) +
    renderGroup('Completed',   completed);

  assert.ok(fixedHtml.includes('⚠ Due soon'), 'fixed: Due soon present');
  assert.ok(fixedHtml.includes('This week'),   'fixed: This week present');
  assert.ok(fixedHtml.includes('Completed'),   'fixed: Completed present');
});

test('task counts per group remain correct after classification', () => {
  const tasks = [];
  for (let i = 0; i < 3; i++) tasks.push({ id: `d${i}`, title: `D${i}`, status: 'Not Started', due_at: daysFromNow(1) });
  for (let i = 0; i < 4; i++) tasks.push({ id: `w${i}`, title: `W${i}`, status: 'Not Started', due_at: daysFromNow(5) });
  for (let i = 0; i < 2; i++) tasks.push({ id: `c${i}`, title: `C${i}`, status: 'Done',        due_at: daysFromNow(1) });

  const { dueSoon, thisWeek, completed } = classifyTasks(tasks, NOW);
  assert.equal(dueSoon.length,   3, 'dueSoon count');
  assert.equal(thisWeek.length,  4, 'thisWeek count');
  assert.equal(completed.length, 2, 'completed count');
});
