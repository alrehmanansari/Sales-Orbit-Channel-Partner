#!/usr/bin/env bash
# Emergency restart — run this from ANY terminal on the server:
#   curl -fsSL https://raw.githubusercontent.com/alrehmanansari/Sales-Orbit-Channel-Partner/main/restart.sh | bash

set -e

echo ""
echo "=== Sales Orbit Emergency Restart ==="
echo ""

# ── Find Node.js ──────────────────────────────────────────────────────────────
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | sort -V | tail -1)/bin:/usr/local/bin:/usr/bin:/opt/homebrew/bin:$PATH"

NODE=$(command -v node 2>/dev/null || true)
if [ -z "$NODE" ]; then
  echo "ERROR: Node.js not found. Install it first:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi
echo "Node: $($NODE --version)"
echo "npm:  $(npm --version)"

# ── Find the app directory ────────────────────────────────────────────────────
APP_DIR=""
SEARCH_PATHS=(
  "$HOME/Sales-Orbit-Channel-Partner"
  "/root/Sales-Orbit-Channel-Partner"
  "/var/www/sales-orbit"
  "/home/ubuntu/Sales-Orbit-Channel-Partner"
  "/opt/sales-orbit"
)
for p in "${SEARCH_PATHS[@]}"; do
  if [ -f "$p/backend/src/app.js" ]; then
    APP_DIR="$p"
    break
  fi
done

# If not found, search deeper
if [ -z "$APP_DIR" ]; then
  echo "Searching for app..."
  APP_DIR=$(find / -name "app.js" -path "*/backend/src/app.js" 2>/dev/null | head -1 | sed 's|/backend/src/app.js||')
fi

if [ -z "$APP_DIR" ]; then
  echo "ERROR: App directory not found. Clone it first:"
  echo "  git clone https://github.com/alrehmanansari/Sales-Orbit-Channel-Partner.git"
  exit 1
fi
echo "App dir: $APP_DIR"

# ── Pull latest code ──────────────────────────────────────────────────────────
echo ""
echo "→ Pulling latest code..."
cd "$APP_DIR"
git pull origin main 2>/dev/null || echo "  (git pull skipped)"

# ── Fix PORT in .env ──────────────────────────────────────────────────────────
if [ -f backend/.env ]; then
  if grep -q "^PORT=3000" backend/.env; then
    sed -i "s/^PORT=3000/PORT=3002/" backend/.env
    echo "→ Fixed PORT 3000 → 3002 in .env"
  fi
fi

# ── Install dependencies ──────────────────────────────────────────────────────
echo "→ Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install --omit=dev --silent
cd "$APP_DIR"

# ── Start/restart with PM2 ────────────────────────────────────────────────────
echo "→ Starting backend..."
if command -v pm2 &>/dev/null; then
  if pm2 list 2>/dev/null | grep -q "sales-orbit-api"; then
    pm2 restart sales-orbit-api --update-env
    echo "  PM2: restarted"
  else
    pm2 start backend/ecosystem.config.js --env production
    pm2 save --force
    echo "  PM2: started and saved"
  fi
else
  echo "  PM2 not found — installing..."
  npm install -g pm2 --silent
  pm2 start backend/ecosystem.config.js --env production
  pm2 save --force
  pm2 startup 2>/dev/null || true
  echo "  PM2: installed and started"
fi

# ── Reload nginx ──────────────────────────────────────────────────────────────
echo "→ Reloading nginx..."
sudo nginx -t 2>/dev/null && sudo nginx -s reload && echo "  nginx: reloaded" || echo "  nginx: (reload skipped)"

# ── Health check ──────────────────────────────────────────────────────────────
echo ""
echo "→ Health check (waiting 5s)..."
sleep 5
HEALTH=$(curl -sf --max-time 5 https://partner.salesorbit.tech/health 2>/dev/null || echo "fail")
if echo "$HEALTH" | grep -q "ok"; then
  echo "  ✓ Backend is LIVE!"
  echo ""
  echo "✅ Done! https://partner.salesorbit.tech is working."
else
  echo "  ✗ Backend still not responding"
  echo "    Check logs: pm2 logs sales-orbit-api --lines 30"
fi
echo ""
