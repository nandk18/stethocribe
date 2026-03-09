-- Drop and recreate the admin update policy to allow setting clinic_id to null (for removing staff)
DROP POLICY IF EXISTS "Admins can update clinic profiles" ON profiles;

CREATE POLICY "Admins can update clinic profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (clinic_id = get_user_clinic_id(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    (clinic_id = get_user_clinic_id(auth.uid())) OR (clinic_id IS NULL AND has_role(auth.uid(), 'admin'::app_role))
  );