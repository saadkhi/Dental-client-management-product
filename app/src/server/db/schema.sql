-- =============================================================
-- MDS Clinic (Mehmood Dental Surgeon) — Neon Postgres Schema
-- Run via: node scripts/migrate.js
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  role                 TEXT NOT NULL CHECK (role IN ('ADMIN','RECEPTIONIST','DOCTOR')),
  password_hash        TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  -- SCHEMA-FIX CONFIG-02: force password change on first login or after admin reset
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── DOCTORS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  full_name       TEXT NOT NULL,
  specialization  TEXT NOT NULL,
  license_number  TEXT NOT NULL UNIQUE,
  phone           TEXT NOT NULL,
  email           TEXT NOT NULL,
  profile_image   TEXT,
  bio             TEXT,
  color           TEXT NOT NULL DEFAULT '#1e3a8a',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_availability (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  doctor_id    TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(doctor_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS doctor_schedule_exceptions (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  doctor_id    TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  start_time   TEXT,
  end_time     TEXT,
  reason       TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT false,
  -- SCHEMA-01: prevent duplicate exception rows for the same doctor+date
  UNIQUE(doctor_id, date)
);

-- ─── PATIENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id                        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_number            TEXT NOT NULL UNIQUE,
  first_name                TEXT NOT NULL,
  last_name                 TEXT NOT NULL,
  date_of_birth             DATE NOT NULL,
  gender                    TEXT NOT NULL CHECK (gender IN ('MALE','FEMALE','OTHER')),
  phone                     TEXT NOT NULL,
  alternate_phone           TEXT,
  email                     TEXT,
  address                   TEXT,
  emergency_contact_name    TEXT,
  emergency_contact_phone   TEXT,
  emergency_contact_relation TEXT,
  blood_group               TEXT NOT NULL DEFAULT 'UNKNOWN',
  occupation                TEXT,
  allergies                 TEXT,   -- denormalised summary string for fast scanning
  general_medical_notes     TEXT,
  status                    TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  -- Soft-delete: NULL = active, non-NULL = in trash. Hard-delete removes the row entirely.
  deleted_at                TIMESTAMPTZ,
  deleted_by                TEXT,           -- name of the user who moved to trash
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_phone  ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_name   ON patients(lower(first_name), lower(last_name));
CREATE INDEX IF NOT EXISTS idx_patients_number ON patients(patient_number);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);

-- Atomic sequence counters
CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
INSERT INTO counters(name, value) VALUES ('patient_seq', 100), ('rx_seq', 100)
  ON CONFLICT (name) DO NOTHING;

-- ─── PATIENT MEDICAL SUB-ENTITIES ─────────────────────────────
CREATE TABLE IF NOT EXISTS patient_medical_history (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition    TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESOLVED','CHRONIC')),
  diagnosed_at DATE,
  notes        TEXT,
  created_by   TEXT NOT NULL DEFAULT 'System',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_med_history_patient ON patient_medical_history(patient_id);

CREATE TABLE IF NOT EXISTS patient_allergies (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  allergen   TEXT NOT NULL,
  reaction   TEXT,
  severity   TEXT NOT NULL DEFAULT 'HIGH' CHECK (severity IN ('LOW','MEDIUM','HIGH','SEVERE')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON patient_allergies(patient_id);

CREATE TABLE IF NOT EXISTS patient_medications (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  dosage        TEXT NOT NULL,
  frequency     TEXT NOT NULL,
  route         TEXT NOT NULL DEFAULT 'Oral',
  start_date    DATE,
  end_date      DATE,
  status        TEXT NOT NULL DEFAULT 'CURRENT' CHECK (status IN ('CURRENT','PAST','DISCONTINUED')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_medications_patient ON patient_medications(patient_id);

CREATE TABLE IF NOT EXISTS dental_history (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number INTEGER NOT NULL CHECK (tooth_number BETWEEN 1 AND 52),
  condition    TEXT NOT NULL CHECK (condition IN (
                 'HEALTHY','CARIES','FILLED','CROWN','ROOT_CANAL',
                 'MISSING','IMPLANT','EXTRACTION_INDICATED','FRACTURED','BRIDGE')),
  diagnosis    TEXT,
  treatment    TEXT,
  notes        TEXT,
  created_by   TEXT NOT NULL DEFAULT 'System',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_id, tooth_number)
);
CREATE INDEX IF NOT EXISTS idx_dental_patient ON dental_history(patient_id);

-- ─── APPOINTMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id              TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id               TEXT NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  appointment_date        DATE NOT NULL,
  start_time              TEXT NOT NULL,
  end_time                TEXT NOT NULL,
  -- SCHEMA-02: end time must be strictly after start time
  CONSTRAINT chk_appt_time_order CHECK (start_time < end_time),
  duration_minutes        INTEGER NOT NULL DEFAULT 30,
  appointment_type        TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
                            'SCHEDULED','CONFIRMED','ARRIVED','IN_PROGRESS',
                            'COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED')),
  reason                  TEXT,
  notes                   TEXT,
  original_appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  reschedule_reason       TEXT,
  created_by              TEXT NOT NULL DEFAULT 'Receptionist',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appt_date     ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appt_doctor   ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appt_patient  ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_status   ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appt_date_doc ON appointments(appointment_date, doctor_id);

-- ─── VISITS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  appointment_id    TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id         TEXT NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  visit_date        DATE NOT NULL,
  chief_complaint   TEXT,
  clinical_notes    TEXT,
  diagnosis         TEXT,
  treatment_summary TEXT,
  follow_up_date    DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_date    ON visits(visit_date);

-- ─── TREATMENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS treatments (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id       TEXT NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  appointment_id  TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  visit_id        TEXT REFERENCES visits(id) ON DELETE SET NULL,
  treatment_type  TEXT,
  treatment_name  TEXT NOT NULL,
  tooth_number    INTEGER,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  cost            NUMERIC(10,2),
  start_date      DATE,
  completion_date DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_doctor  ON treatments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_treatments_status  ON treatments(status);

-- ─── PRESCRIPTIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rx_number         TEXT NOT NULL UNIQUE,
  patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id         TEXT NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  visit_id          TEXT REFERENCES visits(id) ON DELETE SET NULL,
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis         TEXT,
  chief_complaint   TEXT,
  instructions      TEXT,
  follow_up_notes   TEXT,
  follow_up_days    INTEGER,
  status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED')),
  -- BUG-05: structured allergy snapshot at time of prescription for safety record-keeping
  allergy_warnings  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rx_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_rx_doctor  ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_rx_date    ON prescriptions(prescription_date);

CREATE TABLE IF NOT EXISTS prescription_items (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_name   TEXT NOT NULL,
  strength        TEXT,
  dosage          TEXT NOT NULL,
  frequency       TEXT NOT NULL,
  duration        TEXT NOT NULL,
  route           TEXT NOT NULL DEFAULT 'Oral',
  instructions    TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rx_items_prescription ON prescription_items(prescription_id);

-- ─── REMINDERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('CONFIRMATION','REMINDER','FOLLOWUP')),
  channel        TEXT NOT NULL CHECK (channel IN ('SMS','EMAIL','WHATSAPP')),
  scheduled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at        TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED')),
  message        TEXT NOT NULL,
  recipient      TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reminders_patient     ON appointment_reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_reminders_appointment ON appointment_reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status      ON appointment_reminders(status);

-- ─── CLINIC SETTINGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_settings (
  id                           TEXT PRIMARY KEY DEFAULT 'clinic-default',
  clinic_name                  TEXT NOT NULL DEFAULT '',
  tagline                      TEXT,
  logo_url                     TEXT,
  address_line1                TEXT,
  address_line2                TEXT,
  city                         TEXT,
  state                        TEXT,
  zip_code                     TEXT,
  phone                        TEXT NOT NULL DEFAULT '',
  alternate_phone              TEXT,
  emergency_phone              TEXT,
  emergency_helpline           TEXT,
  email                        TEXT NOT NULL DEFAULT '',
  website                      TEXT,
  registration_number          TEXT,
  tax_id                       TEXT,
  print_header                 TEXT,
  print_footer                 TEXT,
  default_appointment_duration INTEGER NOT NULL DEFAULT 30,
  default_slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  working_hours_start          TEXT NOT NULL DEFAULT '09:00',
  working_hours_end            TEXT NOT NULL DEFAULT '18:00',
  active_days                  INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  currency                     TEXT NOT NULL DEFAULT '$',
  currency_symbol              TEXT NOT NULL DEFAULT '$',
  timezone                     TEXT NOT NULL DEFAULT 'UTC',
  reminder_templates           JSONB NOT NULL DEFAULT '{
    "confirmation": "Dear {{patientName}}, your appointment with Dr. {{doctorName}} is confirmed for {{appointmentDate}} at {{appointmentTime}}.",
    "reminder": "Reminder: You have an appointment tomorrow at {{appointmentTime}} with Dr. {{doctorName}}.",
    "followup": "Hello {{patientName}}, please contact us if you need any follow-up care."
  }'::jsonb,
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Ensure exactly one row exists
INSERT INTO clinic_settings(id) VALUES ('clinic-default') ON CONFLICT (id) DO NOTHING;

-- ─── AUDIT LOGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- SCHEMA-03: stores the real UUID of the acting user (not hard-coded 'system')
  user_id     TEXT,
  user_name   TEXT NOT NULL DEFAULT 'System',
  user_role   TEXT NOT NULL DEFAULT 'SYSTEM',
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  entity_name TEXT,
  old_values  TEXT,
  new_values  TEXT,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_user        ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_logs(created_at DESC);

-- ─── MIGRATION HELPERS (idempotent column additions) ──────────────────────
-- Safe to run on an existing database — adds new columns only if missing.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'allergy_warnings'
  ) THEN
    ALTER TABLE prescriptions ADD COLUMN allergy_warnings TEXT;
  END IF;
END $$;

-- Add UNIQUE constraint to doctor_schedule_exceptions if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'doctor_schedule_exceptions'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%doctor_id%date%'
  ) THEN
    BEGIN
      ALTER TABLE doctor_schedule_exceptions ADD CONSTRAINT uq_exception_doctor_date UNIQUE (doctor_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ─── PATIENT X-RAYS ───────────────────────────────────────────
-- Stores metadata for X-ray images uploaded via Vercel Blob.
-- The actual binary is held in Vercel Blob storage; blob_url is the
-- permanent opaque URL returned by the Blob SDK after upload.
CREATE TABLE IF NOT EXISTS patient_xrays (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,        -- original file name (shown in UI)
  blob_url     TEXT NOT NULL UNIQUE, -- Vercel Blob URL
  content_type TEXT NOT NULL,        -- MIME type, e.g. image/jpeg
  size_bytes   INTEGER NOT NULL,
  notes        TEXT,                 -- optional label, e.g. "Left bitewing"
  taken_at     DATE,                 -- date the X-ray was taken (may differ from upload date)
  uploaded_by  TEXT NOT NULL,        -- user name of uploader
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xrays_patient    ON patient_xrays(patient_id);
CREATE INDEX IF NOT EXISTS idx_xrays_created_at ON patient_xrays(created_at DESC);

-- Migration helper: add patient_xrays table on existing databases
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'patient_xrays'
  ) THEN
    CREATE TABLE patient_xrays (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      filename     TEXT NOT NULL,
      blob_url     TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      size_bytes   INTEGER NOT NULL,
      notes        TEXT,
      taken_at     DATE,
      uploaded_by  TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_xrays_patient    ON patient_xrays(patient_id);
    CREATE INDEX idx_xrays_created_at ON patient_xrays(created_at DESC);
  END IF;
END $$;

-- ─── MIGRATION HELPERS — soft-delete columns ─────────────────────────────────
-- Idempotent: safe to run on existing databases that pre-date this change.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE patients ADD COLUMN deleted_at  TIMESTAMPTZ;
    ALTER TABLE patients ADD COLUMN deleted_by  TEXT;
  END IF;
END $$;

-- Partial index so active-patient queries skip all trashed rows at the index level.
CREATE INDEX IF NOT EXISTS idx_patients_not_deleted ON patients(created_at DESC) WHERE deleted_at IS NULL;
