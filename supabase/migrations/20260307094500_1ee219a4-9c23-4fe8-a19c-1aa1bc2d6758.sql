
-- Regional language and prescription template on clinics
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS regional_language TEXT DEFAULT 'Tamil';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS prescription_template TEXT DEFAULT 'standard';

-- Document uploads table
CREATE TABLE IF NOT EXISTS patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic_documents_select" ON patient_documents
  FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_documents_insert" ON patient_documents
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_documents_delete" ON patient_documents
  FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Note templates table
CREATE TABLE IF NOT EXISTS note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  sections JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE note_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_select" ON note_templates
  FOR SELECT USING (is_system = true OR clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "templates_insert" ON note_templates
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

-- Default template memory per doctor
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS default_template_id UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_documents_visit ON patient_documents(visit_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_note_templates_system ON note_templates(is_system);
