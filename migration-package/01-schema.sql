-- ============================================================
-- StethoScribe — Consolidated Schema for Self-Hosted Supabase
-- Run this in: New Supabase Project → SQL Editor
-- ============================================================
-- Order: extensions → enums → functions → tables → RLS → policies → triggers → storage
-- ============================================================

-- ---------- EXTENSIONS ----------
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'receptionist', 'lab');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- TABLES ----------
CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  logo_url text,
  letterhead_url text,
  prescription_template text DEFAULT 'standard',
  regional_language text DEFAULT 'Tamil',
  onboarding_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  registered_by_clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  type text NOT NULL DEFAULT 'external',
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  lab_id uuid REFERENCES public.labs(id) ON DELETE SET NULL,
  full_name text,
  role app_role NOT NULL DEFAULT 'admin',
  password_set boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  qualification text,
  registration_number text,
  specialty text,
  signature_url text,
  availability text DEFAULT 'online',
  default_template text DEFAULT 'SOAP Notes',
  default_template_id uuid,
  enabled_templates text[] DEFAULT ARRAY['SOAP Notes'::text],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  first_name text,
  last_name text,
  healthcare_id text,
  dob date,
  gender text,
  phone text,
  email text,
  blood_group text,
  allergies jsonb DEFAULT '[]'::jsonb,
  chronic_conditions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  created_by uuid,
  token_number int NOT NULL,
  visit_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'waiting',
  chief_complaint text,
  vitals jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  created_by uuid,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  duration_minutes int DEFAULT 15,
  reason text,
  notes text,
  status text DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  audio_url text,
  raw_transcript text,
  language_detected text,
  soap_notes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  medications jsonb DEFAULT '[]'::jsonb,
  investigations jsonb DEFAULT '[]'::jsonb,
  notes text,
  follow_up_date date,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  shared_via text NOT NULL,
  recipient text,
  shared_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.note_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinic_labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  is_preferred boolean DEFAULT false,
  added_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, lab_id)
);

CREATE TABLE IF NOT EXISTS public.lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  lab_id uuid REFERENCES public.labs(id) ON DELETE SET NULL,
  test_name text NOT NULL,
  test_category text,
  urgency text DEFAULT 'routine',
  clinical_notes text,
  status text DEFAULT 'ordered',
  ordered_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  lab_id uuid REFERENCES public.labs(id) ON DELETE SET NULL,
  lab_order_id uuid NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  actioned_prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  file_name text,
  file_url text,
  file_type text,
  ai_summary jsonb,
  extracted_text text,
  doctor_notes text,
  status text DEFAULT 'pending_review',
  uploaded_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ---------- BUSINESS FUNCTIONS ----------
CREATE OR REPLACE FUNCTION public.generate_healthcare_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_year TEXT; v_count INT; v_id TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count FROM patients
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  v_id := 'MED-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
  NEW.healthcare_id := v_id;
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role app_role; v_clinic_id uuid; v_lab_id uuid;
  v_full_name text; v_is_invited boolean; v_password_set boolean;
BEGIN
  v_is_invited := (NEW.raw_user_meta_data->>'invited_role') IS NOT NULL;
  v_role := COALESCE((NEW.raw_user_meta_data->>'invited_role')::app_role, 'admin'::app_role);
  v_clinic_id := (NEW.raw_user_meta_data->>'invited_clinic_id')::uuid;
  v_lab_id := (NEW.raw_user_meta_data->>'invited_lab_id')::uuid;
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_password_set := NOT v_is_invited;

  INSERT INTO public.profiles (user_id, full_name, role, clinic_id, lab_id, password_set)
  VALUES (NEW.id, v_full_name, v_role, v_clinic_id, v_lab_id, v_password_set);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_clinic_onboarding(
  p_clinic_name text, p_clinic_address text DEFAULT NULL, p_clinic_phone text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_clinic_id UUID; v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT clinic_id INTO v_clinic_id FROM profiles WHERE user_id = v_user_id;
  IF v_clinic_id IS NOT NULL THEN RETURN v_clinic_id; END IF;
  INSERT INTO public.clinics (name, address, phone)
  VALUES (p_clinic_name, p_clinic_address, p_clinic_phone) RETURNING id INTO v_clinic_id;
  UPDATE public.profiles SET clinic_id = v_clinic_id WHERE user_id = v_user_id;
  RETURN v_clinic_id;
END;
$$;

-- ---------- TRIGGERS ----------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS set_healthcare_id ON public.patients;
CREATE TRIGGER set_healthcare_id
  BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.generate_healthcare_id();

DROP TRIGGER IF EXISTS update_clinical_notes_updated_at ON public.clinical_notes;
CREATE TRIGGER update_clinical_notes_updated_at
  BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON public.prescriptions;
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- ENABLE RLS ON ALL TABLES ----------
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

-- ---------- RLS POLICIES ----------
-- clinics
CREATE POLICY "Anyone can insert clinics" ON public.clinics FOR INSERT WITH CHECK (true);
CREATE POLICY "Clinic members can read" ON public.clinics FOR SELECT USING (id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Admins can update clinic" ON public.clinics FOR UPDATE USING (id = get_user_clinic_id(auth.uid()));

-- labs
CREATE POLICY "labs_external_visible" ON public.labs FOR SELECT USING (type = 'external' OR clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "labs_external_anon_select" ON public.labs FOR SELECT TO anon USING (type = 'external');
CREATE POLICY "lab_users_read_own_lab" ON public.labs FOR SELECT USING (id IN (SELECT lab_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "labs_insert_authenticated" ON public.labs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "labs_update_own" ON public.labs FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()) OR registered_by_clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "labs_delete_own" ON public.labs FOR DELETE USING ((clinic_id = get_user_clinic_id(auth.uid()) OR registered_by_clinic_id = get_user_clinic_id(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

-- profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Clinic members can read clinic profiles" ON public.profiles FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Admins can update clinic profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()) OR (clinic_id IS NULL AND has_role(auth.uid(), 'admin'::app_role)));

-- user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- doctors
CREATE POLICY "Clinic members can read doctors" ON public.doctors FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Can insert doctors" ON public.doctors FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Doctors can update own" ON public.doctors FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can update clinic doctors" ON public.doctors FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- patients
CREATE POLICY "Clinic read patients" ON public.patients FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic insert patients" ON public.patients FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic update patients" ON public.patients FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Admins can delete patients" ON public.patients FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- visits
CREATE POLICY "Clinic read visits" ON public.visits FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic insert visits" ON public.visits FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic update visits" ON public.visits FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Admins can delete visits" ON public.visits FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- appointments
CREATE POLICY "clinic_appointments_select" ON public.appointments FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_appointments_insert" ON public.appointments FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_appointments_update" ON public.appointments FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_appointments_delete" ON public.appointments FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()));

-- clinical_notes
CREATE POLICY "Read notes" ON public.clinical_notes FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = clinical_notes.visit_id AND v.clinic_id = get_user_clinic_id(auth.uid())));
CREATE POLICY "Insert notes" ON public.clinical_notes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = clinical_notes.visit_id AND v.clinic_id = get_user_clinic_id(auth.uid())));
CREATE POLICY "Update notes" ON public.clinical_notes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = clinical_notes.visit_id AND v.clinic_id = get_user_clinic_id(auth.uid())));
CREATE POLICY "Admins can delete clinical notes" ON public.clinical_notes FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = clinical_notes.visit_id AND v.clinic_id = get_user_clinic_id(auth.uid()))
  AND has_role(auth.uid(), 'admin'::app_role));

-- prescriptions (PUBLIC read for shareable links via UUID)
CREATE POLICY "Read prescriptions" ON public.prescriptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = prescriptions.visit_id AND v.clinic_id = get_user_clinic_id(auth.uid())));
CREATE POLICY "public_prescription_view" ON public.prescriptions FOR SELECT USING (true);
CREATE POLICY "Insert prescriptions" ON public.prescriptions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = prescriptions.visit_id AND v.clinic_id = get_user_clinic_id(auth.uid())));
CREATE POLICY "Update prescriptions" ON public.prescriptions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = prescriptions.visit_id AND v.clinic_id = get_user_clinic_id(auth.uid())));
CREATE POLICY "Admins can delete prescriptions" ON public.prescriptions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = prescriptions.visit_id AND v.clinic_id = get_user_clinic_id(auth.uid()))
  AND has_role(auth.uid(), 'admin'::app_role));

-- document_shares
CREATE POLICY "Read shares" ON public.document_shares FOR SELECT USING (
  EXISTS (SELECT 1 FROM prescriptions p JOIN visits v ON v.id = p.visit_id
    WHERE p.id = document_shares.prescription_id AND v.clinic_id = get_user_clinic_id(auth.uid())));
CREATE POLICY "Insert shares" ON public.document_shares FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM prescriptions p JOIN visits v ON v.id = p.visit_id
    WHERE p.id = document_shares.prescription_id AND v.clinic_id = get_user_clinic_id(auth.uid())));
CREATE POLICY "Admins can delete document shares" ON public.document_shares FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM prescriptions p JOIN visits v ON v.id = p.visit_id
    WHERE p.id = document_shares.prescription_id AND v.clinic_id = get_user_clinic_id(auth.uid()))
  AND has_role(auth.uid(), 'admin'::app_role));

-- patient_documents
CREATE POLICY "clinic_documents_select" ON public.patient_documents FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_documents_insert" ON public.patient_documents FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_documents_delete" ON public.patient_documents FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()));

-- note_templates
CREATE POLICY "templates_select" ON public.note_templates FOR SELECT USING (is_system = true OR clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "templates_insert" ON public.note_templates FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

-- clinic_labs
CREATE POLICY "clinic_labs_select" ON public.clinic_labs FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_labs_insert" ON public.clinic_labs FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_labs_update" ON public.clinic_labs FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_labs_delete" ON public.clinic_labs FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()));

-- lab_orders
CREATE POLICY "clinic_lab_orders_select" ON public.lab_orders FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_orders_insert" ON public.lab_orders FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_orders_update" ON public.lab_orders FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_orders_delete" ON public.lab_orders FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "lab_users_read_orders" ON public.lab_orders FOR SELECT USING (
  lab_id IN (SELECT lab_id FROM profiles WHERE user_id = auth.uid() AND lab_id IS NOT NULL));
CREATE POLICY "lab_users_update_orders" ON public.lab_orders FOR UPDATE USING (
  lab_id IN (SELECT lab_id FROM profiles WHERE user_id = auth.uid() AND lab_id IS NOT NULL));

-- lab_results
CREATE POLICY "clinic_lab_results_select" ON public.lab_results FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_results_insert" ON public.lab_results FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_results_update" ON public.lab_results FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_lab_results_delete" ON public.lab_results FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "lab_users_read_results" ON public.lab_results FOR SELECT USING (
  lab_id IN (SELECT lab_id FROM profiles WHERE user_id = auth.uid() AND lab_id IS NOT NULL));
CREATE POLICY "lab_users_insert_results" ON public.lab_results FOR INSERT WITH CHECK (
  lab_id IN (SELECT lab_id FROM profiles WHERE user_id = auth.uid() AND lab_id IS NOT NULL));

-- ---------- STORAGE BUCKETS ----------
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-assets', 'clinic-assets', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('prescriptions', 'prescriptions', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-recordings', 'audio-recordings', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-documents', 'patient-documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('lab-results', 'lab-results', false) ON CONFLICT DO NOTHING;

-- Storage RLS
CREATE POLICY "clinic_assets_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'clinic-assets');
CREATE POLICY "clinic_assets_authenticated_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'clinic-assets');
CREATE POLICY "clinic_assets_authenticated_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'clinic-assets');
CREATE POLICY "clinic_assets_authenticated_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'clinic-assets');

CREATE POLICY "public_prescription_storage" ON storage.objects FOR SELECT USING (bucket_id = 'prescriptions');
CREATE POLICY "prescriptions_authenticated_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'prescriptions');
CREATE POLICY "prescriptions_authenticated_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'prescriptions');

CREATE POLICY "private_buckets_authenticated_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('signatures','audio-recordings','patient-documents','lab-results'))
  WITH CHECK (bucket_id IN ('signatures','audio-recordings','patient-documents','lab-results'));

-- ---------- ENABLE REALTIME ----------
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_orders;
