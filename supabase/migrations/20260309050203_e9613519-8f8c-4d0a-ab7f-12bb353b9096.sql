
-- Storage policies already exist, just ensure they're there
DROP POLICY IF EXISTS "Auth upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Auth read signatures" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete signatures" ON storage.objects;

CREATE POLICY "Auth upload signatures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Auth read signatures"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signatures');

CREATE POLICY "Auth delete signatures"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signatures');
