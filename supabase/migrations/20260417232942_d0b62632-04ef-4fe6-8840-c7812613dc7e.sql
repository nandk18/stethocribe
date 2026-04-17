
DROP POLICY IF EXISTS "labs_insert" ON public.labs;

CREATE POLICY "labs_insert_authenticated" ON public.labs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
