const sqlite3 = require('sqlite3');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'studyplan.db'));

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Tables in database:');
    rows.forEach(row => console.log(`  - ${row.name}`));
  }
  db.close();
});
