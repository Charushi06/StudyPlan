const { google } = require('googleapis');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent'
  });
}

async function getTokensFromCode(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function getCalendarClient(tokens) {
  const client = getOAuthClient();
  client.setCredentials(tokens);
  return google.calendar({ version: 'v3', auth: client });
}

function taskToEvent(task) {
  const start = task.due_at ? new Date(task.due_at) : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    summary: task.title,
    description: task.notes || '',
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' },
    end:   { dateTime: end.toISOString(),   timeZone: 'Asia/Kolkata' },
    extendedProperties: { private: { taskId: task.id } }
  };
}

module.exports = { getAuthUrl, getTokensFromCode, getCalendarClient, taskToEvent };