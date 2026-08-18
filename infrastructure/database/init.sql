-- ====================================
-- IoT Remote Monitoring Dashboard — Database Init
-- ====================================
-- This script runs automatically when the TimescaleDB container starts
-- for the first time. It creates extensions and the initial schema.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================
-- Device Registry
-- =====================
CREATE TABLE IF NOT EXISTS devices (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mac_address   VARCHAR(17) UNIQUE NOT NULL,
    name          VARCHAR(255),
    device_type   VARCHAR(100),
    location      VARCHAR(255),
    train_no      VARCHAR(50),
    coach_no      VARCHAR(50),
    description   TEXT,
    firmware_ver  VARCHAR(50),
    is_online     BOOLEAN DEFAULT FALSE,
    last_seen     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_mac ON devices(mac_address);
CREATE INDEX IF NOT EXISTS idx_devices_online ON devices(is_online);

-- =====================
-- Telemetry (Hypertable)
-- =====================
CREATE TABLE IF NOT EXISTS telemetry (
    time               TIMESTAMPTZ NOT NULL,
    device_id          UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    battery_1_voltage  DOUBLE PRECISION,
    battery_2_voltage  DOUBLE PRECISION,
    ac_1_status        VARCHAR(3),
    ac_2_status        VARCHAR(3),
    main_mcb_status    VARCHAR(10),
    fsds_mcb_status    VARCHAR(10),
    battery_status     VARCHAR(20),
    countdown_timer    INTEGER,
    PRIMARY KEY (time, device_id)
);

-- Convert to TimescaleDB hypertable (chunk interval: 1 day)
SELECT create_hypertable('telemetry', 'time', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 day');

CREATE INDEX IF NOT EXISTS idx_telemetry_device ON telemetry(device_id, time DESC);

-- 1. Enable columnar compression
ALTER TABLE telemetry SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id',
  timescaledb.compress_orderby = 'time DESC'
);

-- 2. Compress data older than 7 days
SELECT add_compression_policy('telemetry', INTERVAL '7 days', if_not_exists => TRUE);

-- 3. Delete data older than 1 year
SELECT add_retention_policy('telemetry', INTERVAL '365 days', if_not_exists => TRUE);

-- =====================
-- Users (Authentication)
-- =====================
CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username       VARCHAR(100) UNIQUE NOT NULL,
    email          VARCHAR(255) UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    role           VARCHAR(20) DEFAULT 'user',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- =====================
-- Alert Rules
-- =====================
CREATE TABLE IF NOT EXISTS alert_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    metric      VARCHAR(50) NOT NULL,
    operator    VARCHAR(5) NOT NULL,
    threshold   DOUBLE PRECISION NOT NULL,
    severity    VARCHAR(20) DEFAULT 'warning',
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_device ON alert_rules(device_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);

-- =====================
-- Alert Events
-- =====================
CREATE TABLE IF NOT EXISTS alert_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id      UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    device_id    UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    metric       VARCHAR(50) NOT NULL,
    value        DOUBLE PRECISION NOT NULL,
    severity     VARCHAR(20) NOT NULL,
    message      TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_events_device ON alert_events(device_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_rule ON alert_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_severity ON alert_events(severity);
CREATE INDEX IF NOT EXISTS idx_alert_events_acknowledged ON alert_events(acknowledged);

-- =====================
-- Seed default admin user
-- Password: admin123 (bcrypt hash)
-- =====================
INSERT INTO users (username, email, password_hash, role)
VALUES ('admin', 'admin@localhost', '$2b$12$Aoxo8rtN/8MxaFbvuWWX8uriV7DJc.HhofM2qiwH8heNlnahcqkpK', 'admin')
ON CONFLICT (username) DO NOTHING;

SELECT 'IoT Dashboard database initialized successfully' AS status;
