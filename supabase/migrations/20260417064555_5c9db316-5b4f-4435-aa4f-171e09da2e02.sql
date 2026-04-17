-- 1. Add 'lab' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lab';

-- 2. Add lab_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lab_id UUID;

-- 3. Labs table
CREATE TABLE IF NOT EXISTS public.labs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_labs_select" ON public.labs
  FOR SELECT USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_labs_insert" ON public.labs
  FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_labs_update" ON public.labs
  FOR UPDATE USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_labs_delete" ON public.labs
  FOR DELETE USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Lab users can read their own lab record
CREATE POLICY "lab_users_read_own_lab" ON public.labs
  FOR SELECT USING (
    id IN (SELECT lab_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- 4. FK from profiles.lab_id to labs.id (added after labs table exists)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_lab_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE SET NULL;

-- 5. Lab orders table
CREATE TABLE IF NOT EXISTS public.lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  lab_id UUID REFERENCES public.labs(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL,
  test_category TEXT,
  clinical_notes TEXT,
  urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine','urgent','stat')),
  status TEXT DEFAULT 'ordered' CHECK (status IN ('ordered','received','processing','completed','cancelled')),
  ordered_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;

-- Clinic staff: full access to their clinic's orders
CREATE POLICY "clinic_lab_orders_select" ON public.lab_orders
  FOR SELECT USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_orders_insert" ON public.lab_orders
  FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_orders_update" ON public.lab_orders
  FOR UPDATE USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_orders_delete" ON public.lab_orders
  FOR DELETE USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Lab users: read & update orders assigned to their lab
CREATE POLICY "lab_users_read_orders" ON public.lab_orders
  FOR SELECT USING (
    lab_id IN (SELECT lab_id FROM public.profiles WHERE user_id = auth.uid() AND lab_id IS NOT NULL)
  );
CREATE POLICY "lab_users_update_orders" ON public.lab_orders
  FOR UPDATE USING (
    lab_id IN (SELECT lab_id FROM public.profiles WHERE user_id = auth.uid() AND lab_id IS NOT NULL)
  );

-- 6. Lab results table
CREATE TABLE IF NOT EXISTS public.lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id UUID NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  lab_id UUID REFERENCES public.labs(id) ON DELETE SET NULL,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  extracted_text TEXT,
  ai_summary JSONB,
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review','reviewed','actioned')),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

-- Clinic staff: full access to their clinic's results
CREATE POLICY "clinic_lab_results_select" ON public.lab_results
  FOR SELECT USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_results_insert" ON public.lab_results
  FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_results_update" ON public.lab_results
  FOR UPDATE USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_results_delete" ON public.lab_results
  FOR DELETE USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Lab users: insert results for their assigned orders + read them back
CREATE POLICY "lab_users_insert_results" ON public.lab_results
  FOR INSERT WITH CHECK (
    lab_id IN (SELECT lab_id FROM public.profiles WHERE user_id = auth.uid() AND lab_id IS NOT NULL)
  );
CREATE POLICY "lab_users_read_results" ON public.lab_results
  FOR SELECT USING (
    lab_id IN (SELECT lab_id FROM public.profiles WHERE user_id = auth.uid() AND lab_id IS NOT NULL)
  );

-- 7. Storage bucket for lab results (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lab-results', 'lab-results', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: clinic staff can read/write their clinic folder
CREATE POLICY "clinic_lab_results_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'lab-results'
    AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
  );
CREATE POLICY "clinic_lab_results_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'lab-results'
    AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
  );

-- Lab users can upload to any clinic folder for their assigned orders
CREATE POLICY "lab_users_upload_results" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'lab-results'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND lab_id IS NOT NULL
    )
  );
CREATE POLICY "lab_users_read_uploaded_results" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'lab-results'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND lab_id IS NOT NULL
    )
  );

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_lab_orders_clinic ON public.lab_orders(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_visit ON public.lab_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON public.lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_lab ON public.lab_orders(lab_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_results_order ON public.lab_results(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_doctor ON public.lab_results(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_labs_clinic ON public.labs(clinic_id);