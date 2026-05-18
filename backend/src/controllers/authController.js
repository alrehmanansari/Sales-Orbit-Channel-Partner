const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { ROLES } = require('../config/constants');
const { generateOTP, sendOTP } = require('../services/emailService');

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

async function _saveOTP(email, purpose) {
  const code = generateOTP();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  // Invalidate any prior unused codes for this email+purpose
  await query(
    `UPDATE email_otps SET used = TRUE WHERE email = $1 AND purpose = $2 AND used = FALSE`,
    [email.toLowerCase(), purpose]
  );
  await query(
    `INSERT INTO email_otps (email, code, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
    [email.toLowerCase(), code, purpose, expires]
  );
  return code;
}

async function _verifyOTP(email, code, purpose) {
  const result = await query(
    `SELECT id FROM email_otps
     WHERE email = $1 AND code = $2 AND purpose = $3
       AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email.toLowerCase(), code, purpose]
  );
  if (!result.rows.length) return false;
  await query(`UPDATE email_otps SET used = TRUE WHERE id = $1`, [result.rows[0].id]);
  return true;
}

// POST /api/auth/register
// Step 1: create account, send OTP
async function register(req, res, next) {
  try {
    const { name, email, password, company_name, phone, designation } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Map designation to the correct role — everything except Channel Partner is internal
    const DESIGNATION_ROLE_MAP = {
      'Channel Partner':                     ROLES.CHANNEL_PARTNER,
      'Onboarding Specialist':               ROLES.CUSTOMER_ONBOARDING_SPECIALIST,
      'Partnerships Manager':               ROLES.MANAGER_PARTNERSHIPS,
      // Legacy mappings — kept for existing users
      'Customer Onboarding Specialist':      ROLES.CUSTOMER_ONBOARDING_SPECIALIST,
      'Manager Partnerships':                ROLES.MANAGER_PARTNERSHIPS,
      'Head of Sales':                       ROLES.HEAD_OF_SALES,
      'Head of MENA':                        ROLES.HEAD_OF_MENA,
      'Senior Business Development Manager': ROLES.SENIOR_BDM,
      'Business Development Manager':        ROLES.SENIOR_BDM,
      'Sales Development Representative':    ROLES.SENIOR_BDM,
      'Country Head':                        ROLES.HEAD_OF_SALES,
    };
    const assignedRole = DESIGNATION_ROLE_MAP[designation] || ROLES.CUSTOMER_ONBOARDING_SPECIALIST;

    await query(
      `INSERT INTO users (name, email, password_hash, role, designation, company_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [name, email.toLowerCase(), hash, assignedRole, designation || null, company_name || null, phone || null]
    );

    const code = await _saveOTP(email, 'register');
    sendOTP(email, code, 'register').catch(err =>
      console.error('[email] register OTP send failed for', email, ':', err.message)
    );

    res.status(201).json({ status: 'otp_required', email: email.toLowerCase() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
// Step 1: verify password, send OTP
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      'SELECT id, name, email, password_hash, role, designation, company_name, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Please contact support.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const code = await _saveOTP(email, 'login');
    sendOTP(email, code, 'login').catch(err =>
      console.error('[email] login OTP send failed for', email, ':', err.message)
    );

    res.json({ status: 'otp_required', email: email.toLowerCase() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-otp
// Step 2: verify OTP, return JWT
async function verifyOTP(req, res, next) {
  try {
    const { email, code, purpose } = req.body;

    if (!email || !code || !purpose) {
      return res.status(400).json({ error: 'Email, code and purpose are required' });
    }

    const valid = await _verifyOTP(email, code, purpose);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid or expired code. Please try again.' });
    }

    const result = await query(
      'SELECT id, name, email, role, designation, company_name, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/resend-otp
async function resendOTP(req, res, next) {
  try {
    const { email, purpose } = req.body;
    if (!email || !purpose) {
      return res.status(400).json({ error: 'Email and purpose are required' });
    }

    const userCheck = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!userCheck.rows.length) {
      return res.status(404).json({ error: 'No account found for this email' });
    }

    const code = await _saveOTP(email, purpose);
    await sendOTP(email, code, purpose);

    res.json({ status: 'sent' });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  res.json({ user: req.user });
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both current and new password are required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, verifyOTP, resendOTP, getMe, changePassword };
