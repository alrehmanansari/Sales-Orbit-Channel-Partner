const { query, getClient } = require('../config/database');
const { ROLES, INTERNAL_ROLES, MANAGEMENT_ROLES, ACCOUNT_STATUS } = require('../config/constants');
const ExcelJS = require('exceljs');
const fs = require('fs');

// Helper – build role-based WHERE clause
function accountAccessClause(user, alias = 'a') {
  if (user.role === ROLES.CHANNEL_PARTNER) {
    return { where: `${alias}.partner_id = $1`, params: [user.id] };
  }
  if (user.role === ROLES.CUSTOMER_ONBOARDING_SPECIALIST) {
    return { where: `${alias}.owner_id = $1`, params: [user.id] };
  }
  // Management roles see all
  return { where: '1=1', params: [] };
}

async function logAudit(client, accountId, userId, action, oldValues, newValues, ip) {
  await client.query(
    `INSERT INTO audit_logs (account_id, user_id, action, old_values, new_values, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [accountId, userId, action, JSON.stringify(oldValues), JSON.stringify(newValues), ip || null]
  );
}

async function listAccounts(req, res, next) {
  try {
    const { status, vertical, business_type, partner_id, owner_id, search,
            start_date, end_date, page = 1, limit = 50 } = req.query;

    const access = accountAccessClause(req.user);
    const conditions = [access.where];
    const params = [...access.params];
    let idx = params.length + 1;

    if (status)        { conditions.push(`a.status = $${idx++}`);             params.push(status); }
    if (vertical)      { conditions.push(`a.vertical = $${idx++}`);           params.push(vertical); }
    if (business_type) { conditions.push(`a.business_type = $${idx++}`);      params.push(business_type); }
    if (start_date)    { conditions.push(`a.registration_date >= $${idx++}`); params.push(start_date); }
    if (end_date)      { conditions.push(`a.registration_date <= $${idx++}`); params.push(end_date); }

    // Management-only filters
    if (MANAGEMENT_ROLES.includes(req.user.role)) {
      if (partner_id) { conditions.push(`a.partner_id = $${idx++}`); params.push(partner_id); }
      if (owner_id)   { conditions.push(`a.owner_id = $${idx++}`);   params.push(owner_id); }
    }

    if (search) {
      conditions.push(`(a.company_name ILIKE $${idx} OR a.contact_name ILIKE $${idx} OR a.contact_email ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }

    const whereClause = conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query(
      `SELECT COUNT(*) FROM accounts a WHERE ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT a.id, a.company_name, a.trading_name, a.business_type, a.vertical,
              a.contact_name, a.contact_email, a.contact_phone, a.country,
              a.status, a.registration_date, a.onboarded_at, a.activated_at,
              a.account_number,
              p.name AS partner_name, p.company_name AS partner_company,
              o.name AS owner_name,
              ${INTERNAL_ROLES.includes(req.user.role) ? 'a.kyc_agent,' : ''}
              (SELECT COUNT(*) FROM notes n WHERE n.account_id = a.id) AS notes_count,
              (SELECT COUNT(*) FROM tickets t WHERE t.account_id = a.id AND t.status NOT IN ('resolved','declined')) AS open_tickets
       FROM accounts a
       LEFT JOIN users p ON p.id = a.partner_id
       LEFT JOIN users o ON o.id = a.owner_id
       WHERE ${whereClause}
       ORDER BY a.registration_date DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    );

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

async function getAccount(req, res, next) {
  try {
    const { id } = req.params;
    const access = accountAccessClause(req.user);

    const result = await query(
      `SELECT a.*,
              p.name AS partner_name, p.company_name AS partner_company, p.email AS partner_email,
              o.name AS owner_name, o.email AS owner_email
       FROM accounts a
       LEFT JOIN users p ON p.id = a.partner_id
       LEFT JOIN users o ON o.id = a.owner_id
       WHERE a.id = $1 AND ${access.where.replace('$1', '$2')}`,
      [id, ...access.params]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = result.rows[0];

    // Hide internal fields from partners
    if (req.user.role === ROLES.CHANNEL_PARTNER) {
      delete account.kyc_agent;
      delete account.rejection_reason;
    }

    res.json({ data: account });
  } catch (err) {
    next(err);
  }
}

async function createAccount(req, res, next) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      company_name, trading_name, business_type, vertical,
      contact_name, contact_email, contact_phone, country,
      website, nature_of_business, onboarding_specialist,
      va_status, card_status, registration_date, remarks,
      account_number, status
    } = req.body;

    if (!company_name || !contact_name || !contact_email) {
      return res.status(400).json({ error: 'Company name, contact name and email are required' });
    }

    // Auto-assign COS with fewest accounts
    const cosResult = await client.query(
      `SELECT u.id, COUNT(a.id) AS cnt
       FROM users u
       LEFT JOIN accounts a ON a.owner_id = u.id AND a.status NOT IN ('rejected')
       WHERE u.role = 'customer_onboarding_specialist' AND u.is_active = TRUE
       GROUP BY u.id ORDER BY cnt ASC LIMIT 1`
    );
    const ownerId = cosResult.rows[0]?.id || null;

    const validStatuses = ['registered','in_review','onboarded','activated','rejected'];
    const accountStatus = validStatuses.includes(status) ? status : 'registered';

    const result = await client.query(
      `INSERT INTO accounts
         (company_name, trading_name, business_type, vertical, contact_name,
          contact_email, contact_phone, country, website, nature_of_business,
          onboarding_specialist, va_status, card_status, registration_date,
          remarks, account_number, status, partner_id, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [company_name, trading_name || null, business_type || null, vertical || null,
       contact_name, contact_email, contact_phone || null, country || null,
       website || null, nature_of_business || null, onboarding_specialist || null,
       va_status || null, card_status || null,
       registration_date || null,
       remarks || null, account_number || null, accountStatus, req.user.id, ownerId]
    );

    const account = result.rows[0];

    await logAudit(client, account.id, req.user.id, 'account_created', null, account, req.ip);

    await client.query('COMMIT');
    res.status(201).json({ data: account });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function updateAccount(req, res, next) {
  const client = await getClient();
  try {
    const { id } = req.params;
    const access = accountAccessClause(req.user);

    // Fetch current record
    const current = await client.query(
      `SELECT * FROM accounts a WHERE a.id = $1 AND ${access.where.replace('$1', '$2')}`,
      [id, ...access.params]
    );
    if (!current.rows.length) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const old = current.rows[0];
    await client.query('BEGIN');

    // Fields partners can edit
    const partnerFields = ['company_name','trading_name','business_type','vertical',
                           'contact_name','contact_email','contact_phone','country',
                           'website','nature_of_business','onboarding_specialist',
                           'va_status','card_status','registration_date','remarks',
                           'account_number','status'];

    // Fields only internal staff can edit
    const internalFields = ['kyc_agent','owner_id','rejection_reason'];

    const allowedFields = req.user.role === ROLES.CHANNEL_PARTNER
      ? partnerFields
      : [...partnerFields, ...internalFields];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Set timestamps for status transitions
    if (updates.status === ACCOUNT_STATUS.ONBOARDED && old.status !== ACCOUNT_STATUS.ONBOARDED) {
      updates.onboarded_at = new Date();
    }
    if (updates.status === ACCOUNT_STATUS.ACTIVATED && old.status !== ACCOUNT_STATUS.ACTIVATED) {
      updates.activated_at = new Date();
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [id, ...Object.values(updates)];

    const result = await client.query(
      `UPDATE accounts SET ${setClauses} WHERE id = $1 RETURNING *`,
      values
    );

    await logAudit(client, id, req.user.id, 'account_updated', old, result.rows[0], req.ip);
    await client.query('COMMIT');

    res.json({ data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

function parseCsvRows(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const parseRow = (line) => {
    const cells = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' && !inQ) { inQ = true; }
      else if (line[i] === '"' && inQ && line[i+1] === '"') { cur += '"'; i++; }
      else if (line[i] === '"' && inQ) { inQ = false; }
      else if (line[i] === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else { cur += line[i]; }
    }
    cells.push(cur.trim());
    return cells;
  };
  const headerCells = parseRow(lines[0]);
  const headers = {};
  headerCells.forEach((h, i) => { headers[h.trim()] = i; });
  const rows = lines.slice(1).map((line, idx) => {
    const cells = parseRow(line);
    return { rowNum: idx + 2, get: (col) => (headers[col] !== undefined ? (cells[headers[col]] || '') : '') };
  });
  return { headers, rows };
}

async function bulkUploadAccounts(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const isCsv = req.file.originalname.toLowerCase().endsWith('.csv') ||
                  req.file.mimetype === 'text/csv' ||
                  req.file.mimetype === 'text/plain' ||
                  req.file.mimetype === 'application/csv';

    let dataRows = [];
    let headers = {};

    if (isCsv) {
      const parsed = parseCsvRows(req.file.path);
      fs.unlinkSync(req.file.path);
      if (!parsed || !parsed.rows.length) {
        return res.status(400).json({ error: 'CSV file is empty' });
      }
      headers  = parsed.headers;
      dataRows = parsed.rows;
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      fs.unlinkSync(req.file.path);
      const sheet = workbook.worksheets[0];
      if (!sheet || sheet.rowCount < 2) {
        return res.status(400).json({ error: 'Spreadsheet is empty' });
      }
      sheet.getRow(1).eachCell((cell, colNum) => {
        headers[String(cell.value).trim()] = colNum;
      });
      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const get = (col) => {
          const idx = headers[col];
          return idx ? String(row.getCell(idx).value ?? '').trim() : '';
        };
        dataRows.push({ rowNum, get });
      });
    }

    const required = ['company_name', 'contact_name', 'contact_email'];
    for (const f of required) {
      if (!(f in headers)) {
        return res.status(400).json({ error: `Missing column: ${f}` });
      }
    }

    const cosResult = await query(
      `SELECT id FROM users WHERE role = 'customer_onboarding_specialist' AND is_active = TRUE LIMIT 1`
    );
    const defaultOwnerId = cosResult.rows[0]?.id || null;

    const created = [];
    const errors = [];

    for (const { rowNum, get } of dataRows) {
      const company_name  = get('company_name');
      const contact_name  = get('contact_name');
      const contact_email = get('contact_email');
      if (!company_name || !contact_name || !contact_email) {
        errors.push({ row: rowNum, error: 'Missing required fields' });
        continue;
      }
      try {
        const result = await query(
          `INSERT INTO accounts
             (company_name, trading_name, business_type, vertical, contact_name,
              contact_email, contact_phone, country, website, nature_of_business,
              onboarding_specialist, va_status, card_status, remarks, partner_id, owner_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id, company_name`,
          [company_name, get('trading_name') || null, get('business_type') || null,
           get('vertical') || null, contact_name, contact_email,
           get('contact_phone') || null, get('country') || null,
           get('website') || null, get('nature_of_business') || null,
           get('onboarding_specialist') || null,
           get('va_status') || null, get('card_status') || null,
           get('remarks') || null, req.user.id, defaultOwnerId]
        );
        created.push(result.rows[0]);
      } catch (e) {
        errors.push({ row: rowNum, error: e.message });
      }
    }

    res.json({ created: created.length, errors });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(err);
  }
}

async function exportAccounts(req, res, next) {
  try {
    const access = accountAccessClause(req.user);
    const isInternal = INTERNAL_ROLES.includes(req.user.role);

    const result = await query(
      `SELECT a.company_name, a.trading_name, a.business_type, a.vertical,
              a.contact_name, a.contact_email, a.contact_phone, a.country,
              a.status, a.registration_date, a.account_number,
              ${isInternal ? 'a.kyc_agent,' : ''}
              p.name AS partner_name, o.name AS owner_name
       FROM accounts a
       LEFT JOIN users p ON p.id = a.partner_id
       LEFT JOIN users o ON o.id = a.owner_id
       WHERE ${access.where}
       ORDER BY a.registration_date DESC`,
      access.params
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Accounts');
    if (result.rows.length) {
      ws.columns = Object.keys(result.rows[0]).map(k => ({ header: k, key: k, width: 20 }));
      result.rows.forEach(r => ws.addRow(r));
    }

    res.setHeader('Content-Disposition', 'attachment; filename="accounts.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listAccounts, getAccount, createAccount, updateAccount, bulkUploadAccounts, exportAccounts };
