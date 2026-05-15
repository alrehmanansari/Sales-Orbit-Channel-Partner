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
  const migrations = [
    // Schema additions
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS monthly_volume NUMERIC(15,2)`,

    // Fix users who registered with an internal designation but got channel_partner role
    // by mistake (the old register endpoint always assigned channel_partner).
    `UPDATE users SET role =
       CASE designation
         WHEN 'Customer Onboarding Specialist'      THEN 'customer_onboarding_specialist'
         WHEN 'Senior Business Development Manager' THEN 'senior_bdm'
         WHEN 'Manager Partnerships'                THEN 'manager_partnerships'
         WHEN 'Head of Sales'                       THEN 'head_of_sales'
         WHEN 'Head of MENA'                        THEN 'head_of_mena'
         WHEN 'Business Development Manager'        THEN 'senior_bdm'
         WHEN 'Sales Development Representative'    THEN 'senior_bdm'
         WHEN 'Country Head'                        THEN 'head_of_sales'
         ELSE 'senior_bdm'
       END
     WHERE role = 'channel_partner'
       AND designation IS NOT NULL
       AND designation <> 'Channel Partner'`,
  ];
  for (const sql of migrations) {
    try {
      const r = await pool.query(sql);
      if (r.rowCount) console.log(`[migration] ${r.rowCount} row(s) affected: ${sql.substring(0,60).trim()}…`);
    } catch (err) {
      console.error('[migration] error:', err.message);
    }
  }
  console.log('[migration] All migrations complete');
}

module.exports = { pool, query, getClient, testConnection, runMigrations };
