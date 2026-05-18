const { query, getClient } = require('../config/database');
const { ROLES, INTERNAL_ROLES, TICKET_STATUS } = require('../config/constants');
const ExcelJS = require('exceljs');

function ticketAccessClause(user) {
  if (user.role === ROLES.CHANNEL_PARTNER) {
    return { where: 't.partner_id = $1', params: [user.id] };
  }
  if (user.role === ROLES.CUSTOMER_ONBOARDING_SPECIALIST) {
    return { where: 't.specialist_id = $1', params: [user.id] };
  }
  return { where: '1=1', params: [] };
}

async function listTickets(req, res, next) {
  try {
    const { status, query_type, partner_id, specialist_id, account_id,
            page = 1, limit = 50 } = req.query;

    const access = ticketAccessClause(req.user);
    const conditions = [access.where];
    const params = [...access.params];
    let idx = params.length + 1;

    if (status)       { conditions.push(`t.status = $${idx++}`);        params.push(status); }
    if (query_type)   { conditions.push(`t.query_type = $${idx++}`);    params.push(query_type); }
    if (account_id)   { conditions.push(`t.account_id = $${idx++}`);    params.push(account_id); }
    if (INTERNAL_ROLES.includes(req.user.role)) {
      if (partner_id)    { conditions.push(`t.partner_id = $${idx++}`);    params.push(partner_id); }
      if (specialist_id) { conditions.push(`t.specialist_id = $${idx++}`); params.push(specialist_id); }
    }

    const whereClause = conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countResult, dataResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM tickets t WHERE ${whereClause}`, params),
      query(
        `SELECT t.id, t.ticket_number, t.query_type, t.expected_resolution, t.remarks,
                t.status, t.decline_reason, t.specialist_notes,
                t.created_at, t.updated_at, t.resolved_at,
                a.company_name AS account_name,
                p.name AS partner_name,
                s.name AS specialist_name,
                EXTRACT(DAY FROM (COALESCE(t.resolved_at, NOW()) - t.created_at)) AS days_to_resolve
         FROM tickets t
         JOIN accounts a ON a.id = t.account_id
         JOIN users p ON p.id = t.partner_id
         LEFT JOIN users s ON s.id = t.specialist_id
         WHERE ${whereClause}
         ORDER BY t.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, parseInt(limit), offset]
      )
    ]);

    res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    next(err);
  }
}

async function createTicket(req, res, next) {
  const client = await getClient();
  try {
    const { account_id, query_type, expected_resolution, remarks } = req.body;

    if (!account_id || !query_type) {
      return res.status(400).json({ error: 'account_id and query_type are required' });
    }

    // Verify partner owns this account
    const accResult = await client.query(
      `SELECT id, owner_id, company_name FROM accounts WHERE id = $1 AND partner_id = $2`,
      [account_id, req.user.id]
    );
    if (!accResult.rows.length) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const account = accResult.rows[0];

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO tickets (account_id, partner_id, specialist_id, query_type, expected_resolution, remarks)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [account_id, req.user.id, account.owner_id, query_type, expected_resolution || null, remarks || null]
    );

    const ticket = result.rows[0];

    // Notify assigned COS
    if (account.owner_id) {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type)
         VALUES ($1, $2, $3, 'ticket', $4, 'ticket')`,
        [
          account.owner_id,
          `New ticket on ${account.company_name}`,
          `${req.user.company_name || req.user.name} raised: "${query_type}" — ${expected_resolution || 'no deadline set'}`,
          ticket.id
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ data: ticket });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function getTicket(req, res, next) {
  try {
    const { id } = req.params;
    const access = ticketAccessClause(req.user);

    const result = await query(
      `SELECT t.*, a.company_name AS account_name,
              p.name AS partner_name, p.email AS partner_email,
              s.name AS specialist_name, s.email AS specialist_email,
              EXTRACT(DAY FROM (COALESCE(t.resolved_at, NOW()) - t.created_at)) AS days_to_resolve
       FROM tickets t
       JOIN accounts a ON a.id = t.account_id
       JOIN users p ON p.id = t.partner_id
       LEFT JOIN users s ON s.id = t.specialist_id
       WHERE t.id = $1 AND ${access.where.replace('$1', '$2')}`,
      [id, ...access.params]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateTicketStatus(req, res, next) {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { status, decline_reason, specialist_notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const ticketResult = await client.query(
      `SELECT t.*, a.company_name, a.partner_id
       FROM tickets t JOIN accounts a ON a.id = t.account_id
       WHERE t.id = $1 AND (t.specialist_id = $2 OR $3 = TRUE)`,
      [id, req.user.id, ['head_of_sales','head_of_mena','senior_bdm','manager_partnerships'].includes(req.user.role)]
    );

    if (!ticketResult.rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];

    await client.query('BEGIN');

    const resolvedAt = status === TICKET_STATUS.RESOLVED ? new Date() : ticket.resolved_at;

    const result = await client.query(
      `UPDATE tickets SET status = $1, decline_reason = $2, specialist_notes = $3, resolved_at = $4
       WHERE id = $5 RETURNING *`,
      [status, decline_reason || null, specialist_notes || null, resolvedAt, id]
    );

    // Notify partner
    await client.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type)
       VALUES ($1, $2, $3, 'ticket_update', $4, 'ticket')`,
      [
        ticket.partner_id,
        `Ticket #${ticket.ticket_number} updated`,
        `Status changed to "${status}" on ${ticket.company_name}${specialist_notes ? ': ' + specialist_notes.substring(0, 60) : ''}`,
        id
      ]
    );

    await client.query('COMMIT');
    res.json({ data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function exportTickets(req, res, next) {
  try {
    const access = ticketAccessClause(req.user);

    const result = await query(
      `SELECT t.ticket_number, t.query_type, t.expected_resolution, t.status,
              t.decline_reason, t.created_at, t.resolved_at,
              EXTRACT(DAY FROM (COALESCE(t.resolved_at, NOW()) - t.created_at)) AS days_to_resolve,
              a.company_name AS account_name,
              p.name AS partner_name,
              s.name AS specialist_name
       FROM tickets t
       JOIN accounts a ON a.id = t.account_id
       JOIN users p ON p.id = t.partner_id
       LEFT JOIN users s ON s.id = t.specialist_id
       WHERE ${access.where}
       ORDER BY t.created_at DESC`,
      access.params
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tickets');
    if (result.rows.length) {
      ws.columns = Object.keys(result.rows[0]).map(k => ({ header: k, key: k, width: 22 }));
      result.rows.forEach(r => ws.addRow(r));
    }

    res.setHeader('Content-Disposition', 'attachment; filename="tickets.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listTickets, createTicket, getTicket, updateTicketStatus, exportTickets };
