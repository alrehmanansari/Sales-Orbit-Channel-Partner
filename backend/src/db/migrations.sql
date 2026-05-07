-- Sales Orbit Channel Partners - Database Schema
-- Run this file against your PostgreSQL database to initialise the schema.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(60) NOT NULL CHECK (role IN (
                  'channel_partner',
                  'customer_onboarding_specialist',
                  'senior_bdm',
                  'manager_partnerships',
                  'head_of_sales',
                  'head_of_mena'
                )),
  designation   VARCHAR(255),
  company_name  VARCHAR(255),        -- for channel partners
  phone         VARCHAR(50),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Filled by channel partner
  company_name          VARCHAR(255) NOT NULL,
  trading_name          VARCHAR(255),
  business_type         VARCHAR(30) CHECK (business_type IN ('new', 'established')),
  vertical              VARCHAR(50) CHECK (vertical IN (
                          'it_services_provider',
                          'ecomm_seller',
                          'b2b_seller',
                          'freelancer'
                        )),
  contact_name          VARCHAR(255) NOT NULL,
  contact_email         VARCHAR(255) NOT NULL,
  contact_phone         VARCHAR(50),
  country               VARCHAR(100),
  remarks               TEXT,

  -- Status
  status                VARCHAR(30) DEFAULT 'registered' CHECK (status IN (
                          'registered', 'in_review', 'onboarded', 'activated', 'rejected'
                        )),

  -- Relationships
  partner_id            UUID REFERENCES users(id),
  owner_id              UUID REFERENCES users(id),   -- assigned COS

  -- Internal-only fields (not visible to partners)
  kyc_agent             VARCHAR(255),
  account_number        VARCHAR(100),
  rejection_reason      TEXT,

  -- Metadata
  registration_date     TIMESTAMPTZ DEFAULT NOW(),
  onboarded_at          TIMESTAMPTZ,
  activated_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_partner_id ON accounts(partner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_owner_id   ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status     ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at);

-- ============================================================
-- NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_account_id ON notes(account_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  type            VARCHAR(50) DEFAULT 'note' CHECK (type IN (
                    'note', 'ticket', 'account', 'ticket_update'
                  )),
  reference_id    UUID,
  reference_type  VARCHAR(50),
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read  ON notifications(is_read);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID REFERENCES accounts(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_account_id ON audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number       SERIAL UNIQUE,
  account_id          UUID NOT NULL REFERENCES accounts(id),
  partner_id          UUID NOT NULL REFERENCES users(id),
  specialist_id       UUID REFERENCES users(id),

  query_type          VARCHAR(255) NOT NULL,
  expected_resolution VARCHAR(50),
  remarks             TEXT,

  status              VARCHAR(30) DEFAULT 'open' CHECK (status IN (
                        'open', 'in_review', 'pending_partner',
                        'pending_customer', 'resolved', 'declined'
                      )),
  decline_reason      VARCHAR(255),
  specialist_notes    TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_account_id    ON tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_tickets_partner_id    ON tickets(partner_id);
CREATE INDEX IF NOT EXISTS idx_tickets_specialist_id ON tickets(specialist_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status        ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at    ON tickets(created_at);

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEED: default users
-- ============================================================
-- Internal staff password : Admin@1234
-- Channel partner password: Partner@1234

INSERT INTO users (name, email, password_hash, role, designation, company_name) VALUES
  ('Head of Sales',    'head.sales@salesorbit.app',       '$2a$10$ZfhflNj070Y/26RV0A1MAec0lClPRujrEo/qBCCTCo.Wu1ObFH6YS', 'head_of_sales',                  'Head of Sales',                       NULL),
  ('Head of MENA',     'head.mena@salesorbit.app',        '$2a$10$ZfhflNj070Y/26RV0A1MAec0lClPRujrEo/qBCCTCo.Wu1ObFH6YS', 'head_of_mena',                   'Head of MENA',                        NULL),
  ('Senior BDM',       'senior.bdm@salesorbit.app',       '$2a$10$ZfhflNj070Y/26RV0A1MAec0lClPRujrEo/qBCCTCo.Wu1ObFH6YS', 'senior_bdm',                     'Senior Business Development Manager', NULL),
  ('Manager Partners', 'manager.partners@salesorbit.app', '$2a$10$ZfhflNj070Y/26RV0A1MAec0lClPRujrEo/qBCCTCo.Wu1ObFH6YS', 'manager_partnerships',            'Manager Partnerships',                NULL),
  ('COS One',          'cos1@salesorbit.app',             '$2a$10$ZfhflNj070Y/26RV0A1MAec0lClPRujrEo/qBCCTCo.Wu1ObFH6YS', 'customer_onboarding_specialist',  'Customer Onboarding Specialist',      NULL),
  ('COS Two',          'cos2@salesorbit.app',             '$2a$10$ZfhflNj070Y/26RV0A1MAec0lClPRujrEo/qBCCTCo.Wu1ObFH6YS', 'customer_onboarding_specialist',  'Customer Onboarding Specialist',      NULL),
  ('Demo Partner',     'partner@salesorbit.app',          '$2a$10$kdKKtyY7arkfImDhYntQGuvLDPh0p/DAOHkMVkOdYsiGVpX5yJ8Je', 'channel_partner',                 'Business Development Manager',        'Demo Agency LLC')
ON CONFLICT (email) DO NOTHING;
