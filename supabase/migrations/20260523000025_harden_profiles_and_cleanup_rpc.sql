-- Migration: Harden profiles table – protect sensitive columns
-- Purpose: Add a BEFORE UPDATE trigger on public.profiles that prevents
--          non-superadmin users from modifying critical governance columns
--          (is_super_admin, status, must_reset_password) via direct client mutations.
--          Only superadmins or SECURITY DEFINER RPCs may modify these columns.

-- =============================================================================
-- 1. Trigger function: protect_profiles_sensitive_columns
-- =============================================================================
CREATE OR REPLACE FUNCTION public.protect_profiles_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_is_super_admin boolean := false;
  _caller_id uuid;
BEGIN
  -- Allow internal / service-role callers (they have no jwt claim)
  IF current_setting('request.jwt.claims', true) IS NULL
     OR current_setting('request.jwt.claims', true) = '' THEN
    RETURN NEW;
  END IF;

  -- Resolve the caller's user ID from the JWT
  _caller_id := (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid;

  -- Check if the caller is a superadmin
  SELECT is_super_admin INTO _caller_is_super_admin
    FROM public.profiles
   WHERE id = _caller_id;

  -- Superadmins can modify everything
  IF _caller_is_super_admin IS TRUE THEN
    RETURN NEW;
  END IF;

  -- For normal users: block changes to sensitive columns
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    RAISE EXCEPTION 'No tienes permiso para modificar is_super_admin.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'No tienes permiso para modificar status.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Allow users to reset their OWN must_reset_password to false (password update flow)
  IF NEW.must_reset_password IS DISTINCT FROM OLD.must_reset_password THEN
    IF _caller_id = OLD.id AND NEW.must_reset_password = false THEN
      -- This is allowed: user is resetting their own flag after password change
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'No tienes permiso para modificar must_reset_password.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. Attach trigger (idempotent: drop if exists first)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_protect_profiles_sensitive_columns ON public.profiles;

CREATE TRIGGER trg_protect_profiles_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_sensitive_columns();

-- =============================================================================
-- 3. Audit log entry
-- =============================================================================
COMMENT ON FUNCTION public.protect_profiles_sensitive_columns() IS
  'Zero Trust guard: prevents non-superadmin users from escalating privileges '
  'by directly modifying is_super_admin, status, or must_reset_password columns '
  'on the profiles table. Superadmins and SECURITY DEFINER RPCs bypass this check.';
