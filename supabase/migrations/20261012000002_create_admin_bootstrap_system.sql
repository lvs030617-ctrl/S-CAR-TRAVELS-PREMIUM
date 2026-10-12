-- Migration: 20261012000002_create_admin_bootstrap_system.sql
-- S CAR TRAVELS PREMIUM — Admin Authentication & Bootstrap Procedure
-- Idempotent & Non-Destructive (Creates admins tables and bootstrap RPC)

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create public.admins table
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'invited')),
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create supporting 2FA OTP, invitation, reset, and audit tables
CREATE TABLE IF NOT EXISTS public.admin_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id TEXT UNIQUE NOT NULL,
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login' CHECK (purpose IN ('login', 'password_reset')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  resend_available_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  client_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
  invited_by UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,
  challenge_id TEXT NOT NULL,
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  client_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  actor_username TEXT NOT NULL,
  target_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  target_email TEXT,
  target_username TEXT,
  details_json JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_admins_username ON public.admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);
CREATE INDEX IF NOT EXISTS idx_admin_otps_challenge ON public.admin_otps(challenge_id);
CREATE INDEX IF NOT EXISTS idx_admin_otps_admin_purpose ON public.admin_otps(admin_id, purpose);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_token ON public.admin_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_pw_resets_token ON public.admin_password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);

-- 5. Row Level Security (RLS)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on admins" ON public.admins;
CREATE POLICY "Service role full access on admins" ON public.admins FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on admin_otps" ON public.admin_otps;
CREATE POLICY "Service role full access on admin_otps" ON public.admin_otps FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on admin_invitations" ON public.admin_invitations;
CREATE POLICY "Service role full access on admin_invitations" ON public.admin_invitations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on admin_password_resets" ON public.admin_password_resets;
CREATE POLICY "Service role full access on admin_password_resets" ON public.admin_password_resets FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on admin_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "Service role full access on admin_audit_logs" ON public.admin_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Trigger: Protect Last Super Admin from deletion/demotion
CREATE OR REPLACE FUNCTION public.protect_last_superadmin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_superadmin_count INTEGER;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'superadmin' AND OLD.is_active = 1) OR
     (TG_OP = 'UPDATE' AND OLD.role = 'superadmin' AND OLD.is_active = 1 AND (NEW.role != 'superadmin' OR NEW.is_active = 0 OR NEW.status = 'disabled')) THEN
    
    SELECT COUNT(*) INTO v_superadmin_count
    FROM public.admins
    WHERE role = 'superadmin' AND is_active = 1 AND status = 'active' AND id != OLD.id;

    IF v_superadmin_count = 0 THEN
      RAISE EXCEPTION 'CANNOT_MUTATE_LAST_SUPERADMIN: Operation forbidden: At least one active Super Administrator must remain.' USING ERRCODE = 'P0003';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_last_superadmin ON public.admins;
CREATE TRIGGER trigger_protect_last_superadmin
BEFORE UPDATE OR DELETE ON public.admins
FOR EACH ROW EXECUTE FUNCTION public.protect_last_superadmin();

-- 7. Super Admin Bootstrap RPC
CREATE OR REPLACE FUNCTION public.bootstrap_initial_superadmin(
  p_username TEXT,
  p_email TEXT,
  p_password_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- Acquire dedicated admin hierarchy advisory lock
  PERFORM pg_advisory_xact_lock(955065);

  -- Abort safely if any active superadmin already exists
  IF EXISTS (SELECT 1 FROM public.admins WHERE role = 'superadmin' AND is_active = 1) THEN
    RETURN false;
  END IF;

  INSERT INTO public.admins (username, email, password_hash, role, is_active, status, token_version)
  VALUES (lower(trim(p_username)), lower(trim(p_email)), p_password_hash, 'superadmin', 1, 'active', 1);

  RETURN true;
END;
$$;

-- 8. Restrict Privileges
REVOKE ALL ON FUNCTION public.bootstrap_initial_superadmin(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_initial_superadmin(TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
