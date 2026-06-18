const { db } = require('../../database.js');

function getLeaderboard(req, res) {
  const query = `
    SELECT member_name, SUM(duration_minutes) AS total_minutes, COUNT(*) AS sessions_completed
    FROM study_sessions
    GROUP BY member_name
    ORDER BY total_minutes DESC
    LIMIT 10
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
    return res.json(rows);
  });
}

function getStreak(req, res) {
  const member_name = req.query.member_name;
  if (!member_name) return res.status(400).json({ message: 'member_name required' });

  db.all('SELECT DISTINCT DATE(completed_at) as day FROM study_sessions WHERE member_name = ? ORDER BY day DESC', [member_name], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to fetch streak' });
    }

    const days = rows.map(r => r.day);
    if (!days.length) return res.json({ member_name, current_streak: 0 });

    let streak = 0;
    const today = new Date();
    let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let i = 0; i < days.length; i++) {
      const d = new Date(days[i]);
      if (d.toDateString() === cursor.toDateString()) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (d < cursor) {
        // if there's a gap, stop
        break;
      } else {
        // future date or same, continue
        continue;
      }
    }

    return res.json({ member_name, current_streak: streak });
  });
}

module.exports = { getLeaderboard, getStreak };
