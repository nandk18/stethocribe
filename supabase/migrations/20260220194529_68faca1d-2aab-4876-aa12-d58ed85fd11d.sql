
-- Drop index first, then move extension
DROP INDEX IF EXISTS idx_patients_name;
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
CREATE INDEX idx_patients_name ON public.patients USING gin(name extensions.gin_trgm_ops);
