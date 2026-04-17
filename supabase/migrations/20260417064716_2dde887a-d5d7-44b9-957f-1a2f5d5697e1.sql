CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role app_role;
  v_clinic_id uuid;
  v_lab_id uuid;
  v_full_name text;
BEGIN
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'invited_role')::app_role,
    'admin'::app_role
  );
  v_clinic_id := (NEW.raw_user_meta_data->>'invited_clinic_id')::uuid;
  v_lab_id := (NEW.raw_user_meta_data->>'invited_lab_id')::uuid;
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  INSERT INTO public.profiles (user_id, full_name, role, clinic_id, lab_id)
  VALUES (NEW.id, v_full_name, v_role, v_clinic_id, v_lab_id);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);

  RETURN NEW;
END;
$function$;