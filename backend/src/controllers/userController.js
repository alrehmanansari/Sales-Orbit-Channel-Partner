const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { ROLES, INTERNAL_ROLES } = require('../config/constants');

async function listUsers(req, res, next) {
  try {
    const { role, is_active } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (role)      { conditions.push(`u.role = $${idx++}`);      params.push(role); }
    if (is_active !== undefined) { conditions.push(`u.is_active = $${idx++}`); params.push(is_active === 'true'); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.designation, u.company_name, u.phone,
              u.is_active, u.created_at,
              COUNT(a.id) AS account_count
       FROM users u
       LEFT JOIN accounts a ON (
         CASE WHEN u.role = 'channel_partner' THEN a.partner_id = u.id
              WHEN u.role = 'customer_onboarding_specialist' THEN a.owner_id = u.id
              ELSE FALSE END
       )
       ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const result = await query(
      'SELECT id, name, email, role, designation, company_name, phone, is_active, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { name, email, password, role, designation, company_name, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required' });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, designation, company_name, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, name, email, role, designation, company_name, is_active, created_at`,
      [name, email.toLowerCase(), hash, role, designation || null, company_name || null, phone || null]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, role, designation, company_name, phone, is_active, password } = req.body;

    const updates = {};
    if (name        !== undefined) updates.name         = name;
    if (email       !== undefined) updates.email        = email.toLowerCase();
    if (role        !== undefined) updates.role         = role;
    if (designation !== undefined) updates.designation  = designation;
    if (company_name!== undefined) updates.company_name = company_name;
    if (phone       !== undefined) updates.phone        = phone;
    if (is_active   !== undefined) updates.is_active    = is_active;

    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const result = await query(
      `UPDATE users SET ${setClauses} WHERE id = $1
       RETURNING id, name, email, role, designation, company_name, phone, is_active`,
      [id, ...Object.values(updates)]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listPartners(req, res, next) {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.company_name,
              COUNT(a.id) AS account_count
       FROM users u
       LEFT JOIN accounts a ON a.partner_id = u.id
       WHERE u.role = 'channel_partner' AND u.is_active = TRUE
       GROUP BY u.id ORDER BY u.name`,
      []
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

// Returns all active signed-up Onboarding Specialists (excluding seed accounts)
async function listSpecialists(req, res, next) {
  try {
    const result = await query(
      `SELECT id, name, email, role, designation
       FROM users
       WHERE role = 'customer_onboarding_specialist'
         AND is_active = TRUE
         AND email NOT LIKE '%@salesorbit.app'
       ORDER BY name`,
      []
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

// Returns only Onboarding Specialists for the partner's Add Account dropdown.
// Partnerships Manager excluded — they appear only in management views.
async function listSalesTeam(req, res, next) {
  try {
    const result = await query(
      `SELECT id, name, email, role, designation
       FROM users
       WHERE role = 'customer_onboarding_specialist'
         AND is_active = TRUE
         AND email NOT LIKE '%@salesorbit.app'
       ORDER BY name`,
      []
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, getUser, createUser, updateUser, listPartners, listSpecialists, listSalesTeam };
