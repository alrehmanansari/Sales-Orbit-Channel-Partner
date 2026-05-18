const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { INTERNAL_ROLES, MANAGEMENT_ROLES, ROLES } = require('../config/constants');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      'SELECT id, name, email, role, designation, company_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

function requireInternal(req, res, next) {
  if (!req.user || !INTERNAL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied: internal users only' });
  }
  next();
}

function requireManagement(req, res, next) {
  if (!req.user || !MANAGEMENT_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied: management only' });
  }
  next();
}

function requirePartner(req, res, next) {
  if (!req.user || req.user.role !== ROLES.CHANNEL_PARTNER) {
    return res.status(403).json({ error: 'Access denied: channel partners only' });
  }
  next();
}

module.exports = { authenticate, requireRole, requireInternal, requireManagement, requirePartner };
