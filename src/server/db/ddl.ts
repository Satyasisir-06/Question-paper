export const SCHEMA_DDL = `
DO $$ BEGIN
  CREATE TYPE exam_type AS ENUM ('REGULAR', 'SUPPLY', 'MID_1', 'MID_2');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE paper_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'MODERATOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) NOT NULL UNIQUE,
  start_year INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(24) NOT NULL,
  name VARCHAR(160) NOT NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  regulation_id UUID NOT NULL REFERENCES regulations(id) ON DELETE RESTRICT,
  year_of_study SMALLINT NOT NULL CHECK (year_of_study BETWEEN 1 AND 4),
  semester SMALLINT NOT NULL CHECK (semester BETWEEN 1 AND 8 AND semester IN (year_of_study * 2 - 1, year_of_study * 2)),
  is_common_first_year BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code, branch_id, regulation_id)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(160) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'MODERATOR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code VARCHAR(24) NOT NULL UNIQUE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  regulation_id UUID NOT NULL REFERENCES regulations(id) ON DELETE RESTRICT,
  year_of_study SMALLINT NOT NULL CHECK (year_of_study BETWEEN 1 AND 4),
  semester SMALLINT NOT NULL CHECK (semester BETWEEN 1 AND 8 AND semester IN (year_of_study * 2 - 1, year_of_study * 2)),
  exam_type exam_type NOT NULL,
  exam_month SMALLINT NOT NULL CHECK (exam_month BETWEEN 1 AND 12),
  exam_year SMALLINT NOT NULL CHECK (exam_year BETWEEN 2005 AND 2035),
  set_label VARCHAR(40),
  storage_key VARCHAR(300) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
  page_count INTEGER NOT NULL CHECK (page_count > 0),
  sha256_hash CHAR(64) NOT NULL,
  status paper_status NOT NULL DEFAULT 'PENDING',
  uploader_name VARCHAR(80),
  uploader_email VARCHAR(160),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  reason VARCHAR(120) NOT NULL,
  details TEXT,
  reporter_ip_hash CHAR(64) NOT NULL,
  status report_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  metadata_json JSONB NOT NULL,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_year_sem_branch ON subjects (year_of_study, semester, branch_id);
CREATE INDEX IF NOT EXISTS idx_papers_public_filter ON papers (status, year_of_study, semester, branch_id, exam_type, exam_year DESC);
CREATE INDEX IF NOT EXISTS idx_papers_sha256 ON papers (sha256_hash);
CREATE INDEX IF NOT EXISTS idx_papers_subject ON papers (subject_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
`;
