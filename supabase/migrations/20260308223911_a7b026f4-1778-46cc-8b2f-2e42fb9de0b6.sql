CREATE POLICY "Clinic members can read clinic profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (clinic_id = get_user_clinic_id(auth.uid()));