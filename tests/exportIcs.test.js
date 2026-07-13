const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTasksCsv,
  buildCalendarIcs,
  escapeCsvValue,
  formatIcsDate,
  escapeIcsText,
} = require('../backend/controllers/csvDownload.controller.js');

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

test('escapeCsvValue quotes fields, escapes quotes, and blocks formula injection', () => {
  assert.equal(escapeCsvValue('Simple value'), '"Simple value"');
  assert.equal(escapeCsvValue('A "quoted" note'), '"A ""quoted"" note"');
  assert.equal(escapeCsvValue('=HYPERLINK("http://evil.example")'), '"\'=HYPERLINK(""http://evil.example"")"');
});

test('buildTasksCsv exports all columns safely', () => {
  const output = buildTasksCsv([
    {
      id: 'task_42',
      subject_name: 'Math, "Advanced"',
      title: '=SUM(1,2)',
      due_at: '2026-05-15T09:00:00.000Z',
      status: 'Not Started',
      priority: 'high',
      confidence_score: 91.5,
      notes: 'Line 1\nLine 2',
    },
  ]);

  assert.match(output, /^"Task ID","Subject","Title","Due At","Status","Priority","Confidence Score","Notes"/);
  assert.match(output, /"task_42","Math, ""Advanced""","'\=SUM\(1,2\)","2026-05-15T09:00:00.000Z","Not Started","high","91.5","Line 1\nLine 2"/);
  assert.doesNotMatch(output, /(^|,)=SUM\(1,2\)/);
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

test('buildCalendarIcs skips tasks with invalid due dates', () => {
  const output = buildCalendarIcs([
    {
      id: 'task_invalid_date',
      title: 'Task with bad date',
      due_at: 'invalid-date',
      notes: '',
      status: 'Not Started',
      priority: 'medium',
      subject_name: 'General',
    },
  ]);

  assert.doesNotMatch(output, /BEGIN:VEVENT/);
});
