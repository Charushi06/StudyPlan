const express = require('express');
const {
  createRoom,
  joinRoom,
  getRoom,
  listRooms,
  leaveRoom,
} = require('../controllers/rooms.controller.js');

const router = express.Router();

router.get('/rooms', listRooms);
router.post('/rooms', createRoom);
router.post('/rooms/join', joinRoom);
router.get('/rooms/:id', getRoom);
router.post('/rooms/:id/leave', leaveRoom);

module.exports = router;
