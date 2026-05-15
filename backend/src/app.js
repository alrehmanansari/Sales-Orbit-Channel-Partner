require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const routes = require('./routes/index');
const { testConnection, runMigrations } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3002;

// Helmet — CSP disabled (frontend uses inline scripts + onclick handlers throughout)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — allow all origins (all API endpoints require JWT auth anyway)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files
const frontendDir = path.join(__dirname, '../../frontend');
app.use(express.static(frontendDir));

// Fallback — serve index.html for non-API routes
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

async function start() {
  await testConnection();
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`Sales Orbit API running on port ${PORT}`);
  });
}

start();

module.exports = app;
