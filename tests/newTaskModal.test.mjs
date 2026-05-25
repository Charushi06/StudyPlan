import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPostSaveCalendarState,
  buildDefaultNewTaskDateValue,
  captureNewTaskFormState,
  isNewTaskFormDirty,
} from '../js/utils/newTaskModal.mjs';

test('buildDefaultNewTaskDateValue returns an empty value when no date is selected', () => {
  assert.equal(buildDefaultNewTaskDateValue(null), '');
});

test('buildDefaultNewTaskDateValue normalizes the selected day to 18:00 local time', () => {
  assert.equal(buildDefaultNewTaskDateValue('2026-05-24'), '2026-05-24T18:00');
});

test('captureNewTaskFormState trims user-entered text fields', () => {
  assert.deepEqual(
    captureNewTaskFormState({
      subjectId: 'sub_1',
      title: '  Review notes  ',
      notes: '  Bring textbook  ',
      dueAt: '2026-05-24T18:00',
    }),
    {
      subjectId: 'sub_1',
      title: 'Review notes',
      notes: 'Bring textbook',
      dueAt: '2026-05-24T18:00',
    }
  );
});

test('isNewTaskFormDirty returns false when the draft still matches its initial snapshot', () => {
  const initialState = captureNewTaskFormState({
    subjectId: 'sub_1',
    title: '',
    notes: '',
    dueAt: '2026-05-24T18:00',
  });

  const currentState = captureNewTaskFormState({
    subjectId: 'sub_1',
    title: '   ',
    notes: '',
    dueAt: '2026-05-24T18:00',
  });

  assert.equal(isNewTaskFormDirty(initialState, currentState), false);
});

test('isNewTaskFormDirty returns true when any draft field changes', () => {
  const initialState = captureNewTaskFormState({
    subjectId: 'sub_1',
    title: '',
    notes: '',
    dueAt: '2026-05-24T18:00',
  });

  const currentState = captureNewTaskFormState({
    subjectId: 'sub_2',
    title: 'Read chapter 4',
    notes: '',
    dueAt: '2026-05-24T18:00',
  });

  assert.equal(isNewTaskFormDirty(initialState, currentState), true);
});

test('buildPostSaveCalendarState keeps non-calendar views unchanged', () => {
  assert.equal(buildPostSaveCalendarState('all-tasks', '2026-06-10T09:30:00.000Z'), null);
});

test('buildPostSaveCalendarState focuses the saved task day in calendar view', () => {
  const result = buildPostSaveCalendarState('calendar', '2026-06-10T09:30:00.000Z');

  assert.ok(result);
  assert.equal(result.selectedDate.getFullYear(), 2026);
  assert.equal(result.selectedDate.getMonth(), 5);
  assert.equal(result.selectedDate.getDate(), 10);
  assert.equal(result.currentMonthDate.getFullYear(), 2026);
  assert.equal(result.currentMonthDate.getMonth(), 5);
  assert.equal(result.currentMonthDate.getDate(), 1);
});
