-- Allow admins to update profiles of members in their clinic
CREATE POLICY "Admins can update clinic profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  clinic_id = get_user_clinic_id(auth.uid())
  AND has_role(auth.uid(), 'admin')
);

-- Allow admins to update doctors in their clinic
CREATE POLICY "Admins can update clinic doctors"
ON public.doctors
FOR UPDATE
TO authenticated
USING (
  clinic_id = get_user_clinic_id(auth.uid())
  AND has_role(auth.uid(), 'admin')
);