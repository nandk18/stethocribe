
-- Lab results: doctor's clinical response and link to generated prescription
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS doctor_notes TEXT,
  ADD COLUMN IF NOT EXISTS actioned_prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL;

-- Labs become global; type + verification metadata
ALTER TABLE public.labs
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registered_by_clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;

-- Constrain type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'labs_type_check'
  ) THEN
    ALTER TABLE public.labs
      ADD CONSTRAINT labs_type_check CHECK (type IN ('internal','external'));
  END IF;
END$$;

-- Allow external labs to have no owning clinic
ALTER TABLE public.labs ALTER COLUMN clinic_id DROP NOT NULL;

-- Clinic <-> external lab linking
CREATE TABLE IF NOT EXISTS public.clinic_labs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  is_preferred BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id, lab_id)
);

ALTER TABLE public.clinic_labs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_labs_select" ON public.clinic_labs;
CREATE POLICY "clinic_labs_select" ON public.clinic_labs
  FOR SELECT USING (clinic_id = public.get_user_clinic_id(auth.uid()));

DROP POLICY IF EXISTS "clinic_labs_insert" ON public.clinic_labs;
CREATE POLICY "clinic_labs_insert" ON public.clinic_labs
  FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

DROP POLICY IF EXISTS "clinic_labs_delete" ON public.clinic_labs;
CREATE POLICY "clinic_labs_delete" ON public.clinic_labs
  FOR DELETE USING (clinic_id = public.get_user_clinic_id(auth.uid()));

DROP POLICY IF EXISTS "clinic_labs_update" ON public.clinic_labs;
CREATE POLICY "clinic_labs_update" ON public.clinic_labs
  FOR UPDATE USING (clinic_id = public.get_user_clinic_id(auth.uid()));

-- Replace existing labs RLS so external labs are globally visible
DROP POLICY IF EXISTS "clinic_labs_select" ON public.labs;
DROP POLICY IF EXISTS "clinic_labs_insert" ON public.labs;
DROP POLICY IF EXISTS "clinic_labs_update" ON public.labs;
DROP POLICY IF EXISTS "clinic_labs_delete" ON public.labs;
DROP POLICY IF EXISTS "labs_external_visible" ON public.labs;
DROP POLICY IF EXISTS "labs_insert" ON public.labs;
DROP POLICY IF EXISTS "labs_update_own" ON public.labs;
DROP POLICY IF EXISTS "labs_delete_own" ON public.labs;

CREATE POLICY "labs_external_visible" ON public.labs
  FOR SELECT
  USING (
    type = 'external'
    OR clinic_id = public.get_user_clinic_id(auth.uid())
  );

-- Anonymous can also see external labs (for the public /register-lab directory if needed later)
DROP POLICY IF EXISTS "labs_external_anon_select" ON public.labs;
CREATE POLICY "labs_external_anon_select" ON public.labs
  FOR SELECT TO anon
  USING (type = 'external');

CREATE POLICY "labs_insert" ON public.labs
  FOR INSERT
  WITH CHECK (
    -- Authenticated clinic users can create internal/external labs
    (auth.uid() IS NOT NULL)
    OR
    -- Public self-registration (only external + unverified)
    (type = 'external' AND verified = false AND clinic_id IS NULL AND registered_by_clinic_id IS NULL)
  );

CREATE POLICY "labs_update_own" ON public.labs
  FOR UPDATE
  USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    OR registered_by_clinic_id = public.get_user_clinic_id(auth.uid())
  );

CREATE POLICY "labs_delete_own" ON public.labs
  FOR DELETE
  USING (
    (clinic_id = public.get_user_clinic_id(auth.uid())
     OR registered_by_clinic_id = public.get_user_clinic_id(auth.uid()))
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
