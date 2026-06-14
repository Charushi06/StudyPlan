const activeTimers = {}; // { roomId: { timeoutId, endAt, durationSeconds } }
const socketMemberMap = {}; // { socketId: { roomId, memberName } }

function safeParseTimer(timerStateText) {
  try {
    return typeof timerStateText === 'string' ? JSON.parse(timerStateText) : (timerStateText || {});
  } catch (e) {
    return {};
  }
}

function initRoomsSocket(io, db) {
  io.on('connection', (socket) => {
    socket.on('join_room', ({ roomId, memberName }) => {
      if (!roomId || !memberName) return;
      socket.join(roomId);
      socketMemberMap[socket.id] = { roomId, memberName };

      // Upsert room member: set active or insert
      db.get('SELECT * FROM room_members WHERE room_id = ? AND member_name = ?', [roomId, memberName], (err, row) => {
        if (err) return console.error(err);
        if (row) {
          db.run('UPDATE room_members SET is_active = 1 WHERE id = ?', [row.id], (uErr) => {
            if (uErr) console.error(uErr);
            // Broadcast updated members
            db.all('SELECT member_name, joined_at, is_active FROM room_members WHERE room_id = ? ORDER BY joined_at ASC', [roomId], (mErr, members) => {
              if (mErr) return console.error(mErr);
              io.to(roomId).emit('member_joined', { memberName, members });
            });
          });
        } else {
          const memberId = `member_${Date.now()}_${Math.floor(Math.random()*100000)}`;
          db.run('INSERT INTO room_members (id, room_id, member_name) VALUES (?, ?, ?)', [memberId, roomId, memberName], (iErr) => {
            if (iErr) return console.error(iErr);
            db.all('SELECT member_name, joined_at, is_active FROM room_members WHERE room_id = ? ORDER BY joined_at ASC', [roomId], (mErr, members) => {
              if (mErr) return console.error(mErr);
              io.to(roomId).emit('member_joined', { memberName, members });
            });
          });
        }
      });

      // Send current timer state from DB to newly joined socket
      db.get('SELECT timer_state FROM rooms WHERE id = ?', [roomId], (rErr, rRow) => {
        if (rErr) return console.error(rErr);
        const timerState = safeParseTimer(rRow && rRow.timer_state);
        socket.emit('timer_update', timerState);
      });
    });

    socket.on('leave_room', ({ roomId, memberName }) => {
      if (!roomId || !memberName) return;
      socket.leave(roomId);
      const mapping = socketMemberMap[socket.id];
      if (mapping) delete socketMemberMap[socket.id];

      db.run('UPDATE room_members SET is_active = 0 WHERE room_id = ? AND member_name = ?', [roomId, memberName], function (err) {
        if (err) return console.error(err);
        db.all('SELECT member_name, joined_at, is_active FROM room_members WHERE room_id = ? ORDER BY joined_at ASC', [roomId], (mErr, members) => {
          if (mErr) return console.error(mErr);
          io.to(roomId).emit('member_left', { memberName, members });
        });
      });
    });

    socket.on('timer_start', ({ roomId, duration }) => {
      if (!roomId || !duration) return;
      const startedAt = Date.now();
      const timerState = { status: 'running', duration: Number(duration), remaining: Number(duration), started_at: startedAt };
      db.run('UPDATE rooms SET timer_state = ? WHERE id = ?', [JSON.stringify(timerState), roomId], (err) => {
        if (err) return console.error(err);
        io.to(roomId).emit('timer_update', timerState);

        // clear existing timer
        if (activeTimers[roomId] && activeTimers[roomId].timeoutId) {
          clearTimeout(activeTimers[roomId].timeoutId);
        }
        const endAt = Date.now() + Number(duration) * 1000;
        const timeoutId = setTimeout(() => {
          // On completion, record sessions for active members
          db.all('SELECT member_name FROM room_members WHERE room_id = ? AND is_active = 1', [roomId], (mErr, members) => {
            if (mErr) return console.error(mErr);
            const durationMinutes = Math.max(1, Math.round(Number(duration) / 60));
            const stmt = db.prepare('INSERT INTO study_sessions (id, room_id, member_name, duration_minutes) VALUES (?, ?, ?, ?)');
            members.forEach((m) => {
              const sessionId = `sess_${Date.now()}_${Math.floor(Math.random()*100000)}`;
              stmt.run(sessionId, roomId, m.member_name, durationMinutes);
            });
            stmt.finalize(() => {
              io.to(roomId).emit('session_completed', { roomId, duration_minutes: durationMinutes });
            });
          });

          // reset timer state to idle
          const idleState = { status: 'idle', duration: Number(duration), remaining: 0, started_at: null };
          db.run('UPDATE rooms SET timer_state = ? WHERE id = ?', [JSON.stringify(idleState), roomId], (uErr) => {
            if (uErr) console.error(uErr);
            io.to(roomId).emit('timer_update', idleState);
          });

          delete activeTimers[roomId];
        }, Number(duration) * 1000);

        activeTimers[roomId] = { timeoutId, endAt, durationSeconds: Number(duration) };
      });
    });

    socket.on('timer_pause', ({ roomId }) => {
      if (!roomId) return;
      // compute remaining
      db.get('SELECT timer_state FROM rooms WHERE id = ?', [roomId], (err, row) => {
        if (err) return console.error(err);
        const ts = safeParseTimer(row && row.timer_state);
        if (!ts || ts.status !== 'running') return;
        const elapsed = Math.floor((Date.now() - (ts.started_at || 0)) / 1000);
        const remaining = Math.max(0, (ts.duration || 0) - elapsed);
        const newState = { status: 'paused', duration: ts.duration || 0, remaining, started_at: null };
        db.run('UPDATE rooms SET timer_state = ? WHERE id = ?', [JSON.stringify(newState), roomId], (uErr) => {
          if (uErr) return console.error(uErr);
          io.to(roomId).emit('timer_update', newState);
          // clear timeout
          if (activeTimers[roomId] && activeTimers[roomId].timeoutId) {
            clearTimeout(activeTimers[roomId].timeoutId);
            delete activeTimers[roomId];
          }
        });
      });
    });

    socket.on('timer_reset', ({ roomId, duration }) => {
      if (!roomId) return;
      const dur = Number(duration) || 1500;
      const newState = { status: 'idle', duration: dur, remaining: dur, started_at: null };
      db.run('UPDATE rooms SET timer_state = ? WHERE id = ?', [JSON.stringify(newState), roomId], (err) => {
        if (err) return console.error(err);
        io.to(roomId).emit('timer_update', newState);
        if (activeTimers[roomId] && activeTimers[roomId].timeoutId) {
          clearTimeout(activeTimers[roomId].timeoutId);
          delete activeTimers[roomId];
        }
      });
    });

    socket.on('disconnect', () => {
      const mapping = socketMemberMap[socket.id];
      if (mapping) {
        const { roomId, memberName } = mapping;
        db.run('UPDATE room_members SET is_active = 0 WHERE room_id = ? AND member_name = ?', [roomId, memberName], (err) => {
          if (err) return console.error(err);
          db.all('SELECT member_name, joined_at, is_active FROM room_members WHERE room_id = ? ORDER BY joined_at ASC', [roomId], (mErr, members) => {
            if (mErr) return console.error(mErr);
            io.to(roomId).emit('member_left', { memberName, members });
          });
        });
        delete socketMemberMap[socket.id];
      }
    });
  });
}

module.exports = initRoomsSocket;
