const { v4: uuidv4 } = require('uuid');

const rooms = {};

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join room
    socket.on('join_room', ({ roomId, username }) => {
      if (!roomId) return;
      
      // Create room if it doesn't exist
      if (!rooms[roomId]) {
        rooms[roomId] = {
          host: socket.id,
          participants: [],
          timer: {
            duration: 25 * 60,
            remaining: 25 * 60,
            isRunning: false,
            interval: null
          },
          goal: 'Stay focused!'
        };
      }

      const room = rooms[roomId];
      
      const user = { id: socket.id, username: username || `User ${Math.floor(Math.random() * 1000)}` };
      room.participants.push(user);
      
      socket.join(roomId);
      
      // Send current state to the joined user
      socket.emit('room_state', {
        roomId,
        host: room.host,
        participants: room.participants,
        timer: {
          duration: room.timer.duration,
          remaining: room.timer.remaining,
          isRunning: room.timer.isRunning
        },
        goal: room.goal,
        myId: socket.id
      });

      // Broadcast to others
      socket.to(roomId).emit('participant_update', room.participants);
    });

    // Handle goal update
    socket.on('update_goal', ({ roomId, goal }) => {
      if (rooms[roomId]) {
        rooms[roomId].goal = goal;
        io.to(roomId).emit('goal_updated', goal);
      }
    });

    // Timer controls
    socket.on('start_timer', ({ roomId }) => {
      const room = rooms[roomId];
      if (room && room.host === socket.id && !room.timer.isRunning) {
        room.timer.isRunning = true;
        
        io.to(roomId).emit('timer_started', { remaining: room.timer.remaining });

        room.timer.interval = setInterval(() => {
          room.timer.remaining--;
          
          // Broadcast sync every second (or we could just rely on clients counting down, but server is authoritative)
          io.to(roomId).emit('timer_tick', { remaining: room.timer.remaining });

          if (room.timer.remaining <= 0) {
            clearInterval(room.timer.interval);
            room.timer.isRunning = false;
            room.timer.remaining = 0;
            io.to(roomId).emit('timer_ended');
          }
        }, 1000);
      }
    });

    socket.on('pause_timer', ({ roomId }) => {
      const room = rooms[roomId];
      if (room && room.host === socket.id && room.timer.isRunning) {
        clearInterval(room.timer.interval);
        room.timer.isRunning = false;
        io.to(roomId).emit('timer_paused', { remaining: room.timer.remaining });
      }
    });

    socket.on('reset_timer', ({ roomId, durationInMinutes }) => {
      const room = rooms[roomId];
      if (room && room.host === socket.id) {
        clearInterval(room.timer.interval);
        const secs = (durationInMinutes || 25) * 60;
        room.timer.duration = secs;
        room.timer.remaining = secs;
        room.timer.isRunning = false;
        io.to(roomId).emit('timer_reset', { duration: secs, remaining: secs });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      for (const roomId in rooms) {
        const room = rooms[roomId];
        const participantIndex = room.participants.findIndex(p => p.id === socket.id);
        
        if (participantIndex !== -1) {
          room.participants.splice(participantIndex, 1);
          
          if (room.participants.length === 0) {
            if (room.timer.interval) clearInterval(room.timer.interval);
            delete rooms[roomId];
          } else {
            if (room.host === socket.id) {
              room.host = room.participants[0].id;
              io.to(roomId).emit('host_changed', room.host);
            }
            io.to(roomId).emit('participant_update', room.participants);
          }
          break;
        }
      }
    });
  });
};
