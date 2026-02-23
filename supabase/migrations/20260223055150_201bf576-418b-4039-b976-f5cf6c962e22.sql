
-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add healthcare_id column
ALTER TABLE patients ADD COLUMN IF NOT EXISTS healthcare_id TEXT UNIQUE;

-- Add first_name and last_name columns
ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Backfill from existing name column
UPDATE patients
SET first_name = SPLIT_PART(name, ' ', 1),
    last_name = CASE
      WHEN POSITION(' ' IN name) > 0
      THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
      ELSE ''
    END
WHERE first_name IS NULL;

-- Generate healthcare_id for existing patients
DO $$
DECLARE
  rec RECORD;
  v_year TEXT;
  v_count INT := 0;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  FOR rec IN SELECT id FROM patients WHERE healthcare_id IS NULL ORDER BY created_at ASC LOOP
    v_count := v_count + 1;
    UPDATE patients SET healthcare_id = 'MED-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0') WHERE id = rec.id;
  END LOOP;
END $$;

-- Create trigger function for auto-generating healthcare_id
CREATE OR REPLACE FUNCTION generate_healthcare_id()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INT;
  v_id TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count FROM patients
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  v_id := 'MED-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
  NEW.healthcare_id := v_id;
  
  -- Auto-fill first_name and last_name from name
  IF NEW.first_name IS NULL AND NEW.name IS NOT NULL THEN
    NEW.first_name := SPLIT_PART(NEW.name, ' ', 1);
    NEW.last_name := CASE
      WHEN POSITION(' ' IN NEW.name) > 0
      THEN SUBSTRING(NEW.name FROM POSITION(' ' IN NEW.name) + 1)
      ELSE ''
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS set_healthcare_id ON patients;
CREATE TRIGGER set_healthcare_id
BEFORE INSERT ON patients
FOR EACH ROW EXECUTE FUNCTION generate_healthcare_id();

-- Index for DOB search
CREATE INDEX IF NOT EXISTS idx_patients_dob ON patients(clinic_id, dob);

-- Index for healthcare_id
CREATE INDEX IF NOT EXISTS idx_patients_hid ON patients(healthcare_id);

-- Index for last name fuzzy search
CREATE INDEX IF NOT EXISTS idx_patients_lastname ON patients USING gin(last_name gin_trgm_ops);

-- Index for name fuzzy search
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients USING gin(name gin_trgm_ops);
