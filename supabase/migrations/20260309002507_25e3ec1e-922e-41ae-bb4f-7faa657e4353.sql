
-- Allow admins to delete patients
CREATE POLICY "Admins can delete patients"
ON public.patients
FOR DELETE
TO authenticated
USING (
  clinic_id = get_user_clinic_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to delete visits (for cascade)
CREATE POLICY "Admins can delete visits"
ON public.visits
FOR DELETE
TO authenticated
USING (
  clinic_id = get_user_clinic_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to delete clinical_notes (for cascade)
CREATE POLICY "Admins can delete clinical notes"
ON public.clinical_notes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM visits v
    WHERE v.id = clinical_notes.visit_id
    AND v.clinic_id = get_user_clinic_id(auth.uid())
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to delete prescriptions (for cascade)
CREATE POLICY "Admins can delete prescriptions"
ON public.prescriptions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM visits v
    WHERE v.id = prescriptions.visit_id
    AND v.clinic_id = get_user_clinic_id(auth.uid())
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to delete document_shares (for cascade)
CREATE POLICY "Admins can delete document shares"
ON public.document_shares
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM prescriptions p
    JOIN visits v ON v.id = p.visit_id
    WHERE p.id = document_shares.prescription_id
    AND v.clinic_id = get_user_clinic_id(auth.uid())
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);
