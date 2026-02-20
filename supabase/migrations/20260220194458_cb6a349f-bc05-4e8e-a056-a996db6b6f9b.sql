
-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'receptionist');

-- Clinics
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  letterhead_url TEXT,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name TEXT,
  role app_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_clinic_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT clinic_id FROM public.profiles WHERE user_id = _user_id LIMIT 1 $$;

-- Doctors
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  qualification TEXT,
  registration_number TEXT,
  specialty TEXT,
  signature_url TEXT,
  availability TEXT DEFAULT 'online',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- Patients
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  dob DATE,
  gender TEXT,
  phone TEXT,
  email TEXT,
  blood_group TEXT,
  allergies JSONB DEFAULT '[]'::jsonb,
  chronic_conditions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Visits
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id),
  visit_date DATE DEFAULT CURRENT_DATE,
  token_number INT NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','in_progress','completed','cancelled')),
  chief_complaint TEXT,
  vitals JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- Clinical notes
CREATE TABLE public.clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.visits(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) NOT NULL,
  raw_transcript TEXT,
  soap_notes JSONB DEFAULT '{}'::jsonb,
  language_detected TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

-- Prescriptions
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.visits(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) NOT NULL,
  medications JSONB DEFAULT '[]'::jsonb,
  investigations JSONB DEFAULT '[]'::jsonb,
  follow_up_date DATE,
  notes TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Document shares
CREATE TABLE public.document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE CASCADE NOT NULL,
  shared_via TEXT NOT NULL,
  recipient TEXT,
  shared_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Clinic members can read" ON public.clinics FOR SELECT USING (id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Anyone can insert clinics" ON public.clinics FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update clinic" ON public.clinics FOR UPDATE USING (id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Clinic members can read doctors" ON public.doctors FOR SELECT USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Can insert doctors" ON public.doctors FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Doctors can update own" ON public.doctors FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Clinic read patients" ON public.patients FOR SELECT USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic insert patients" ON public.patients FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic update patients" ON public.patients FOR UPDATE USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Clinic read visits" ON public.visits FOR SELECT USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic insert visits" ON public.visits FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic update visits" ON public.visits FOR UPDATE USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Read notes" ON public.clinical_notes FOR SELECT USING (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));
CREATE POLICY "Insert notes" ON public.clinical_notes FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));
CREATE POLICY "Update notes" ON public.clinical_notes FOR UPDATE USING (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));

CREATE POLICY "Read prescriptions" ON public.prescriptions FOR SELECT USING (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));
CREATE POLICY "Insert prescriptions" ON public.prescriptions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));
CREATE POLICY "Update prescriptions" ON public.prescriptions FOR UPDATE USING (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));

CREATE POLICY "Read shares" ON public.document_shares FOR SELECT USING (EXISTS (SELECT 1 FROM public.prescriptions p JOIN public.visits v ON v.id = p.visit_id WHERE p.id = prescription_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));
CREATE POLICY "Insert shares" ON public.document_shares FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.prescriptions p JOIN public.visits v ON v.id = p.visit_id WHERE p.id = prescription_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime on visits
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;

-- Indexes
CREATE INDEX idx_patients_clinic ON public.patients(clinic_id);
CREATE INDEX idx_patients_name ON public.patients USING gin(name gin_trgm_ops);
CREATE INDEX idx_visits_clinic_date ON public.visits(clinic_id, visit_date);
CREATE INDEX idx_visits_patient ON public.visits(patient_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-assets', 'clinic-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('prescriptions', 'prescriptions', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-recordings', 'audio-recordings', false);

CREATE POLICY "Auth upload clinic assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'clinic-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Public read clinic assets" ON storage.objects FOR SELECT USING (bucket_id = 'clinic-assets');
CREATE POLICY "Auth upload signatures" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'signatures' AND auth.role() = 'authenticated');
CREATE POLICY "Auth read signatures" ON storage.objects FOR SELECT USING (bucket_id = 'signatures' AND auth.role() = 'authenticated');
CREATE POLICY "Auth upload prescriptions" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'prescriptions' AND auth.role() = 'authenticated');
CREATE POLICY "Auth read prescriptions" ON storage.objects FOR SELECT USING (bucket_id = 'prescriptions' AND auth.role() = 'authenticated');
CREATE POLICY "Auth upload audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-recordings' AND auth.role() = 'authenticated');
CREATE POLICY "Auth read audio" ON storage.objects FOR SELECT USING (bucket_id = 'audio-recordings' AND auth.role() = 'authenticated');
