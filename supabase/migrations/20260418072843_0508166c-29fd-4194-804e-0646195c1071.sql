-- Add password_set flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing non-lab users as already having password set (backfill)
UPDATE public.profiles
  SET password_set = true
  WHERE role != 'lab';

-- Mark existing lab users with a non-null full_name as already set up too
-- (so we don't lock out anyone already actively using the system)
UPDATE public.profiles
  SET password_set = true
  WHERE role = 'lab' AND full_name IS NOT NULL AND full_name != '';

-- Update handle_new_user to set password_set correctly for invited vs self-registered users
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
  v_is_invited boolean;
  v_password_set boolean;
BEGIN
  v_is_invited := (NEW.raw_user_meta_data->>'invited_role') IS NOT NULL;

  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'invited_role')::app_role,
    'admin'::app_role
  );
  v_clinic_id := (NEW.raw_user_meta_data->>'invited_clinic_id')::uuid;
  v_lab_id := (NEW.raw_user_meta_data->>'invited_lab_id')::uuid;
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  -- Invited users must set password via /accept-invite; self-registered are good to go
  v_password_set := NOT v_is_invited;

  INSERT INTO public.profiles (user_id, full_name, role, clinic_id, lab_id, password_set)
  VALUES (NEW.id, v_full_name, v_role, v_clinic_id, v_lab_id, v_password_set);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);

  RETURN NEW;
END;
$function$;