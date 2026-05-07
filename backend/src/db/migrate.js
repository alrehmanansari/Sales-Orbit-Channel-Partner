require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runMigrations() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Migrations ran successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigrations();
