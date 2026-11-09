-- InsureDesk: initial MySQL schema (MySQL 8.0.16+ — CHECK constraints are enforced).
-- Timestamps are stored in UTC as DATETIME(3); the connection time zone is fixed to +00:00.
-- Row-level rules that used to live in Postgres RLS are enforced in src/lib/actions.

CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  display_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE user_roles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role ENUM('viewer', 'editor', 'reviewer', 'admin') NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_role (user_id, role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- token_hash is the SHA-256 of the cookie value, so a leaked table cannot be replayed.
CREATE TABLE sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE insurers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_channels TEXT NULL,
  website VARCHAR(2048) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  CONSTRAINT fk_insurers_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_insurers_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE vehicle_models (
  id CHAR(36) NOT NULL PRIMARY KEY,
  brand VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,
  variant VARCHAR(255) NULL,
  powertrain ENUM('ICE', 'HEV', 'PHEV', 'BEV', 'other') NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE plans (
  id CHAR(36) NOT NULL PRIMARY KEY,
  insurer_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  insurance_type ENUM('ชั้น 1', 'ชั้น 2+', 'ชั้น 3+', 'ชั้น 2', 'ชั้น 3') NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  KEY idx_plans_insurer (insurer_id),
  CONSTRAINT fk_plans_insurer FOREIGN KEY (insurer_id) REFERENCES insurers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_plans_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_plans_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE plan_versions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  plan_id CHAR(36) NOT NULL,
  version_no INT NOT NULL,
  workflow_status ENUM('draft', 'in_review', 'published', 'archived') NOT NULL DEFAULT 'draft',
  effective_from DATE NULL,
  effective_to DATE NULL,
  verified_at DATETIME(3) NULL,
  verified_by CHAR(36) NULL,
  review_due_at DATE NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  UNIQUE KEY uq_plan_version (plan_id, version_no),
  KEY idx_plan_versions_status (workflow_status, effective_from, effective_to),
  CONSTRAINT chk_version_no CHECK (version_no > 0),
  CONSTRAINT chk_version_dates CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  CONSTRAINT fk_versions_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_versions_verified_by FOREIGN KEY (verified_by) REFERENCES users(id),
  CONSTRAINT fk_versions_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_versions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE eligibility_rules (
  id CHAR(36) NOT NULL PRIMARY KEY,
  plan_version_id CHAR(36) NOT NULL,
  scope_type ENUM('specific_model', 'all_models', 'unknown') NOT NULL DEFAULT 'specific_model',
  vehicle_model_id CHAR(36) NULL,
  min_age INT NULL,
  max_age INT NULL,
  age_basis ENUM('registration_year', 'manufacture_year') NULL,
  usage_type ENUM('private', 'commercial', 'all') NULL,
  registration_zone ENUM('all', 'bangkok_only', 'bangkok_metro', 'upcountry_only') NULL DEFAULT 'all',
  inspection_required BOOLEAN NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  KEY idx_eligibility_rules_version (plan_version_id),
  KEY idx_eligibility_rules_vehicle (vehicle_model_id),
  CONSTRAINT chk_eligibility_min_age CHECK (min_age IS NULL OR min_age >= 0),
  CONSTRAINT chk_eligibility_age CHECK (min_age IS NULL OR max_age IS NULL OR max_age >= min_age),
  CONSTRAINT fk_rules_version FOREIGN KEY (plan_version_id) REFERENCES plan_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_rules_vehicle FOREIGN KEY (vehicle_model_id) REFERENCES vehicle_models(id) ON DELETE SET NULL,
  CONSTRAINT fk_rules_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_rules_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE price_options (
  id CHAR(36) NOT NULL PRIMARY KEY,
  eligibility_rule_id CHAR(36) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  repair_type ENUM('dealer', 'garage') NOT NULL,
  price_type ENUM('starting', 'indicative', 'fixed_for_conditions', 'unknown') NOT NULL DEFAULT 'fixed_for_conditions',
  net_premium DECIMAL(12, 2) NULL,
  tax_stamp DECIMAL(12, 2) NULL,
  premium_total DECIMAL(12, 2) NULL,
  compulsory_included ENUM('included', 'excluded', 'unspecified') NOT NULL DEFAULT 'unspecified',
  sum_insured_min DECIMAL(12, 2) NULL,
  sum_insured_max DECIMAL(12, 2) NULL,
  deductible_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  deductible_terms TEXT NULL,
  driver_conditions TEXT NULL,
  valid_from DATE NULL,
  valid_to DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  KEY idx_price_options_rule (eligibility_rule_id),
  KEY idx_price_options_premium (premium_total),
  KEY idx_price_options_sum (sum_insured_min, sum_insured_max),
  CONSTRAINT chk_price_amounts CHECK (
    (net_premium IS NULL OR net_premium >= 0) AND
    (tax_stamp IS NULL OR tax_stamp >= 0) AND
    (premium_total IS NULL OR premium_total >= 0) AND
    (sum_insured_min IS NULL OR sum_insured_min >= 0) AND
    (sum_insured_max IS NULL OR sum_insured_max >= 0) AND
    deductible_amount >= 0
  ),
  CONSTRAINT chk_sum_insured_range CHECK (sum_insured_min IS NULL OR sum_insured_max IS NULL OR sum_insured_max >= sum_insured_min),
  CONSTRAINT chk_price_dates CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT fk_options_rule FOREIGN KEY (eligibility_rule_id) REFERENCES eligibility_rules(id) ON DELETE CASCADE,
  CONSTRAINT fk_options_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_options_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE coverage_types (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_coverage_code (code)
);

CREATE TABLE version_coverages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  plan_version_id CHAR(36) NOT NULL,
  coverage_type_id CHAR(36) NOT NULL,
  status ENUM('covered', 'not_covered', 'optional', 'unknown') NOT NULL DEFAULT 'unknown',
  limit_amount DECIMAL(14, 2) NULL,
  limit_basis VARCHAR(255) NULL,
  deductible_amount DECIMAL(12, 2) NULL,
  terms TEXT NULL,
  exclusions TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_version_coverage (plan_version_id, coverage_type_id),
  KEY idx_version_coverages_type (coverage_type_id),
  CONSTRAINT chk_version_coverage_amounts CHECK (
    (limit_amount IS NULL OR limit_amount >= 0) AND (deductible_amount IS NULL OR deductible_amount >= 0)
  ),
  CONSTRAINT fk_coverages_version FOREIGN KEY (plan_version_id) REFERENCES plan_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_coverages_type FOREIGN KEY (coverage_type_id) REFERENCES coverage_types(id) ON DELETE CASCADE
);

CREATE TABLE option_coverage_overrides (
  id CHAR(36) NOT NULL PRIMARY KEY,
  price_option_id CHAR(36) NOT NULL,
  coverage_type_id CHAR(36) NOT NULL,
  status ENUM('covered', 'not_covered', 'optional', 'unknown') NOT NULL,
  limit_amount DECIMAL(14, 2) NULL,
  limit_basis VARCHAR(255) NULL,
  deductible_amount DECIMAL(12, 2) NULL,
  terms TEXT NULL,
  exclusions TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_option_coverage (price_option_id, coverage_type_id),
  CONSTRAINT chk_override_amounts CHECK (
    (limit_amount IS NULL OR limit_amount >= 0) AND (deductible_amount IS NULL OR deductible_amount >= 0)
  ),
  CONSTRAINT fk_overrides_option FOREIGN KEY (price_option_id) REFERENCES price_options(id) ON DELETE CASCADE,
  CONSTRAINT fk_overrides_type FOREIGN KEY (coverage_type_id) REFERENCES coverage_types(id) ON DELETE CASCADE
);

CREATE TABLE source_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  plan_version_id CHAR(36) NOT NULL,
  source_type ENUM('policy_schedule', 'rate_sheet', 'brochure', 'endorsement', 'manual_note', 'other') NOT NULL DEFAULT 'rate_sheet',
  storage_path VARCHAR(1024) NOT NULL,
  source_url VARCHAR(2048) NULL,
  title VARCHAR(255) NOT NULL,
  file_size INT NULL,
  mime_type VARCHAR(255) NULL,
  page_reference VARCHAR(255) NULL,
  received_at DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by CHAR(36) NULL,
  KEY idx_source_docs_version (plan_version_id),
  CONSTRAINT fk_documents_version FOREIGN KEY (plan_version_id) REFERENCES plan_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  actor_id CHAR(36) NULL,
  actor_name VARCHAR(255) NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  reason TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_logs_entity (entity_type, entity_id),
  KEY idx_audit_logs_created (created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);
