const { db } = require('../../database.js');

function getAllTasksWithSubjects() {
  const query = `
    SELECT tasks.*, subjects.name AS subject_name
    FROM tasks
    LEFT JOIN subjects ON tasks.subject_id = subjects.id
  `;

  return new Promise((resolve, reject) => {
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function escapeIcsText(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsDate(dateInput) {
  const date = new Date(dateInput);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function buildCalendarIcs(tasks = []) {
  const dtstamp = formatIcsDate(new Date().toISOString());
  const events = tasks
    .filter(task => task.due_at)
    .map(task => {
      const start = new Date(task.due_at);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const description = [
        `Subject: ${task.subject_name || 'General'}`,
        `Status: ${task.status || 'Not Started'}`,
        `Priority: ${task.priority || 'medium'}`,
        `Notes: ${task.notes || 'None'}`,
      ].join('\n');

      return [
        'BEGIN:VEVENT',
        `UID:${escapeIcsText(task.id)}@studyplan`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${formatIcsDate(start.toISOString())}`,
        `DTEND:${formatIcsDate(end.toISOString())}`,
        `SUMMARY:${escapeIcsText(task.title || 'Untitled task')}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        'END:VEVENT',
      ].join('\r\n');
    });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyPlan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

async function downloadData(req, res) {
  try {
    const data = await getAllTasksWithSubjects();

    const rows = [
      ['Task ID', 'Subject', 'Title', 'Due At', 'Status', 'Priority', 'Confidence Score', 'Notes'],
      ...data.map(task => [
        task.id,
        task.subject_name,
        task.title,
        task.due_at,
        task.status,
        task.priority,
        task.confidence_score,
        `"${(task.notes || '').replace(/"/g, '""')}"`,
      ]),
    ];

    const csvString = rows.map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="study_data.csv"');
    return res.status(200).send(csvString);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to download data' });
  }
}

async function downloadCalendar(req, res) {
  try {
    const data = await getAllTasksWithSubjects();
    const icsString = buildCalendarIcs(data);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="studyplan_calendar.ics"');
    return res.status(200).send(icsString);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to export calendar' });
  }
}

module.exports = {
  downloadData,
  downloadCalendar,
  buildCalendarIcs,
  formatIcsDate,
  escapeIcsText,
};
