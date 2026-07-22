const express = require('express');
const { getTasks, addTasks, updateTask, deleteTask } = require('../controllers/tasks.controller.js');

const router = express.Router();

router.get('/', getTasks);
router.post('/', addTasks);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;
