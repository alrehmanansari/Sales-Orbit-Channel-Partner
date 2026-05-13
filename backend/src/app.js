require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const routes = require('./routes/index');
const { testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static frontend (served from the same origin as the API)
const frontendDir = path.join(__dirname, '../../frontend');
app.use(express.static(frontendDir));

// 404 handler — only for unknown /api/* and other non-static paths
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.status(404).sendFile(path.join(frontendDir, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`Sales Orbit API running on port ${PORT}`);
  });
}

start();

module.exports = app;
