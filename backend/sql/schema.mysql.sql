-- MySQL schema for Starkson backend (XAMPP/MySQL)
-- Run this in phpMyAdmin or MySQL CLI to create the local database schema.

-- Adjust database name as needed (e.g. starkson_db)
CREATE DATABASE IF NOT EXISTS starkson_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE starkson_db;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  fullname      VARCHAR(255) NOT NULL,
  role          ENUM('user', 'it_support', 'security_officer', 'admin') NOT NULL DEFAULT 'user',
  status        ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  -- In Supabase this was an array; here we store as comma-separated values like 'D01,D02'
  branch_acronyms TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- BRANCHES
CREATE TABLE IF NOT EXISTS branches (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  acronym     VARCHAR(10) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- SLA CONFIG
CREATE TABLE IF NOT EXISTS sla_config (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  priority              ENUM('low', 'medium', 'high', 'critical') NOT NULL UNIQUE,
  resolution_time_hours INT NOT NULL,
  is_active             TINYINT(1) NOT NULL DEFAULT 1,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- TICKETS
CREATE TABLE IF NOT EXISTS tickets (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_number   VARCHAR(50) NOT NULL UNIQUE,
  branch_acronym  VARCHAR(10) NOT NULL,
  request_type    VARCHAR(50) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT NOT NULL,
  affected_system VARCHAR(255) NULL,
  priority        ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  category        VARCHAR(100) NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'new',
  created_by      INT UNSIGNED NOT NULL,
  assigned_to     INT UNSIGNED NULL,
  sla_due         DATETIME NULL,
  resolved_at     DATETIME NULL,
  closed_at       DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tickets_branch (branch_acronym),
  KEY idx_tickets_created_by (created_by),
  KEY idx_tickets_assigned_to (assigned_to),
  CONSTRAINT fk_tickets_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_tickets_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- INCIDENTS
CREATE TABLE IF NOT EXISTS incidents (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_number  VARCHAR(50) NOT NULL UNIQUE,
  branch_acronym   VARCHAR(10) NOT NULL,
  source_ticket_id INT UNSIGNED NULL,
  detection_method VARCHAR(50) NULL,
  category         VARCHAR(100) NULL,
  title            VARCHAR(255) NOT NULL,
  description      TEXT NOT NULL,
  severity         ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  status           VARCHAR(50) NOT NULL DEFAULT 'new',
  assigned_to      INT UNSIGNED NULL,
  created_by       INT UNSIGNED NOT NULL,
  affected_asset   VARCHAR(255) NULL,
  affected_user_id INT UNSIGNED NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_incidents_branch (branch_acronym),
  KEY idx_incidents_source_ticket (source_ticket_id),
  KEY idx_incidents_assigned_to (assigned_to),
  CONSTRAINT fk_incidents_source_ticket FOREIGN KEY (source_ticket_id) REFERENCES tickets(id),
  CONSTRAINT fk_incidents_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id),
  CONSTRAINT fk_incidents_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_incidents_affected_user FOREIGN KEY (affected_user_id) REFERENCES users(id)
);

-- TICKET COMMENTS
CREATE TABLE IF NOT EXISTS ticket_comments (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id   INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  comment     TEXT NOT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ticket_comments_ticket (ticket_id),
  KEY idx_ticket_comments_user (user_id),
  CONSTRAINT fk_ticket_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id),
  CONSTRAINT fk_ticket_comments_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- INCIDENT TIMELINE
CREATE TABLE IF NOT EXISTS incident_timeline (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  action      VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_incident_timeline_incident (incident_id),
  KEY idx_incident_timeline_user (user_id),
  CONSTRAINT fk_incident_timeline_incident FOREIGN KEY (incident_id) REFERENCES incidents(id),
  CONSTRAINT fk_incident_timeline_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ATTACHMENTS
CREATE TABLE IF NOT EXISTS attachments (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_type  VARCHAR(50) NOT NULL, -- 'ticket' or 'incident'
  record_id    INT UNSIGNED NOT NULL,
  filename     VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type    VARCHAR(100) NOT NULL,
  size         INT UNSIGNED NOT NULL,
  file_path    VARCHAR(500) NOT NULL,
  uploaded_by  INT UNSIGNED NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_attachments_record (record_type, record_id),
  KEY idx_attachments_uploaded_by (uploaded_by),
  CONSTRAINT fk_attachments_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  type         VARCHAR(100) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  message      TEXT NOT NULL,
  resource_type VARCHAR(50) NULL,
  resource_id  INT UNSIGNED NULL,
  is_read      TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user (user_id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  action        VARCHAR(100) NOT NULL,
  user_id       INT UNSIGNED NULL,
  resource_type VARCHAR(50) NULL,
  resource_id   INT UNSIGNED NULL,
  -- In Supabase this was JSON; here we store as TEXT (e.g. JSON string)
  details       TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_user (user_id),
  KEY idx_audit_logs_resource (resource_type, resource_id),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- MAINTENANCE DATA
CREATE TABLE IF NOT EXISTS maintenance_data (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  key_name    VARCHAR(100) NOT NULL UNIQUE,
  value_json  TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

