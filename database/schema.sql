-- Raw SQL reference for the collision avoidance database.

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        VARCHAR(64) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role            VARCHAR(32) NOT NULL DEFAULT 'administrator',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS telemetry_logs (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    distance_cm               REAL NOT NULL,
    risk_level                VARCHAR(16) NOT NULL,
    emergency_brake_triggered BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS incident_logs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_type        VARCHAR(48) NOT NULL,
    distance_at_brake REAL NOT NULL,
    action_taken      VARCHAR(128) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry_logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_incident_ts  ON incident_logs (timestamp);
