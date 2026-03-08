ALTER TABLE doctors ADD COLUMN IF NOT EXISTS enabled_templates TEXT[] DEFAULT ARRAY['SOAP Notes'];
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS default_template TEXT DEFAULT 'SOAP Notes';
UPDATE clinics SET regional_language = 'Tamil' WHERE regional_language IS NULL;
INSERT INTO note_templates (name, description, is_system, sections, clinic_id)
VALUES
('SOAP Detailed', 'Extended SOAP with HPI and ROS', true, '["hpi","ros","physical_exam","assessment","plan"]', NULL),
('General Inpatient Admission', 'Hospital admission template', true, '["presenting_complaint","history","examination","investigations","admission_diagnosis","management_plan"]', NULL),
('Oncology Consultation', 'Cancer care template', true, '["cancer_history","current_status","treatment_history","examination","assessment","plan"]', NULL),
('EKA EMR Format', 'EKA.care compatible format', true, '["chief_complaint","history","vitals","examination","diagnosis","plan"]', NULL)
ON CONFLICT DO NOTHING;