CREATE POLICY "Public prescription view by id"
  ON prescriptions
  FOR SELECT
  TO anon
  USING (true);