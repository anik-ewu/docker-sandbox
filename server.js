// ============================================
// Task Manager API - server.js
// ============================================
// This is a simple Express + MongoDB CRUD API.
// Right now, it requires:
//   1. Node.js installed on your machine
//   2. MongoDB installed and running on your machine
//   3. npm install to get dependencies
//
// Later, we'll Dockerize this so NONE of the above
// is needed — just Docker!
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve our UI

// ---- MongoDB Connection ----
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB at:', MONGODB_URI))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('💡 Make sure MongoDB is running! Try: brew services start mongodb-community');
    process.exit(1);
  });

// ---- Task Schema & Model ----
const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Task = mongoose.model('Task', taskSchema);

// ============================================
// API Routes
// ============================================

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'task-manager',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// GET /tasks - List all tasks
app.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tasks - Create a new task
app.post('/tasks', async (req, res) => {
  try {
    const task = new Task({ title: req.body.title });
    const saved = await task.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /tasks/:id - Update a task (toggle complete / edit title)
app.put('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /tasks/:id - Delete a task
app.delete('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted', task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Start Server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Task Manager API running at http://localhost:${PORT}`);
  console.log(`📋 UI available at http://localhost:${PORT}`);
  console.log(`❤️  Health check at http://localhost:${PORT}/health`);
});
