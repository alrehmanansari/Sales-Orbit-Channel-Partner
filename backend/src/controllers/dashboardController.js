const { query } = require('../config/database');
const { ROLES, MANAGEMENT_ROLES } = require('../config/constants');

function buildDateFilter(startDate, endDate, col = 'a.registration_date') {
  const conditions = [];
  const params = [];
  let idx = 1;
  if (startDate) { conditions.push(`${col} >= $${idx++}`); params.push(startDate); }
  if (endDate)   { conditions.push(`${col} <= $${idx++}`); params.push(endDate); }
  return { conditions, params };
}

async function getSummaryStats(req, res, next) {
  try {
    const {
      month, partner_id, vertical, start_date, end_date,
      owner_id, status, kyc_agent, business_type
    } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.user.role === ROLES.CUSTOMER_ONBOARDING_SPECIALIST) {
      conditions.push(`a.owner_id = $${idx++}`);
      params.push(req.user.id);
    }

    if (month)         { conditions.push(`TO_CHAR(a.registration_date,'YYYY-MM') = $${idx++}`); params.push(month); }
    if (partner_id)    { conditions.push(`a.partner_id = $${idx++}`);    params.push(partner_id); }
    if (vertical)      { conditions.push(`a.vertical = $${idx++}`);      params.push(vertical); }
    if (owner_id)      { conditions.push(`a.owner_id = $${idx++}`);      params.push(owner_id); }
    if (status)        { conditions.push(`a.status = $${idx++}`);        params.push(status); }
    if (kyc_agent)     { conditions.push(`a.kyc_agent = $${idx++}`);     params.push(kyc_agent); }
    if (business_type) { conditions.push(`a.business_type = $${idx++}`); params.push(business_type); }
    if (start_date)    { conditions.push(`a.registration_date >= $${idx++}`); params.push(start_date); }
    if (end_date)      { conditions.push(`a.registration_date <= $${idx++}`); params.push(end_date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [totals, funnelResult] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE TRUE)                                  AS total,
           COUNT(*) FILTER (WHERE a.status = 'registered')              AS registered,
           COUNT(*) FILTER (WHERE a.status = 'in_review')               AS in_review,
           COUNT(*) FILTER (WHERE a.status = 'onboarded')               AS onboarded,
           COUNT(*) FILTER (WHERE a.status = 'activated')               AS activated,
           COUNT(*) FILTER (WHERE a.status = 'rejected')                AS rejected,
           COUNT(*) FILTER (WHERE a.business_type = 'new')              AS business_new,
           COUNT(*) FILTER (WHERE a.business_type = 'established')      AS business_established
         FROM accounts a ${where}`,
        params
      ),
      query(
        `SELECT
           COUNT(*) AS total_registered,
           COUNT(*) FILTER (WHERE a.status IN ('in_review','onboarded','activated')) AS in_review,
           COUNT(*) FILTER (WHERE a.status IN ('onboarded','activated'))              AS onboarded,
           COUNT(*) FILTER (WHERE a.status = 'activated')                             AS activated
         FROM accounts a ${where}`,
        params
      )
    ]);

    res.json({
      stats: totals.rows[0],
      funnel: funnelResult.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function getRegistrationTrend(req, res, next) {
  try {
    const { months = 12, owner_id, partner_id } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.user.role === ROLES.CUSTOMER_ONBOARDING_SPECIALIST) {
      conditions.push(`a.owner_id = $${idx++}`); params.push(req.user.id);
    } else {
      if (owner_id)   { conditions.push(`a.owner_id = $${idx++}`);   params.push(owner_id); }
      if (partner_id) { conditions.push(`a.partner_id = $${idx++}`); params.push(partner_id); }
    }

    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT TO_CHAR(gs.mon, 'YYYY-MM') AS month,
              COALESCE(COUNT(a.id), 0)                                              AS registered,
              COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'activated'), 0)       AS activated,
              COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'onboarded'), 0)       AS onboarded
       FROM generate_series(
              date_trunc('month', NOW() - ($${idx}::int * interval '1 month')),
              date_trunc('month', NOW()),
              interval '1 month'
            ) AS gs(mon)
       LEFT JOIN accounts a
         ON date_trunc('month', a.registration_date) = gs.mon ${where}
       GROUP BY gs.mon
       ORDER BY gs.mon`,
      [...params, parseInt(months)]
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getBusinessTypeTrend(req, res, next) {
  try {
    const { months = 6 } = req.query;
    const conditions = [];
    const params = [parseInt(months)];
    let idx = 2;

    if (req.user.role === ROLES.CUSTOMER_ONBOARDING_SPECIALIST) {
      conditions.push(`a.owner_id = $${idx++}`); params.push(req.user.id);
    }

    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT TO_CHAR(gs.mon, 'YYYY-MM') AS month,
              COALESCE(COUNT(a.id) FILTER (WHERE a.business_type = 'new'), 0)         AS business_new,
              COALESCE(COUNT(a.id) FILTER (WHERE a.business_type = 'established'), 0) AS business_established
       FROM generate_series(
              date_trunc('month', NOW() - ($1::int * interval '1 month')),
              date_trunc('month', NOW()),
              interval '1 month'
            ) AS gs(mon)
       LEFT JOIN accounts a
         ON date_trunc('month', a.registration_date) = gs.mon ${where}
       GROUP BY gs.mon
       ORDER BY gs.mon`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getKpiTable(req, res, next) {
  try {
    const {
      date_range = 'current_month',
      custom_start, custom_end,
      team_member_id
    } = req.query;

    let startDate, endDate;
    const now = new Date();

    switch (date_range) {
      case 'last_week':
        startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay() - 6);
        endDate   = new Date(now); endDate.setDate(now.getDate() - now.getDay());
        break;
      case 'current_week':
        startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay() + 1);
        endDate   = now;
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate   = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate   = now;
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate   = now;
        break;
      case 'current_quarter': {
        const q = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), q * 3, 1);
        endDate   = now;
        break;
      }
      case 'last_quarter': {
        const q = Math.floor(now.getMonth() / 3) - 1;
        startDate = new Date(now.getFullYear(), q * 3, 1);
        endDate   = new Date(now.getFullYear(), (q + 1) * 3, 0);
        break;
      }
      case 'next_quarter': {
        const q = Math.floor(now.getMonth() / 3) + 1;
        startDate = new Date(now.getFullYear(), q * 3, 1);
        endDate   = new Date(now.getFullYear(), (q + 1) * 3, 0);
        break;
      }
      case 'custom':
        startDate = custom_start ? new Date(custom_start) : new Date(now.getFullYear(), now.getMonth(), 1);
        endDate   = custom_end   ? new Date(custom_end)   : now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate   = now;
    }

    const params = [startDate.toISOString(), endDate.toISOString()];
    let idx = 3;
    const memberFilter = team_member_id ? `AND u.id = $${idx++}` : '';
    if (team_member_id) params.push(team_member_id);

    const result = await query(
      `SELECT
         u.id, u.name, u.role, u.designation,
         p.name AS partner_name,
         COUNT(a.id) FILTER (WHERE a.registration_date BETWEEN $1 AND $2)                     AS accounts_registered,
         COUNT(a.id) FILTER (WHERE a.status = 'in_review'  AND a.registration_date BETWEEN $1 AND $2) AS accounts_in_review,
         COUNT(a.id) FILTER (WHERE a.status = 'onboarded'  AND a.registration_date BETWEEN $1 AND $2) AS accounts_onboarded,
         COUNT(a.id) FILTER (WHERE a.status = 'activated'  AND a.registration_date BETWEEN $1 AND $2) AS accounts_activated,
         COUNT(a.id) FILTER (WHERE a.business_type = 'new'         AND a.registration_date BETWEEN $1 AND $2) AS business_new,
         COUNT(a.id) FILTER (WHERE a.business_type = 'established' AND a.registration_date BETWEEN $1 AND $2) AS business_established,
         COUNT(a.id) FILTER (WHERE a.vertical = 'it_services_provider' AND a.registration_date BETWEEN $1 AND $2) AS vertical_it,
         COUNT(a.id) FILTER (WHERE a.vertical = 'ecomm_seller'         AND a.registration_date BETWEEN $1 AND $2) AS vertical_ecomm,
         COUNT(a.id) FILTER (WHERE a.vertical = 'b2b_seller'           AND a.registration_date BETWEEN $1 AND $2) AS vertical_b2b,
         COUNT(a.id) FILTER (WHERE a.vertical = 'freelancer'           AND a.registration_date BETWEEN $1 AND $2) AS vertical_freelancer
       FROM users u
       LEFT JOIN accounts a ON a.partner_id = u.id
       LEFT JOIN users p ON p.id = u.id
       WHERE u.role != 'channel_partner' AND u.is_active = TRUE ${memberFilter}
       GROUP BY u.id, u.name, u.role, u.designation, p.name
       ORDER BY accounts_registered DESC`,
      params
    );

    res.json({ data: result.rows, date_range, start_date: startDate, end_date: endDate });
  } catch (err) {
    next(err);
  }
}

async function getTicketReport(req, res, next) {
  try {
    const { partner_id, specialist_id, query_type, status } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.user.role === ROLES.CUSTOMER_ONBOARDING_SPECIALIST) {
      conditions.push(`t.specialist_id = $${idx++}`); params.push(req.user.id);
    } else {
      if (partner_id)    { conditions.push(`t.partner_id = $${idx++}`);    params.push(partner_id); }
      if (specialist_id) { conditions.push(`t.specialist_id = $${idx++}`); params.push(specialist_id); }
    }
    if (query_type) { conditions.push(`t.query_type = $${idx++}`); params.push(query_type); }
    if (status)     { conditions.push(`t.status = $${idx++}`);     params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT t.id AS ticket_id, t.ticket_number, t.query_type, t.status,
              t.created_at, t.resolved_at,
              EXTRACT(DAY FROM (COALESCE(t.resolved_at, NOW()) - t.created_at)) AS days_open,
              a.company_name AS account_name,
              p.name AS partner_name,
              s.name AS specialist_name
       FROM tickets t
       JOIN accounts a ON a.id = t.account_id
       JOIN users p ON p.id = t.partner_id
       LEFT JOIN users s ON s.id = t.specialist_id
       ${where}
       ORDER BY t.created_at DESC`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

function _resolveDateRange(date_range, custom_start, custom_end) {
  const now = new Date();
  switch (date_range) {
    case 'last_week': {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay() - 6);
      const e = new Date(now); e.setDate(now.getDate() - now.getDay());
      return [s, e];
    }
    case 'current_week': {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay() + 1);
      return [s, now];
    }
    case 'last_month':
      return [new Date(now.getFullYear(), now.getMonth() - 1, 1),
              new Date(now.getFullYear(), now.getMonth(), 0)];
    case 'current_month':
      return [new Date(now.getFullYear(), now.getMonth(), 1), now];
    case 'ytd':
      return [new Date(now.getFullYear(), 0, 1), now];
    case 'current_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return [new Date(now.getFullYear(), q * 3, 1), now];
    }
    case 'last_quarter': {
      const q = Math.floor(now.getMonth() / 3) - 1;
      return [new Date(now.getFullYear(), q * 3, 1),
              new Date(now.getFullYear(), (q + 1) * 3, 0)];
    }
    case 'next_quarter': {
      const q = Math.floor(now.getMonth() / 3) + 1;
      return [new Date(now.getFullYear(), q * 3, 1),
              new Date(now.getFullYear(), (q + 1) * 3, 0)];
    }
    case 'custom':
      return [custom_start ? new Date(custom_start) : new Date(now.getFullYear(), now.getMonth(), 1),
              custom_end   ? new Date(custom_end)   : now];
    default:
      return [new Date(now.getFullYear(), now.getMonth(), 1), now];
  }
}

async function getPartnerKpi(req, res, next) {
  try {
    const { date_range = 'all', custom_start, custom_end, start_date, end_date, owner_id } = req.query;

    let startDate, endDate;
    if (start_date && end_date) {
      startDate = new Date(start_date);
      endDate   = new Date(end_date + 'T23:59:59');
    } else if (date_range !== 'all') {
      [startDate, endDate] = _resolveDateRange(date_range, custom_start, custom_end);
    }

    const hasDateFilter = !!(startDate && endDate);
    const params = hasDateFilter ? [startDate.toISOString(), endDate.toISOString()] : [];
    let idx = hasDateFilter ? 3 : 1;

    const dateClause = hasDateFilter ? `AND a.registration_date BETWEEN $1 AND $2` : '';
    const ownerFilter = owner_id ? `AND a.owner_id = $${idx++}` : '';
    if (owner_id) params.push(owner_id);

    const result = await query(
      `SELECT
         p.id, p.name AS partner_name, p.company_name AS partner_company, p.email AS partner_email,
         COUNT(DISTINCT a.id) FILTER (WHERE TRUE ${dateClause})                              AS total_accounts,
         COUNT(DISTINCT a.id) FILTER (WHERE a.status='registered'  ${dateClause})           AS stage_registered,
         COUNT(DISTINCT a.id) FILTER (WHERE a.status='in_review'   ${dateClause})           AS stage_in_review,
         COUNT(DISTINCT a.id) FILTER (WHERE a.status='onboarded'   ${dateClause})           AS stage_onboarded,
         COUNT(DISTINCT a.id) FILTER (WHERE a.status='activated'   ${dateClause})           AS stage_activated,
         COUNT(DISTINCT a.id) FILTER (WHERE a.status='rejected'    ${dateClause})           AS stage_rejected,
         COALESCE(SUM(a.monthly_volume) FILTER (WHERE TRUE ${dateClause}), 0)               AS total_monthly_volume,
         COUNT(DISTINCT t.id) FILTER (WHERE t.status NOT IN ('resolved','declined'))        AS open_tickets,
         COUNT(DISTINCT t.id)                                                                AS total_tickets
       FROM users p
       LEFT JOIN accounts a ON a.partner_id = p.id ${ownerFilter}
       LEFT JOIN tickets  t ON t.partner_id = p.id
       WHERE p.role = 'channel_partner' AND p.is_active = TRUE
       GROUP BY p.id, p.name, p.company_name, p.email
       ORDER BY total_accounts DESC`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSummaryStats,
  getRegistrationTrend,
  getBusinessTypeTrend,
  getKpiTable,
  getPartnerKpi,
  getTicketReport
};
