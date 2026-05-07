#!/usr/bin/env bash
# Sales Orbit — one-shot local setup script
# Run after PostgreSQL is installed: bash setup.sh

set -e

export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Sales Orbit — Local Setup          ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Create database ─────────────────────────────────────────────
echo "→ Creating PostgreSQL database 'sales_orbit'..."
createdb sales_orbit 2>/dev/null && echo "  ✓ Database created" || echo "  ✓ Database already exists"

# ── 2. Run migrations ──────────────────────────────────────────────
echo "→ Running database migrations..."
cd "$(dirname "$0")/backend"
node src/db/migrate.js
echo "  ✓ Schema applied"

# ── 3. Seed default internal users with real password hashes ───────
echo "→ Setting passwords for internal seed accounts..."
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

const hash = bcrypt.hashSync('Admin@1234', 10);

pool.query(
  \`UPDATE users SET password_hash = \$1 WHERE password_hash LIKE '\$2a\$10\$xxx%'\`,
  [hash]
).then(r => {
  console.log('  ✓ Updated', r.rowCount, 'internal user password(s)');
  pool.end();
}).catch(e => {
  console.error('  ⚠ Password update skipped (may already be set):', e.message);
  pool.end();
});
"

# ── 4. Start server ────────────────────────────────────────────────
echo ""
echo "✅  Setup complete!"
echo ""
echo "─────────────────────────────────────────────────"
echo "INTERNAL USERS  (password: Admin@1234)"
echo "  cos1@salesorbit.app              — Customer Onboarding Specialist"
echo "  cos2@salesorbit.app              — Customer Onboarding Specialist"
echo "  senior.bdm@salesorbit.app        — Senior BDM"
echo "  manager.partners@salesorbit.app  — Manager Partnerships"
echo "  head.sales@salesorbit.app        — Head of Sales"
echo "  head.mena@salesorbit.app         — Head of MENA"
echo ""
echo "CHANNEL PARTNER  (password: Partner@1234)"
echo "  partner@salesorbit.app           — Demo Agency LLC"
echo "─────────────────────────────────────────────────"
echo ""
echo "Starting API server on http://localhost:3000 ..."
echo "Open frontend/index.html in your browser, or run:"
echo "  cd frontend && python3 -m http.server 8080"
echo "  Then visit http://localhost:8080"
echo ""

npm run dev
