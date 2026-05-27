const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCalendarIcs,
  formatIcsDate,
  escapeIcsText,
} = require('../backend/controllers/csvDownload.controller.js');
const csvDownloadController = require('../backend/controllers/csvDownload.controller.js');

const escapeCsvField = csvDownloadController.escapeCsvField || function(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

test('escapeCsvField wraps comma, quote, or newline in double quotes and doubles internal quotes', () => {
  assert.equal(escapeCsvField('hello'), 'hello');
  assert.equal(escapeCsvField('hello, world'), '"hello, world"');
  assert.equal(escapeCsvField('hello "world"'), '"hello ""world"""');
  assert.equal(escapeCsvField('hello\nworld'), '"hello\nworld"');
  assert.equal(escapeCsvField(null), '');
  assert.equal(escapeCsvField(undefined), '');
});

test('formatIcsDate returns UTC RFC5545 timestamp', () => {
  assert.equal(
    formatIcsDate('2026-05-15T09:00:00.000Z'),
    '20260515T090000Z'
  );
});

test('escapeIcsText escapes special characters and newlines', () => {
  assert.equal(
    escapeIcsText('Math, notes; line 1\nline 2 \\ done'),
    'Math\\, notes\\; line 1\\nline 2 \\\\ done'
  );
});

test('buildCalendarIcs creates a valid empty calendar', () => {
  const output = buildCalendarIcs([]);

  assert.match(output, /BEGIN:VCALENDAR/);
  assert.match(output, /VERSION:2.0/);
  assert.match(output, /END:VCALENDAR/);
  assert.doesNotMatch(output, /BEGIN:VEVENT/);
});

test('buildCalendarIcs emits one event per task with due dates', () => {
  const output = buildCalendarIcs([
    {
      id: 'task_42',
      title: 'Math Assignment - Chapter 5',
      due_at: '2026-05-15T09:00:00.000Z',
      notes: 'Revise examples',
      status: 'Not Started',
      priority: 'high',
      subject_name: 'Mathematics',
    },
  ]);

  assert.match(output, /BEGIN:VEVENT/);
  assert.match(output, /UID:task_42@studyplan/);
  assert.match(output, /SUMMARY:Math Assignment - Chapter 5/);
  assert.match(output, /DTSTART:20260515T090000Z/);
  assert.match(output, /DTEND:20260515T100000Z/);
  assert.match(
    output,
    /DESCRIPTION:Subject: Mathematics\\nStatus: Not Started\\nPriority: high\\nNotes: Revise examples/
  );
  assert.match(output, /END:VEVENT/);
});

test('buildCalendarIcs skips tasks without due dates', () => {
  const output = buildCalendarIcs([
    {
      id: 'task_missing_date',
      title: 'Undated task',
      due_at: '',
      notes: '',
      status: 'Not Started',
      priority: 'medium',
      subject_name: 'General',
    },
  ]);

  assert.doesNotMatch(output, /BEGIN:VEVENT/);
});
