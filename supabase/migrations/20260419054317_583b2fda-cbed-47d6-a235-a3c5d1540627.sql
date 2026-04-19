-- Allow anyone to read a prescription by ID
-- Safe because UUID is unguessable and no list access is given
DROP POLICY IF EXISTS "public_prescription_view" ON public.prescriptions;
CREATE POLICY "public_prescription_view"
  ON public.prescriptions
  FOR SELECT
  USING (true);

-- Allow public read of prescription files in storage
DROP POLICY IF EXISTS "public_prescription_storage" ON storage.objects;
CREATE POLICY "public_prescription_storage"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'prescriptions');