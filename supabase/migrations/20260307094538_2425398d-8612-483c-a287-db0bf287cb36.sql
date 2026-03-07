
CREATE POLICY "Auth upload patient documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'patient-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Auth read patient documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'patient-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Auth delete patient documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'patient-documents' AND auth.role() = 'authenticated');
