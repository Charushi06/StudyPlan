const { db } = require('../../database.js');

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function createRoom(req, res) {
  const { name, created_by } = req.body;

  if (!name || !created_by) {
    return res.status(400).json({ message: 'Name and created_by are required' });
  }

  const roomId = generateId('room');
  const code = generateRoomCode();
  const room = { id: roomId, name, code, created_by };

  db.run(
    `INSERT INTO rooms (id, name, code, created_by) VALUES (?, ?, ?, ?)`,
    [room.id, room.name, room.code, room.created_by],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to create room' });
      }

      const memberId = generateId('member');
      db.run(
        `INSERT INTO room_members (id, room_id, member_name) VALUES (?, ?, ?)`,
        [memberId, room.id, created_by],
        function (memberErr) {
          if (memberErr) {
            console.error(memberErr);
            return res.status(500).json({ message: 'Failed to add room creator as member' });
          }

          return res.status(201).json(room);
        }
      );
    }
  );
}

function joinRoom(req, res) {
  const code = String(req.body.code || '').toUpperCase();
  const member_name = req.body.member_name;

  if (!code || !member_name) {
    return res.status(400).json({ message: 'Code and member_name are required' });
  }

  db.get(
    'SELECT * FROM rooms WHERE code = ?',
    [code],
    (err, room) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to find room' });
      }
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      db.get(
        'SELECT * FROM room_members WHERE room_id = ? AND member_name = ?',
        [room.id, member_name],
        (memberErr, member) => {
          if (memberErr) {
            console.error(memberErr);
            return res.status(500).json({ message: 'Failed to check room membership' });
          }

          if (member) {
            if (member.is_active === 1) {
              return res.json(room);
            }

            db.run(
              'UPDATE room_members SET is_active = 1 WHERE id = ?',
              [member.id],
              function (updateErr) {
                if (updateErr) {
                  console.error(updateErr);
                  return res.status(500).json({ message: 'Failed to reactivate room member' });
                }
                return res.json(room);
              }
            );
            return;
          }

          const memberId = generateId('member');
          db.run(
            'INSERT INTO room_members (id, room_id, member_name) VALUES (?, ?, ?)',
            [memberId, room.id, member_name],
            function (insertErr) {
              if (insertErr) {
                console.error(insertErr);
                return res.status(500).json({ message: 'Failed to join room' });
              }
              return res.json(room);
            }
          );
        }
      );
    }
  );
}

function getRoom(req, res) {
  const roomId = req.params.id;

  db.get('SELECT * FROM rooms WHERE id = ?', [roomId], (err, room) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to load room' });
    }
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    db.all(
      'SELECT member_name, joined_at, is_active FROM room_members WHERE room_id = ? ORDER BY joined_at ASC',
      [roomId],
      (membersErr, members) => {
        if (membersErr) {
          console.error(membersErr);
          return res.status(500).json({ message: 'Failed to load room members' });
        }
        return res.json({ ...room, members });
      }
    );
  });
}

function listRooms(req, res) {
  const query = `
    SELECT rooms.id,
           rooms.name,
           rooms.code,
           rooms.created_by,
           rooms.created_at,
           COUNT(room_members.id) AS member_count
    FROM rooms
    LEFT JOIN room_members
      ON room_members.room_id = rooms.id
      AND room_members.is_active = 1
    GROUP BY rooms.id
    ORDER BY rooms.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to list rooms' });
    }
    return res.json(rows);
  });
}

function leaveRoom(req, res) {
  const roomId = req.params.id;
  const member_name = req.body.member_name;

  if (!roomId || !member_name) {
    return res.status(400).json({ message: 'Room id and member_name are required' });
  }

  db.run(
    'UPDATE room_members SET is_active = 0 WHERE room_id = ? AND member_name = ?',
    [roomId, member_name],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to leave room' });
      }
      return res.json({ success: true, changes: this.changes });
    }
  );
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  listRooms,
  leaveRoom,
};
