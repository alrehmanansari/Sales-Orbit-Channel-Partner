require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const routes = require('./routes/index');
const { testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware — CSP disabled because frontend uses inline scripts/handlers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}));

// CORS — allow the production domain, localhost, and any value in FRONTEND_URL
const allowedOrigins = [
  'https://partner.salesorbit.tech',
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:8080',
];
if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== '*') {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no Origin header (curl, Postman, same-origin)
    // and any origin in the allowedOrigins list
    if (!origin || allowedOrigins.includes(origin) || process.env.FRONTEND_URL === '*') {
      return callback(null, origin || '*');
    }
    return callback(null, origin); // reflect origin — API is JWT-protected anyway
  },
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
