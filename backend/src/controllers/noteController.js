const { query, getClient } = require('../config/database');
const { ROLES, INTERNAL_ROLES } = require('../config/constants');

// Check account access
async function canAccessAccount(accountId, user) {
  let sql, params;
  if (user.role === ROLES.CHANNEL_PARTNER) {
    sql = 'SELECT id, owner_id FROM accounts WHERE id = $1 AND partner_id = $2';
    params = [accountId, user.id];
  } else if (user.role === ROLES.CUSTOMER_ONBOARDING_SPECIALIST) {
    sql = 'SELECT id, owner_id, partner_id FROM accounts WHERE id = $1 AND owner_id = $2';
    params = [accountId, user.id];
  } else {
    sql = 'SELECT id, owner_id, partner_id FROM accounts WHERE id = $1';
    params = [accountId];
  }
  const result = await query(sql, params);
  return result.rows[0] || null;
}

async function createNotification(client, userId, title, message, type, referenceId) {
  await client.query(
    `INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type)
     VALUES ($1, $2, $3, $4, $5, 'account')`,
    [userId, title, message, type, referenceId]
  );
}

async function getNotes(req, res, next) {
  try {
    const { accountId } = req.params;
    const account = await canAccessAccount(accountId, req.user);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const result = await query(
      `SELECT n.id, n.author_id, n.content, n.created_at,
              u.name AS author_name, u.role AS author_role
       FROM notes n
       JOIN users u ON u.id = n.author_id
       WHERE n.account_id = $1
       ORDER BY n.created_at ASC`,
      [accountId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createNote(req, res, next) {
  const client = await getClient();
  try {
    const { accountId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const account = await canAccessAccount(accountId, req.user);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO notes (account_id, author_id, content) VALUES ($1, $2, $3)
       RETURNING id, content, created_at`,
      [accountId, req.user.id, content.trim()]
    );

    const note = result.rows[0];

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (account_id, user_id, action, new_values)
       VALUES ($1, $2, 'note_added', $3)`,
      [accountId, req.user.id, JSON.stringify({ note_id: note.id, content: note.content })]
    );

    // Notify both sides on every note — partner always notifies COS and vice versa
    const accountRow = await client.query(
      `SELECT a.partner_id, a.owner_id, a.company_name
       FROM accounts a WHERE a.id = $1`,
      [accountId]
    );
    const acc = accountRow.rows[0];
    const preview = `"${content.trim().substring(0, 80)}${content.trim().length > 80 ? '…' : ''}"`;
    const msgTitle = `New note on ${acc.company_name}`;
    const msgBody  = `${req.user.company_name || req.user.name}: ${preview}`;

    if (req.user.role === ROLES.CHANNEL_PARTNER) {
      // Partner posted → notify assigned COS
      if (acc.owner_id) {
        await createNotification(client, acc.owner_id, msgTitle, msgBody, 'note', accountId);
      }
    } else {
      // Internal posted → notify partner
      if (acc.partner_id) {
        await createNotification(client, acc.partner_id, msgTitle, msgBody, 'note', accountId);
      }
      // Also notify COS if a different internal user posted
      if (acc.owner_id && acc.owner_id !== req.user.id) {
        await createNotification(client, acc.owner_id, msgTitle, msgBody, 'note', accountId);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      data: { ...note, author_name: req.user.name, author_role: req.user.role }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function getAuditLog(req, res, next) {
  try {
    const { accountId } = req.params;
    const account = await canAccessAccount(accountId, req.user);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const result = await query(
      `SELECT al.id, al.action, al.old_values, al.new_values, al.created_at,
              u.name AS user_name, u.role AS user_role
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.account_id = $1
       ORDER BY al.created_at DESC`,
      [accountId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { getNotes, createNote, getAuditLog };
