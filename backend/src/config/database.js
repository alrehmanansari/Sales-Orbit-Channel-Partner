const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'sales_orbit',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30020,
  connectionTimeoutMillis: 2000
});

pool.on('error', (err) => {
  console.error('Unexpected database error', err);
  // Don't exit — PM2 will restart if needed; log and continue
});

async function testConnection() {
  const MAX_RETRIES = 5;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const client = await pool.connect();
      console.log('Database connected successfully');
      client.release();
      return;
    } catch (err) {
      console.error(`Database connection attempt ${i}/${MAX_RETRIES} failed:`, err.message);
      if (i === MAX_RETRIES) {
        console.error('Could not connect to database after', MAX_RETRIES, 'attempts. Exiting.');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 3000 * i));
    }
  }
}

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Query executed', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('Query error:', { text, error: err.message });
    throw err;
  }
}

async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const release = client.release.bind(client);
  let released = false;

  client.release = () => {
    if (!released) {
      released = true;
      release();
    }
  };

  client.query = (...args) => originalQuery(...args);
  return client;
}

async function runMigrations() {
  // Migration tracking table — each entry is a migration that has already run.
  // Schema migrations (ALTER TABLE) are idempotent by nature.
  // Data migrations use this table so they run exactly once.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      ran_at TIMESTAMPTZ DEFAULT NOW()
    )`);

  async function ran(id) {
    const r = await pool.query('SELECT 1 FROM _migrations WHERE id=$1', [id]);
    return r.rows.length > 0;
  }
  async function mark(id) {
    await pool.query('INSERT INTO _migrations(id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
  }

  // ── Idempotent schema changes ─────────────────────────────────────────────
  const schemaMigrations = [
    ['add_monthly_volume', `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS monthly_volume NUMERIC(15,2)`],
    ['add_city',          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS city VARCHAR(100)`],
    ['add_in_review_at',  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS in_review_at TIMESTAMPTZ`],
    ['add_rejected_at',   `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ`],
    // Fix existing users who signed up with old internal designations — give them COS role
    ['fix_internal_roles_to_cos', `
      UPDATE users
      SET role = 'customer_onboarding_specialist',
          designation = 'Onboarding Specialist'
      WHERE role NOT IN ('channel_partner','customer_onboarding_specialist')
        AND email NOT LIKE '%@salesorbit.app'
        AND is_active = TRUE
    `],
  ];
  for (const [id, sql] of schemaMigrations) {
    try { await pool.query(sql); await mark(id); }
    catch (err) { console.error(`[migration] ${id}:`, err.message); }
  }

  // ── One-time: purge all non-seed users & their data (v1) ────────────────────
  if (!await ran('clear_non_seed_users_v1')) {
    try {
      await pool.query(`DELETE FROM email_otps`);
      await pool.query(`DELETE FROM audit_logs`);
      await pool.query(`DELETE FROM notes`);
      await pool.query(`DELETE FROM tickets`);
      await pool.query(`DELETE FROM notifications`);
      await pool.query(`DELETE FROM accounts`);
      await pool.query(`DELETE FROM users WHERE email NOT LIKE '%@salesorbit.app'`);
      await mark('clear_non_seed_users_v1');
      console.log('[migration] clear_non_seed_users_v1: done');
    } catch (err) {
      console.error('[migration] clear_non_seed_users_v1 error:', err.message);
    }
  }

  // ── One-time: purge all non-seed users again so everyone re-signs up (v2) ──
  if (!await ran('clear_non_seed_users_v2')) {
    try {
      await pool.query(`DELETE FROM email_otps`);
      await pool.query(`DELETE FROM audit_logs`);
      await pool.query(`DELETE FROM notes`);
      await pool.query(`DELETE FROM tickets`);
      await pool.query(`DELETE FROM notifications`);
      await pool.query(`DELETE FROM accounts`);
      await pool.query(`DELETE FROM users WHERE email NOT LIKE '%@salesorbit.app'`);
      await mark('clear_non_seed_users_v2');
      console.log('[migration] clear_non_seed_users_v2: all users cleared — everyone can sign up fresh');
    } catch (err) {
      console.error('[migration] clear_non_seed_users_v2 error:', err.message);
    }
  }

  console.log('[migration] Complete');
}

module.exports = { pool, query, getClient, testConnection, runMigrations };
