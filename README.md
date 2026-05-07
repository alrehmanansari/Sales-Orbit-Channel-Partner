# Sales Orbit – Channel Partners Platform

A full-stack CRM web application for managing channel partner accounts, onboarding workflows, ticketing, and internal analytics.

---

## Architecture

```
sales-orbit/
├── backend/          Node.js + Express API
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── db/
│   └── package.json
├── frontend/         Vanilla HTML/CSS/JS
│   ├── index.html         Login
│   ├── register.html      Partner registration
│   ├── partner/           Channel partner portal
│   └── internal/          Internal team portal
├── nginx.conf        Production nginx config
└── README.md
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- nginx (for production)
- PM2 (for production process management)

---

## Local Development Setup

### 1. Clone & Install

```bash
git clone <your-repo>
cd sales-orbit

# Install backend dependencies
cd backend
npm install
```

### 2. Create the database

```bash
# Login to PostgreSQL
psql -U postgres

# Create DB
CREATE DATABASE sales_orbit;
\q
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your DB credentials and JWT secret
nano .env
```

### 4. Run migrations

```bash
npm run migrate
```

This creates all tables. Then generate real bcrypt hashes for seed users:

```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('Admin@1234',10))"
```

Replace the `$2a$10$xxx...` placeholders in `src/db/migrations.sql` with real hashes and re-run `npm run migrate`, or update passwords directly via psql.

### 5. Start the backend

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

### 6. Configure frontend API URL

Edit `frontend/assets/js/api.js`, line 2:

```js
const API_BASE = window.API_BASE || 'http://localhost:3000/api';
```

For production, change to your domain:
```js
const API_BASE = 'https://your-domain.com/api';
```

### 7. Open the app

Open `frontend/index.html` in your browser, or serve it via nginx / a local HTTP server:

```bash
# Quick dev server (Python)
cd frontend && python3 -m http.server 8080
# Then visit: http://localhost:8080
```

---

## Production Deployment (VPS)

### Step 1 – Server prep

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx nodejs npm postgresql postgresql-contrib certbot python3-certbot-nginx
npm install -g pm2
```

### Step 2 – PostgreSQL

```bash
sudo -u postgres psql
CREATE USER sales_orbit WITH PASSWORD 'strong_password_here';
CREATE DATABASE sales_orbit OWNER sales_orbit;
GRANT ALL PRIVILEGES ON DATABASE sales_orbit TO sales_orbit;
\q
```

### Step 3 – Deploy code

```bash
# Upload project to /var/www/sales-orbit
sudo mkdir -p /var/www/sales-orbit
sudo chown $USER:$USER /var/www/sales-orbit
# (upload via scp, rsync, or git clone)
```

### Step 4 – Configure backend

```bash
cd /var/www/sales-orbit/backend
cp .env.example .env
nano .env   # set real DB_PASSWORD, JWT_SECRET, FRONTEND_URL
npm install --production
npm run migrate
```

### Step 5 – Start with PM2

```bash
cd /var/www/sales-orbit/backend
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

### Step 6 – nginx

```bash
sudo cp /var/www/sales-orbit/nginx.conf /etc/nginx/sites-available/sales-orbit
# Edit server_name and SSL paths
sudo nano /etc/nginx/sites-available/sales-orbit
sudo ln -s /etc/nginx/sites-available/sales-orbit /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Step 7 – SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## User Roles & Access

| Role | Portal | Accounts visible | Can edit KYC |
|---|---|---|---|
| `channel_partner` | Partner portal only | Own accounts | No |
| `customer_onboarding_specialist` | Internal | Assigned to them | Yes |
| `senior_bdm` | Internal | All | Yes |
| `manager_partnerships` | Internal | All | Yes |
| `head_of_sales` | Internal | All | Yes |
| `head_of_mena` | Internal | All | Yes |

---

## Key Features

### Partner Portal
- Register / Login
- Add accounts (without KYC Agent field)
- Edit own accounts (no delete)
- Bulk upload via Excel/CSV
- Export to XLS
- Post notes on accounts → notifies assigned COS
- Create support tickets per account
- Real-time notification bell (30s polling)

### Internal Portal (COS / Management)
- View & edit all assigned accounts
- Edit KYC Agent, Account Number, Status, Owner
- Post notes → notifies channel partner
- Update ticket status with notes
- Dashboard: filters, charts (registration/activation/business-type trends), funnel, KPI table
- Ticket Resolution centre with report table
- Audit history per account

---

## API Reference

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Auth |
| GET | `/api/accounts` | Auth |
| POST | `/api/accounts` | Auth |
| PUT | `/api/accounts/:id` | Auth |
| POST | `/api/accounts/bulk` | Auth |
| GET | `/api/accounts/export` | Auth |
| GET | `/api/accounts/:id/notes` | Auth |
| POST | `/api/accounts/:id/notes` | Auth |
| GET | `/api/accounts/:id/audit` | Auth |
| GET | `/api/notifications` | Auth |
| PUT | `/api/notifications/read-all` | Auth |
| GET | `/api/tickets` | Auth |
| POST | `/api/tickets` | Auth |
| PUT | `/api/tickets/:id/status` | Internal |
| GET | `/api/tickets/export` | Auth |
| GET | `/api/dashboard/stats` | Internal |
| GET | `/api/dashboard/trend/registrations` | Internal |
| GET | `/api/dashboard/trend/business-type` | Internal |
| GET | `/api/dashboard/kpi` | Internal |
| GET | `/api/dashboard/tickets` | Internal |
| GET | `/api/users/partners` | Internal |
| GET | `/api/users/specialists` | Internal |

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | API server port (default: 3000) |
| `NODE_ENV` | `development` or `production` |
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `JWT_SECRET` | Secret for JWT signing (change this!) |
| `JWT_EXPIRES_IN` | Token TTL (e.g. `7d`) |
| `FRONTEND_URL` | CORS origin (your domain) |
| `UPLOAD_DIR` | Upload directory path |
| `MAX_FILE_SIZE` | Max upload size in bytes |

---

## Default Internal Accounts

After running migrations, internal user records exist with placeholder passwords.  
**Generate real hashes before going live:**

```bash
node -e "const b=require('bcryptjs'); console.log(b.hashSync('YourPassword123',10))"
```

Update via psql:
```sql
UPDATE users SET password_hash = '$2a$10$...' WHERE email = 'cos1@salesorbit.app';
```

---

## Tech Stack

- **Backend:** Node.js, Express.js, PostgreSQL (pg), JWT, bcryptjs, multer, xlsx
- **Frontend:** Vanilla HTML5 / CSS3 / ES6+, Chart.js, Sales Orbit Design System
- **Process Manager:** PM2
- **Web Server:** nginx
- **SSL:** Let's Encrypt / Certbot
