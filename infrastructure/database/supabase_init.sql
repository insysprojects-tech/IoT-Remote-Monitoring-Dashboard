-- ==============================================================================
-- IoT Remote Monitoring Dashboard — Supabase Database Initialization Script
-- ==============================================================================
-- This script is tailored for Supabase Cloud (Vanilla PostgreSQL 15+).
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query).
--
-- Features:
-- 1. UUID generation via pgcrypto / gen_random_uuid()
-- 2. Clean relational tables for Devices, Telemetry, Users, Rules, and Events
-- 3. Composite B-tree indexes for fast time-series filtering
-- 4. Default admin user seed (admin / admin123)
-- 5. Automated 24-hour rolling retention via pg_cron (prevents exceeding 500MB free limit)
-- ==============================================================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ==============================================================================
-- 1. Device Registry
-- ==============================================================================
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
CREATE INDEX IF NOT EXISTS idx_devices_train ON devices(train_no, coach_no);

-- ==============================================================================
-- 2. Telemetry (Vanilla PostgreSQL table optimized for time-range lookups)
-- ==============================================================================
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

-- Compound index for fast queries: "WHERE device_id = ... AND time >= ... ORDER BY time DESC"
CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, time DESC);

-- Index on time alone for fast retention cleanup queries
CREATE INDEX IF NOT EXISTS idx_telemetry_time ON telemetry(time);

-- ==============================================================================
-- 3. Users (Authentication & Roles)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username       VARCHAR(100) UNIQUE NOT NULL,
    email          VARCHAR(255) UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    role           VARCHAR(20) DEFAULT 'user',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ==============================================================================
-- 4. Alert Rules
-- ==============================================================================
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

-- ==============================================================================
-- 5. Alert Events
-- ==============================================================================
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

-- ==============================================================================
-- 6. Seed Default Admin User
-- Username: admin
-- Password: admin123 (bcrypt hash)
-- ==============================================================================
INSERT INTO users (username, email, password_hash, role)
VALUES ('admin', 'admin@localhost', '$2b$12$Aoxo8rtN/8MxaFbvuWWX8uriV7DJc.HhofM2qiwH8heNlnahcqkpK', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ==============================================================================
-- 7. Automated 24-Hour Telemetry Retention Cleanup (pg_cron)
-- Prevents exceeding Supabase's 500 MB free storage limit.
-- ==============================================================================

-- Cleanup function to delete telemetry older than retention period
CREATE OR REPLACE FUNCTION purge_old_telemetry(retention_interval INTERVAL DEFAULT INTERVAL '24 hours')
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM telemetry
    WHERE time < (NOW() - retention_interval);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Remove existing job if it was already created (avoids duplicates)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-telemetry-hourly') THEN
        PERFORM cron.unschedule('purge-telemetry-hourly');
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- pg_cron not active yet
        NULL;
END $$;

-- Schedule the cleanup job to run every hour at minute 0
-- If pg_cron is enabled, this registers the schedule:
DO $$
BEGIN
    PERFORM cron.schedule(
        'purge-telemetry-hourly',
        '0 * * * *',
        'SELECT purge_old_telemetry(INTERVAL ''24 hours'');'
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron extension could not be scheduled automatically. Please enable pg_cron in Supabase Database -> Extensions.';
END $$;

-- Summary status
SELECT 'IoT Dashboard Supabase database initialized successfully' AS status;
