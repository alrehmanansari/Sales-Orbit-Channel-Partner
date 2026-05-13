#!/usr/bin/env bash
# Sales Orbit — Production Deploy Script
# Run this on your server: bash deploy.sh

set -e

DOMAIN="partner.salesorbit.tech"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Sales Orbit — Production Deploy   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Git pull ─────────────────────────────────────────────────────────────
echo "→ Pulling latest code..."
git -C "$APP_DIR" pull origin main
echo "  ✓ Code updated"
echo ""

# ── 2. Fix PORT in .env if it is wrong ──────────────────────────────────────
echo "→ Checking backend .env..."
if [ ! -f "$ENV_FILE" ]; then
  echo "  ✗ ERROR: $ENV_FILE not found!"
  echo "    Copy .env.example to .env and fill in your values:"
  echo "    cp $BACKEND_DIR/.env.example $ENV_FILE"
  exit 1
fi

CURRENT_PORT=$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]')
if [ "$CURRENT_PORT" != "3002" ]; then
  echo "  ⚠ PORT is '$CURRENT_PORT' — fixing to 3002 to match nginx..."
  sed -i "s/^PORT=.*/PORT=3002/" "$ENV_FILE"
  echo "  ✓ PORT fixed to 3002"
else
  echo "  ✓ PORT=3002 (correct)"
fi
echo ""

# ── 3. Install backend dependencies ─────────────────────────────────────────
echo "→ Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --omit=dev --silent
echo "  ✓ Dependencies ready"
echo ""

# ── 4. Restart backend via PM2 ──────────────────────────────────────────────
echo "→ Restarting backend..."
if command -v pm2 &>/dev/null; then
  if pm2 list | grep -q "sales-orbit-api"; then
    pm2 restart sales-orbit-api --update-env
    echo "  ✓ PM2 restarted sales-orbit-api"
  else
    pm2 start ecosystem.config.js --env production
    pm2 save
    echo "  ✓ PM2 started sales-orbit-api"
  fi
else
  echo "  ⚠ PM2 not found — install it: npm install -g pm2"
  echo "  Starting with node directly (not recommended for production)..."
  pkill -f "node src/app.js" 2>/dev/null || true
  nohup node src/app.js > ../logs/app.log 2>&1 &
  echo "  ✓ Started (PID $!)"
fi
echo ""

# ── 5. Reload nginx ──────────────────────────────────────────────────────────
echo "→ Reloading nginx..."
if sudo nginx -t 2>/dev/null; then
  sudo nginx -s reload
  echo "  ✓ nginx reloaded"
else
  echo "  ✗ nginx config error — run 'sudo nginx -t' to see details"
fi
echo ""

# ── 6. Health check ──────────────────────────────────────────────────────────
echo "→ Running health checks..."
sleep 3

HEALTH=$(curl -s --max-time 5 "https://$DOMAIN/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"ok"'; then
  echo "  ✓ Backend healthy"
else
  echo "  ✗ Backend not responding — check PM2 logs: pm2 logs sales-orbit-api"
fi

REG=$(curl -s --max-time 5 -X POST "https://$DOMAIN/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Deploy Test","email":"deploy-test-check@internal.invalid","password":"Test@1234"}' 2>/dev/null || echo "")
if echo "$REG" | grep -q '"otp_required"'; then
  echo "  ✓ Registration endpoint working"
else
  echo "  ✗ Registration endpoint failed: $REG"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅  Deploy complete!"
echo ""
echo "Open https://$DOMAIN/register.html in your browser"
echo "and try signing up — it should work now."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
