-- ==============================================================================
-- S CAR TRAVELS PREMIUM — Complete Supabase PostgreSQL Schema & Security Script
-- Business: S CAR TRAVELS PREMIUM | Owner: SRINU | Phone: +91 9550641408
-- Base Hub: Kotananduru, Andhra Pradesh | Fleet: 1 White Suzuki Ertiga
-- Project Target: kakhyiikhekiuwtvspha
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PRE-FLIGHT TARGET ASSERTION (Safety Guard)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_target_ref CONSTANT TEXT := 'kakhyiikhekiuwtvspha';
  v_host TEXT;
BEGIN
  BEGIN
    v_host := current_setting('request.headers', true)::json->>'host';
  EXCEPTION WHEN OTHERS THEN
    v_host := NULL;
  END;

  IF v_host IS NOT NULL THEN
    IF v_host NOT LIKE '%' || v_target_ref || '%' THEN
      RAISE EXCEPTION 'TARGET_MISMATCH: Connection host % does not match target project %', v_host, v_target_ref;
    END IF;
  ELSE
    RAISE NOTICE 'TARGET_PROJECT_ASSERTED: Executing schema on project % (Database: %)', v_target_ref, current_database();
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. EXTENSIONS & SEQUENCES
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SEQUENCE IF NOT EXISTS public.booking_reference_seq START WITH 1001;

-- ------------------------------------------------------------------------------
-- 3. APPLICATION TABLES DEFINITIONS
-- ------------------------------------------------------------------------------

-- 3.1 VEHICLES TABLE (Strictly dedicated single-fleet White Ertiga)
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL DEFAULT 'Maruti Suzuki Ertiga (Smart Hybrid)',
  color TEXT NOT NULL DEFAULT 'Pearl Arctic White',
  registration_number TEXT NOT NULL UNIQUE DEFAULT 'AP03 CZ 4567',
  seating_capacity INTEGER NOT NULL DEFAULT 7 CHECK (seating_capacity = 7),
  fuel_type TEXT NOT NULL DEFAULT 'Petrol / Smart Hybrid',
  transmission TEXT NOT NULL DEFAULT 'Manual 5-Speed',
  air_conditioning TEXT NOT NULL DEFAULT 'Dual AC with Independent Rear Controls',
  luggage_capacity TEXT NOT NULL DEFAULT '3-4 Medium/Large Bags with 50:50 3rd row split',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'on_trip', 'unavailable')),
  last_sanitized_at TIMESTAMPTZ DEFAULT now(),
  insurance_valid_until DATE,
  fitness_valid_until DATE,
  is_sole_fleet_vehicle BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 DESTINATIONS TABLE (Ordered by sort_order)
CREATE TABLE IF NOT EXISTS public.destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_te TEXT NOT NULL,
  distance_km INTEGER NOT NULL CHECK (distance_km > 0),
  duration_hours TEXT NOT NULL,
  one_way_price_min INTEGER NOT NULL CHECK (one_way_price_min >= 0),
  round_trip_price_min INTEGER NOT NULL CHECK (round_trip_price_min >= 0),
  round_trip_price_max INTEGER NOT NULL CHECK (round_trip_price_max >= round_trip_price_min),
  image_url TEXT,
  popular BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL DEFAULT 'outstation' CHECK (category IN ('outstation', 'temple', 'local', 'sightseeing')),
  description_en TEXT,
  description_te TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.3 PRICING RULES TABLE (Ordered by sort_order)
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_te TEXT NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('package', 'per_km', 'flat', 'hourly')),
  min_price INTEGER NOT NULL CHECK (min_price >= 0),
  max_price INTEGER NOT NULL CHECK (max_price >= min_price),
  duration_hours INTEGER DEFAULT 0,
  distance_limit_km INTEGER DEFAULT 0,
  extra_km_rate NUMERIC(6,2) DEFAULT 18.00,
  fuel_included BOOLEAN NOT NULL DEFAULT false,
  tolls_included BOOLEAN NOT NULL DEFAULT false,
  driver_bata_included BOOLEAN NOT NULL DEFAULT false,
  description_en TEXT,
  description_te TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 BLOCKED DATES TABLE (Private table for vehicle maintenance & leave)
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  reason TEXT NOT NULL,
  created_by TEXT DEFAULT 'Owner Srinu',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.5 SITE SETTINGS TABLE (Global parameters)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.6 BOOKINGS TABLE (Standardized column names matching Express and React)
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL CHECK (char_length(trim(customer_name)) >= 2),
  customer_phone TEXT NOT NULL CHECK (char_length(trim(customer_phone)) >= 10),
  customer_email TEXT,
  service_type TEXT NOT NULL DEFAULT 'with_driver' CHECK (service_type IN ('with_driver', 'self_drive')),
  trip_type TEXT NOT NULL DEFAULT 'round_trip' CHECK (trip_type IN ('round_trip', 'one_way', 'local_8h', 'full_day', 'temple_tour', 'outstation')),
  pickup_location TEXT NOT NULL,
  destination TEXT NOT NULL,
  pickup_datetime TIMESTAMPTZ NOT NULL,
  return_datetime TIMESTAMPTZ CHECK (return_datetime IS NULL OR return_datetime >= pickup_datetime),
  passengers INTEGER NOT NULL DEFAULT 1 CHECK (passengers >= 1 AND passengers <= 6),
  luggage_count INTEGER NOT NULL DEFAULT 1 CHECK (luggage_count >= 0 AND luggage_count <= 8),
  special_notes TEXT,
  estimated_min_price INTEGER CHECK (estimated_min_price IS NULL OR estimated_min_price >= 0),
  estimated_max_price INTEGER CHECK (estimated_max_price IS NULL OR estimated_max_price >= 0),
  final_agreed_price INTEGER CHECK (final_agreed_price IS NULL OR final_agreed_price >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  admin_notes TEXT,
  client_ip TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 BOOKING STATUS HISTORY TABLE (Audit Trail)
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.8 ADMINS TABLE
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

-- 3.9 ADMIN OTPS TABLE
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

-- 3.10 ADMIN INVITATIONS TABLE
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

-- 3.11 ADMIN PASSWORD RESETS TABLE
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

-- 3.12 ADMIN AUDIT LOGS TABLE
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

-- 3.13 COLUMN ALIGNMENT & UPGRADE (For Pre-Existing Tables)
-- Ensures pre-existing tables from earlier migrations have updated column definitions
DO $$
BEGIN
  -- destinations: display_order -> sort_order
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'destinations' AND column_name = 'display_order')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'destinations' AND column_name = 'sort_order') THEN
    ALTER TABLE public.destinations RENAME COLUMN display_order TO sort_order;
  ELSE
    ALTER TABLE public.destinations ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- pricing_rules: display_order -> sort_order
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pricing_rules' AND column_name = 'display_order')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pricing_rules' AND column_name = 'sort_order') THEN
    ALTER TABLE public.pricing_rules RENAME COLUMN display_order TO sort_order;
  ELSE
    ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- bookings: fare columns -> price columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'estimated_fare_min')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'estimated_min_price') THEN
    ALTER TABLE public.bookings RENAME COLUMN estimated_fare_min TO estimated_min_price;
  ELSE
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS estimated_min_price INTEGER CHECK (estimated_min_price IS NULL OR estimated_min_price >= 0);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'estimated_fare_max')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'estimated_max_price') THEN
    ALTER TABLE public.bookings RENAME COLUMN estimated_fare_max TO estimated_max_price;
  ELSE
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS estimated_max_price INTEGER CHECK (estimated_max_price IS NULL OR estimated_max_price >= 0);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'final_quoted_fare')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'final_agreed_price') THEN
    ALTER TABLE public.bookings RENAME COLUMN final_quoted_fare TO final_agreed_price;
  ELSE
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS final_agreed_price INTEGER CHECK (final_agreed_price IS NULL OR final_agreed_price >= 0);
  END IF;

  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id);
END $$;

DROP TRIGGER IF EXISTS trigger_validate_single_vehicle_schedule ON public.bookings;

-- ------------------------------------------------------------------------------
-- 4. HIGH-PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON public.bookings(reference_no);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_datetime ON public.bookings(pickup_datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON public.bookings(customer_phone);
DROP INDEX IF EXISTS public.idx_destinations_active;
CREATE INDEX IF NOT EXISTS idx_destinations_active ON public.destinations(active, sort_order);
DROP INDEX IF EXISTS public.idx_pricing_rules_active;
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON public.pricing_rules(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_dates ON public.blocked_dates(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_booking_history_booking_id ON public.booking_status_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_admins_username ON public.admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);
CREATE INDEX IF NOT EXISTS idx_admin_otps_challenge ON public.admin_otps(challenge_id);
CREATE INDEX IF NOT EXISTS idx_admin_otps_admin_purpose ON public.admin_otps(admin_id, purpose);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_token ON public.admin_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_pw_resets_token ON public.admin_password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);

-- ------------------------------------------------------------------------------
-- 5. SANITIZED PUBLIC VIEWS (Zero Leakage)
-- ------------------------------------------------------------------------------

-- 5.1 Public Blocked Dates View: Strictly start_date, end_date, sanitized label
CREATE OR REPLACE VIEW public.public_blocked_dates AS
SELECT
  start_date,
  end_date,
  'Reserved / Unavailable'::TEXT AS display_status
FROM public.blocked_dates
WHERE end_date >= (now() AT TIME ZONE 'Asia/Kolkata')::DATE;

-- 5.2 Public Site Settings View: Strict key allowlist only
CREATE OR REPLACE VIEW public.public_site_settings AS
SELECT key, value
FROM public.site_settings
WHERE key IN (
  'business_name', 'tagline_en', 'tagline_te', 'owner_name', 'owner_phone',
  'whatsapp_number', 'base_location_name', 'base_location_te', 'full_address',
  'google_maps_url', 'service_hours_en', 'service_hours_te', 'extra_km_rate_min',
  'extra_km_rate_max', 'driver_bata_per_day', 'night_halt_charge', 'fuel_policy_summary',
  'self_drive_terms_en', 'self_drive_terms_te', 'privacy_notice_en', 'privacy_notice_te'
);

-- ------------------------------------------------------------------------------
-- 6. DATABASE FUNCTIONS & PROCEDURES (SECURITY DEFINER Hardened)
-- ------------------------------------------------------------------------------

-- 6.1 Timestamp update handler
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER set_vehicles_updated_at BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_destinations_updated_at ON public.destinations;
CREATE TRIGGER set_destinations_updated_at BEFORE UPDATE ON public.destinations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_pricing_rules_updated_at ON public.pricing_rules;
CREATE TRIGGER set_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_bookings_updated_at ON public.bookings;
CREATE TRIGGER set_bookings_updated_at BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER set_site_settings_updated_at BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_admins_updated_at ON public.admins;
CREATE TRIGGER set_admins_updated_at BEFORE UPDATE ON public.admins
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6.1b Last Superadmin Invariant Guard Trigger
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

-- 6.2 Collision-free booking reference generator: SCT-YYYY-XXXX (supports >9999)
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_year TEXT;
  v_seq BIGINT;
BEGIN
  IF NEW.reference_no IS NULL OR trim(NEW.reference_no) = '' THEN
    v_year := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY');
    v_seq := nextval('public.booking_reference_seq');
    NEW.reference_no := 'SCT-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
  ELSE
    NEW.reference_no := upper(trim(NEW.reference_no));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_booking_reference ON public.bookings;
CREATE TRIGGER trigger_generate_booking_reference
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.generate_booking_reference();

-- 6.3 Booking audit log trigger
CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_status_history (booking_id, previous_status, new_status, changed_by, remarks)
    VALUES (NEW.id, NULL, NEW.status, 'Customer Web Inquiry', 'Initial booking inquiry received');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.booking_status_history (booking_id, previous_status, new_status, changed_by, remarks)
    VALUES (NEW.id, OLD.status, NEW.status, COALESCE(current_setting('app.current_user', true), 'Admin Portal'), COALESCE(NEW.admin_notes, 'Status transition: ' || OLD.status || ' -> ' || NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_booking_status_change ON public.bookings;
CREATE TRIGGER trigger_log_booking_status_change
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

-- 6.4 ATOMIC CONFIRM BOOKING RPC (Advisory lock, vehicle assert, half-open overlap check, 409 error)
CREATE OR REPLACE FUNCTION public.confirm_booking_atomic(
  p_booking_id UUID DEFAULT NULL,
  p_new_status TEXT DEFAULT 'confirmed',
  p_remarks TEXT DEFAULT NULL,
  p_final_price INTEGER DEFAULT NULL,
  p_admin_user TEXT DEFAULT 'Admin',
  p_reference_no TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_booking RECORD;
  v_vehicle_id UUID;
  v_req_start TIMESTAMPTZ;
  v_req_end TIMESTAMPTZ;
  v_conflict RECORD;
  v_blocked RECORD;
BEGIN
  -- 1. Acquire transaction-level fleet advisory lock
  PERFORM pg_advisory_xact_lock(955064);

  -- 2. Verify sole fleet vehicle row exists and lock it
  SELECT id INTO v_vehicle_id FROM public.vehicles WHERE is_sole_fleet_vehicle = true FOR UPDATE;
  IF v_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'FLEET_LOCK_ERROR: Sole fleet vehicle missing from registry' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Lock and retrieve target booking row (by ID or reference_no)
  IF p_booking_id IS NOT NULL THEN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  ELSIF p_reference_no IS NOT NULL AND trim(p_reference_no) != '' THEN
    SELECT * INTO v_booking FROM public.bookings WHERE reference_no = upper(trim(p_reference_no)) FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'BOOKING_IDENTIFIER_REQUIRED: Either booking ID or reference number must be provided' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Booking does not exist' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Validate status transitions
  IF p_new_status = 'confirmed' THEN
    IF v_booking.status = 'confirmed' THEN
      -- Idempotent confirmation
      RETURN jsonb_build_object('success', true, 'booking', to_jsonb(v_booking), 'message', 'Booking is already confirmed');
    ELSIF v_booking.status != 'pending' THEN
      RAISE EXCEPTION 'INVALID_STATUS_TRANSITION: Cannot confirm booking in status "%"', v_booking.status;
    END IF;

    -- 5. Calculate effective time boundaries (half-open interval, 10h default if single-day)
    v_req_start := v_booking.pickup_datetime;
    v_req_end := COALESCE(v_booking.return_datetime, v_booking.pickup_datetime + interval '10 hours');

    -- 6. Check for overlapping CONFIRMED bookings on the Ertiga
    SELECT id, reference_no, pickup_datetime, return_datetime, destination
    INTO v_conflict
    FROM public.bookings
    WHERE status = 'confirmed'
      AND id != v_booking.id
      AND v_req_start < COALESCE(return_datetime, pickup_datetime + interval '10 hours')
      AND v_req_end > pickup_datetime
    LIMIT 1;

    IF v_conflict.id IS NOT NULL THEN
      RAISE EXCEPTION 'CONFLICT_OVERLAPPING_CONFIRMED: Overlaps with confirmed booking % to % (% to %)',
        v_conflict.reference_no,
        v_conflict.destination,
        to_char(v_conflict.pickup_datetime AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI'),
        to_char(COALESCE(v_conflict.return_datetime, v_conflict.pickup_datetime + interval '10 hours') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI');
    END IF;

    -- 7. Check for owner-blocked calendar dates
    SELECT start_date, end_date, reason
    INTO v_blocked
    FROM public.blocked_dates
    WHERE (v_req_start AT TIME ZONE 'Asia/Kolkata')::DATE <= end_date
      AND (v_req_end AT TIME ZONE 'Asia/Kolkata')::DATE >= start_date
    LIMIT 1;

    IF v_blocked.start_date IS NOT NULL THEN
      RAISE EXCEPTION 'CONFLICT_BLOCKED_DATE: Date is blocked by owner from % to % for maintenance/leave',
        v_blocked.start_date,
        v_blocked.end_date;
    END IF;
  END IF;

  -- 8. Apply status and price mutation
  PERFORM set_config('app.current_user', COALESCE(p_admin_user, 'Admin'), true);

  UPDATE public.bookings
  SET status = p_new_status,
      final_agreed_price = COALESCE(p_final_price, final_agreed_price),
      admin_notes = COALESCE(p_remarks, admin_notes),
      vehicle_id = v_vehicle_id,
      updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  RETURN jsonb_build_object('success', true, 'booking', to_jsonb(v_booking));
END;
$$;

-- 6.5 ATOMIC BLOCK DATES RPC (Shared advisory lock, conflict check, 409 error)
CREATE OR REPLACE FUNCTION public.block_dates_atomic(
  p_start_date DATE,
  p_end_date DATE,
  p_reason TEXT,
  p_admin_user TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_conflict RECORD;
  v_block_id UUID;
  v_created RECORD;
BEGIN
  -- 1. Acquire transaction-level fleet advisory lock
  PERFORM pg_advisory_xact_lock(955064);

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE: End date cannot be before start date';
  END IF;

  -- 2. Verify sole fleet vehicle row exists
  PERFORM id FROM public.vehicles WHERE is_sole_fleet_vehicle = true FOR UPDATE;

  -- 3. Check for conflict with existing confirmed customer trips
  SELECT id, reference_no, pickup_datetime, return_datetime, destination
  INTO v_conflict
  FROM public.bookings
  WHERE status = 'confirmed'
    AND (pickup_datetime AT TIME ZONE 'Asia/Kolkata')::DATE <= p_end_date
    AND (COALESCE(return_datetime, pickup_datetime + interval '10 hours') AT TIME ZONE 'Asia/Kolkata')::DATE >= p_start_date
  LIMIT 1;

  IF v_conflict.id IS NOT NULL THEN
    RAISE EXCEPTION 'CONFLICT_OVERLAPPING_CONFIRMED: Cannot block dates: Overlaps with confirmed customer booking % to % (% to %)',
      v_conflict.reference_no,
      v_conflict.destination,
      to_char(v_conflict.pickup_datetime AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI'),
      to_char(COALESCE(v_conflict.return_datetime, v_conflict.pickup_datetime + interval '10 hours') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI');
  END IF;

  -- 4. Insert blocked dates
  INSERT INTO public.blocked_dates (start_date, end_date, reason, created_by)
  VALUES (p_start_date, p_end_date, trim(p_reason), COALESCE(p_admin_user, 'Owner Srinu'))
  RETURNING * INTO v_created;

  RETURN jsonb_build_object('success', true, 'blockedDate', to_jsonb(v_created));
END;
$$;

-- 6.6 ATOMIC UNBLOCK DATES RPC
CREATE OR REPLACE FUNCTION public.unblock_dates_atomic(
  p_block_id UUID DEFAULT NULL,
  p_admin_user TEXT DEFAULT 'Owner Srinu',
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(955064);

  IF p_block_id IS NOT NULL THEN
    DELETE FROM public.blocked_dates WHERE id = p_block_id;
  ELSIF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
    DELETE FROM public.blocked_dates WHERE start_date = p_start_date AND end_date = p_end_date;
  ELSE
    RAISE EXCEPTION 'UNBLOCK_PARAM_REQUIRED: Either block ID or start/end dates must be provided';
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Blocked date removed');
END;
$$;

-- 6.7 CONCURRENCY-SAFE SUPER ADMIN BOOTSTRAP RPC
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

-- 6.8 PUBLIC BOOKING TRACKING RPC (Dual reference + phone matching, zero note leakage)
CREATE OR REPLACE FUNCTION public.track_booking_public(
  p_reference_no TEXT,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_ref TEXT;
  v_phone_digits TEXT;
  v_phone_last4 TEXT;
  v_booking RECORD;
BEGIN
  IF p_reference_no IS NULL OR trim(p_reference_no) = '' THEN
    RAISE EXCEPTION 'INVALID_PARAMS: Booking reference number is required' USING ERRCODE = 'P0001';
  END IF;

  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RAISE EXCEPTION 'INVALID_PARAMS: Customer phone verification is required' USING ERRCODE = 'P0001';
  END IF;

  v_ref := upper(trim(p_reference_no));
  v_phone_digits := right(regexp_replace(p_phone, '\D', '', 'g'), 10);
  v_phone_last4 := right(v_phone_digits, 4);

  SELECT
    reference_no,
    customer_name,
    regexp_replace(customer_phone, '(\d{2})\d{6}(\d{2})', '\1******\2') AS customer_phone,
    service_type,
    trip_type,
    pickup_location,
    destination,
    pickup_datetime,
    return_datetime,
    passengers,
    luggage_count,
    estimated_min_price,
    estimated_max_price,
    final_agreed_price,
    status,
    created_at
  INTO v_booking
  FROM public.bookings
  WHERE reference_no = v_ref
    AND (
      right(regexp_replace(customer_phone, '\D', '', 'g'), 10) = v_phone_digits
      OR right(regexp_replace(customer_phone, '\D', '', 'g'), 4) = v_phone_last4
    )
  LIMIT 1;

  IF v_booking.reference_no IS NULL THEN
    RETURN jsonb_build_object('success', false, 'booking', NULL, 'error', 'No booking found matching reference and phone');
  END IF;

  RETURN jsonb_build_object('success', true, 'booking', to_jsonb(v_booking));
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7.1 Public Catalogs (Read-Only)
DROP POLICY IF EXISTS "Public can view vehicle specs" ON public.vehicles;
CREATE POLICY "Public can view vehicle specs" ON public.vehicles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view active destinations" ON public.destinations;
CREATE POLICY "Public can view active destinations" ON public.destinations FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Public can view active pricing rules" ON public.pricing_rules;
CREATE POLICY "Public can view active pricing rules" ON public.pricing_rules FOR SELECT USING (active = true);

-- 7.2 Service Role Full Access (All tables)
DROP POLICY IF EXISTS "Service role full access on vehicles" ON public.vehicles;
CREATE POLICY "Service role full access on vehicles" ON public.vehicles FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on destinations" ON public.destinations;
CREATE POLICY "Service role full access on destinations" ON public.destinations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on pricing_rules" ON public.pricing_rules;
CREATE POLICY "Service role full access on pricing_rules" ON public.pricing_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on blocked_dates" ON public.blocked_dates;
CREATE POLICY "Service role full access on blocked_dates" ON public.blocked_dates FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on site_settings" ON public.site_settings;
CREATE POLICY "Service role full access on site_settings" ON public.site_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on bookings" ON public.bookings;
CREATE POLICY "Service role full access on bookings" ON public.bookings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on booking_status_history" ON public.booking_status_history;
CREATE POLICY "Service role full access on booking_status_history" ON public.booking_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);

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

-- ------------------------------------------------------------------------------
-- 8. DATABASE PRIVILEGES & LEAST-PRIVILEGE GRANTS
-- ------------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Public can view catalog tables and sanitized views
GRANT SELECT ON public.public_blocked_dates TO anon, authenticated;
GRANT SELECT ON public.public_site_settings TO anon, authenticated;
GRANT SELECT ON public.vehicles TO anon, authenticated;
GRANT SELECT ON public.destinations TO anon, authenticated;
GRANT SELECT ON public.pricing_rules TO anon, authenticated;

-- Service role has full elevated access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ------------------------------------------------------------------------------
-- 9. IDEMPOTENT STARTER SEED DATA (Non-Destructive)
-- ------------------------------------------------------------------------------

-- 9.1 Sole Fleet Vehicle (Starter Specifications - Pending Owner Plate Confirmation)
INSERT INTO public.vehicles (
  model_name, color, registration_number, seating_capacity,
  fuel_type, transmission, air_conditioning, luggage_capacity,
  features, status, last_sanitized_at, insurance_valid_until, fitness_valid_until
)
VALUES (
  'Maruti Suzuki Ertiga (Smart Hybrid)',
  'Pearl Arctic White',
  'AP03 CZ 4567',
  7,
  'Petrol / Smart Hybrid',
  'Manual 5-Speed',
  'Dual AC with Independent Rear Controls',
  '3-4 Medium/Large Bags with 50:50 3rd row split',
  '[
    "Dual Air Conditioning (Roof vents for 2nd & 3rd row)",
    "6+1 Passenger Seating Capacity",
    "Push-back Ergonomic Captain Comfort",
    "Foldable 3rd Row for Extra Large Luggage",
    "Smart Hybrid Fuel Efficiency",
    "High Ground Clearance for Indian Roads & Ghats",
    "Full Sanitization before every trip",
    "Music System with Bluetooth & Mobile Fast Charging"
  ]'::jsonb,
  'available',
  now(),
  '2027-04-15',
  '2028-06-30'
)
ON CONFLICT (registration_number) DO NOTHING;

-- 9.2 Site Settings (Starter Values - Idempotent, Never Overwrites Custom Values)
INSERT INTO public.site_settings (key, value, description) VALUES
  ('business_name', 'S CAR TRAVELS PREMIUM', 'Official Business Name'),
  ('tagline_en', 'Mee Prayanam… Maa Badhyata!', 'Brand Tagline in English/Hinglish'),
  ('tagline_te', 'మీ ప్రయాణం… మా బాధ్యత!', 'Brand Tagline in Telugu'),
  ('owner_name', 'SRINU', 'Proprietor Name'),
  ('owner_phone', '9550641408', 'Direct Calling Number'),
  ('whatsapp_number', '919550641408', 'WhatsApp Direct Line with Country Code'),
  ('base_location_name', 'Kotananduru, Andhra Pradesh', 'Primary Operating Base'),
  ('base_location_te', 'కోటనందూరు, ఆంధ్రప్రదేశ్', 'Primary Base in Telugu'),
  ('full_address', 'Near Main Bus Stand, Kotananduru, Kakinada District, Andhra Pradesh - 533407, India', 'Physical Address'),
  ('google_maps_url', 'https://maps.google.com/?q=Kotananduru,Andhra+Pradesh', 'Google Maps Link'),
  ('service_hours_en', '24/7 Advance Bookings | Call Support 6:00 AM – 10:30 PM', 'Business Operational Hours'),
  ('service_hours_te', '24/7 ముందస్తు బుకింగ్‌లు | కాల్ సపోర్ట్ ఉదయం 6:00 - రాత్రి 10:30', 'Business Operational Hours Telugu'),
  ('extra_km_rate_min', '18', 'Extra kilometre starting charge in INR'),
  ('extra_km_rate_max', '20', 'Extra kilometre maximum charge in INR'),
  ('driver_bata_per_day', '400', 'Driver day allowance in INR'),
  ('night_halt_charge', '500', 'Driver night halt allowance in INR'),
  ('fuel_policy_summary', 'Tolls, parking, and permit charges are additional as per actuals unless agreed. Rates are preliminary estimates subject to owner confirmation.', 'Fuel & Toll Policy'),
  ('self_drive_terms_en', 'Self-drive rental requires valid Original Driving Licence (min 2 yrs experience), Aadhaar Card verification, and refundable security deposit of ₹3,000. Fuel is at customer expense. Speed limit 80 km/h.', 'Self-Drive Mandatory Terms'),
  ('self_drive_terms_te', 'సెల్ఫ్-డ్రైవ్ అద్దెకు ఒరిజినల్ డ్రైవింగ్ లైసెన్స్ (కనీసం 2 సం. అనుభవం), ఆధార్ కార్డు ధృవీకరణ మరియు రూ. 3,000 రీఫండబుల్ సెక్యూరిటీ డిపాజిట్ తప్పనిసరి. ఇంధనం కస్టమర్ భరించాలి.', 'Self-Drive Terms Telugu'),
  ('privacy_notice_en', 'We collect your name, phone number, and journey details solely to coordinate vehicle bookings. Your private data is never sold or shared with third parties.', 'Privacy Policy English'),
  ('privacy_notice_te', 'వాహన బుకింగ్‌ల నిర్వహణ కోసమే మేము మీ పేరు, ఫోన్ నంబర్ మరియు ప్రయాణ వివరాలను సేకరిస్తాము. మీ వ్యక్తిగత డేటా సురక్షితంగా ఉంటుంది.', 'Privacy Policy Telugu')
ON CONFLICT (key) DO NOTHING;

-- 9.3 Pricing Rules (Starter Packages - Preserves sort_order, Never Overwrites)
INSERT INTO public.pricing_rules (
  rule_code, title_en, title_te, rate_type, min_price, max_price,
  duration_hours, distance_limit_km, extra_km_rate, fuel_included,
  tolls_included, driver_bata_included, description_en, description_te, sort_order
) VALUES
  (
    'LOCAL_8H_80KM',
    'Local Rental with Driver (8 Hours / 80 KM)',
    'స్థానిక ప్రయాణం డ్రైవర్‌తో (8 గంటలు / 80 కి.మీ)',
    'package',
    2500,
    3000,
    8,
    80,
    18.00,
    true,
    false,
    true,
    'Perfect for local shopping, family functions, hospital visits, or Tuni/Annavaram nearby transit. Extra km at ₹18-20/km.',
    'స్థానిక షాపింగ్, ఫంక్షన్లు, ఆసుపత్రి లేదా తుని/అన్నవరం సమీప ప్రాంతాల కోసం ఉత్తమమైనది. అదనపు కి.మీ రూ.18-20.',
    1
  ),
  (
    'FULL_DAY_12H',
    'Full Day with Driver (10–12 Hours)',
    'పూర్తి రోజు డ్రైవర్‌తో (10–12 గంటలు)',
    'package',
    3000,
    3500,
    12,
    150,
    18.00,
    false,
    false,
    true,
    'Ideal for marriage functions, temple day circuits, and extended day travel. Base vehicle hire + driver; fuel as per usage.',
    'పెళ్ళిళ్ళు, శుభకార్యాలు మరియు రోజంతా ప్రయాణాల కోసం అనుకూలం. బేస్ అద్దె + డ్రైవర్ బాటా.',
    2
  ),
  (
    'SELF_DRIVE_24H',
    'Self-Drive Rental (24 Hours)',
    'సెల్ఫ్-డ్రైవ్ అద్దె (24 గంటలు)',
    'package',
    3000,
    3500,
    24,
    300,
    15.00,
    false,
    false,
    false,
    'Private family freedom. Subject to DL verification, Aadhaar check, refundable security deposit of ₹3,000, and clean driving record.',
    'మీ కుటుంబంతో స్వేచ్ఛగా ప్రయాణించండి. ఒరిజినల్ డ్రైవింగ్ లైసెన్స్, ఆధార్ మరియు సెక్యూరిటీ డిపాజిట్ అవసరం.',
    3
  ),
  (
    'EXTRA_KM_DRIVER',
    'Extra Kilometre with Driver',
    'డ్రైవర్‌తో అదనపు కిలోమీటర్',
    'per_km',
    18,
    20,
    0,
    1,
    18.00,
    true,
    false,
    false,
    'Applicable beyond included package kilometre limits for with-driver journeys.',
    'ప్యాకేజీ పరిమితి దాటిన తర్వాత ప్రతి అదనపు కిలోమీటరుకు వర్తిస్తుంది.',
    4
  )
ON CONFLICT (rule_code) DO NOTHING;

-- 9.4 Destinations (Starter List - Preserves sort_order, Never Overwrites)
INSERT INTO public.destinations (
  key_slug, name_en, name_te, distance_km, duration_hours,
  one_way_price_min, round_trip_price_min, round_trip_price_max,
  popular, category, description_en, description_te, sort_order
) VALUES
  (
    'kakinada',
    'Kakinada',
    'కాకినాడ',
    65,
    '1.5 hrs',
    2000,
    4000,
    5000,
    true,
    'outstation',
    'Smart City, Coringa Wildlife Sanctuary, Kakinada Beach, Hope Island, Port transit.',
    'స్మార్ట్ సిటీ, కోరింగ అభయారణ్యం, కాకినాడ బీచ్, పోర్ట్ ప్రయాణాలు.',
    1
  ),
  (
    'rajahmundry',
    'Rajahmundry',
    'రాజమండ్రి',
    80,
    '2 hrs',
    2500,
    4500,
    5500,
    true,
    'outstation',
    'Cultural capital on River Godavari, Kotilingala Ghat, Airport connectivity, ISKCON temple.',
    'గోదావరి తీర నగరం, కోటిలింగాల ఘాట్, విమానాశ్రయం, ఇస్కాన్ ఆలయం.',
    2
  ),
  (
    'visakhapatnam',
    'Visakhapatnam (Vizag)',
    'విశాఖపట్నం (వైజాగ్)',
    125,
    '2.5 hrs',
    3500,
    5500,
    6500,
    true,
    'outstation',
    'City of Destiny, RK Beach, Kailasagiri, Submarine Museum, Vizag International Airport & Railway.',
    'సిటీ ఆఫ్ డెస్టినీ, ఆర్కే బీచ్, కైలాసగిరి, సబ్‌మెరైన్ మ్యూజియం, ఎయిర్‌పోర్ట్ కనెక్టివిటీ.',
    3
  ),
  (
    'vijayawada',
    'Vijayawada',
    'విజయవాడ',
    240,
    '4.5 hrs',
    5500,
    10000,
    11500,
    true,
    'outstation',
    'Kanaka Durga Temple, Prakasam Barrage, Bhavani Island, Commercial transit hub.',
    'కనకదుర్గమ్మ ఆలయం, ప్రకాశం బ్యారేజ్, భవానీ ఐలాండ్, వ్యాపార ప్రయాణాలు.',
    4
  ),
  (
    'tirupati',
    'Tirupati (Balaji Darshan)',
    'తిరుపతి (శ్రీ బాలాజీ దర్శనం)',
    580,
    '10 hrs',
    12000,
    24000,
    27000,
    true,
    'temple',
    'Sacred Tirumala Venkateswara Swamy Temple pilgrimage, Alipiri, Padmavathi Temple, comfortable AC drive.',
    'తిరుమల శ్రీ వేంకటేశ్వర స్వామి దివ్య దర్శనం, పద్మావతి అమ్మవారి ఆలయం, సుఖవంతమైన ప్రయాణం.',
    5
  ),
  (
    'araku',
    'Araku Valley',
    'అరకు లోయ',
    210,
    '4.5 hrs',
    4500,
    9000,
    11000,
    true,
    'outstation',
    'Coffee plantations, Borra Caves, Chaparai waterfalls, misty hill station route with expert driver.',
    'కాఫీ తోటలు, బొర్రా గుహలు, చాపరాయి జలపాతం, ఆహ్లాదకరమైన ఘాట్ రోడ్ ప్రయాణం.',
    6
  ),
  (
    'annavaram',
    'Annavaram Temple',
    'అన్నవరం శ్రీ సత్యనారాయణ స్వామి',
    22,
    '30 mins',
    1000,
    1800,
    2200,
    true,
    'temple',
    'Famous Ratnagiri hilltop shrine of Sri Veera Venkata Satyanarayana Swamy, Vratham ceremonies.',
    'రత్నగిరి కొండపై శ్రీ వీర వేంకట సత్యనారాయణ స్వామి వ్రతాలు మరియు దర్శనం.',
    7
  ),
  (
    'draksharamam',
    'Draksharamam Pancharama',
    'ద్రాక్షారామం పంచారామ క్షేత్రం',
    95,
    '2.5 hrs',
    2800,
    4800,
    5800,
    true,
    'temple',
    'Dakshina Kasi, ancient Bhimeswara Swamy Jyotirlinga and Manikyamba Shakti Peetham temple tour.',
    'దక్షిణ కాశీ, శ్రీ భీమేశ్వర స్వామి జ్యోతిర్లింగం మరియు మాణిక్యాంబ శక్తిపీఠం.',
    8
  )
ON CONFLICT (key_slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
