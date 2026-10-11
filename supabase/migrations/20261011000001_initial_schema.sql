-- Migration: 20261011000001_initial_schema.sql
-- S CAR TRAVELS PREMIUM — Initial Tables, Constraints, and Business Functions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- VEHICLES TABLE
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

-- DESTINATIONS TABLE
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
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRICING RULES TABLE
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
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BLOCKED DATES TABLE
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  reason TEXT NOT NULL,
  created_by TEXT DEFAULT 'Owner Srinu',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SITE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOOKINGS TABLE
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
  estimated_fare_min INTEGER CHECK (estimated_fare_min IS NULL OR estimated_fare_min >= 0),
  estimated_fare_max INTEGER CHECK (estimated_fare_max IS NULL OR estimated_fare_max >= 0),
  final_quoted_fare INTEGER CHECK (final_quoted_fare IS NULL OR final_quoted_fare >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  admin_notes TEXT,
  client_ip TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOOKING STATUS HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON public.bookings(reference_no);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_datetime ON public.bookings(pickup_datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON public.bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_destinations_active ON public.destinations(active, display_order);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON public.pricing_rules(active, display_order);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_dates ON public.blocked_dates(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_booking_history_booking_id ON public.booking_status_history(booking_id);

-- TIMESTAMP TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_vehicles_updated_at BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_destinations_updated_at BEFORE UPDATE ON public.destinations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_bookings_updated_at BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_site_settings_updated_at BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- REFERENCE GENERATOR
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_rand INT;
  v_ref TEXT;
  v_exists BOOLEAN;
BEGIN
  IF NEW.reference_no IS NULL OR trim(NEW.reference_no) = '' THEN
    v_year := to_char(now(), 'YYYY');
    LOOP
      v_rand := floor(1000 + random() * 9000)::INT;
      v_ref := 'SCT-' || v_year || '-' || v_rand;
      SELECT EXISTS(SELECT 1 FROM public.bookings WHERE reference_no = v_ref) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;
    NEW.reference_no := v_ref;
  ELSE
    NEW.reference_no := upper(trim(NEW.reference_no));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_booking_reference
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.generate_booking_reference();

-- STATUS HISTORY AUDITING TRIGGER
CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_status_history (booking_id, previous_status, new_status, changed_by, remarks)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(auth.jwt() ->> 'email', 'Customer Web Form'), 'Initial booking inquiry received');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.booking_status_history (booking_id, previous_status, new_status, changed_by, remarks)
    VALUES (NEW.id, OLD.status, NEW.status, COALESCE(auth.jwt() ->> 'email', 'Admin Portal'), COALESCE(NEW.admin_notes, 'Status updated by administrator'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_booking_status_change
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

-- SINGLE VEHICLE SCHEDULE CONFLICT CHECK
CREATE OR REPLACE FUNCTION public.validate_single_vehicle_schedule()
RETURNS TRIGGER AS $$
DECLARE
  v_req_start TIMESTAMPTZ;
  v_req_end TIMESTAMPTZ;
  v_conflict RECORD;
  v_blocked RECORD;
BEGIN
  IF NEW.status = 'confirmed' THEN
    v_req_start := NEW.pickup_datetime;
    v_req_end := COALESCE(NEW.return_datetime, NEW.pickup_datetime + interval '10 hours');

    SELECT id, reference_no, pickup_datetime, return_datetime, destination
    INTO v_conflict
    FROM public.bookings
    WHERE status = 'confirmed'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND v_req_start < COALESCE(return_datetime, pickup_datetime + interval '10 hours')
      AND v_req_end > pickup_datetime
    LIMIT 1;

    IF v_conflict.id IS NOT NULL THEN
      RAISE EXCEPTION 'CONFLICT_OVERLAPPING_CONFIRMED: Cannot confirm booking %. The sole vehicle is already reserved for confirmed trip % to % between % and %.',
        NEW.reference_no,
        v_conflict.reference_no,
        v_conflict.destination,
        v_conflict.pickup_datetime,
        COALESCE(v_conflict.return_datetime, v_conflict.pickup_datetime + interval '10 hours');
    END IF;

    SELECT start_date, end_date, reason
    INTO v_blocked
    FROM public.blocked_dates
    WHERE v_req_start::DATE <= end_date
      AND v_req_end::DATE >= start_date
    LIMIT 1;

    IF v_blocked.start_date IS NOT NULL THEN
      RAISE EXCEPTION 'CONFLICT_BLOCKED_DATE: Cannot confirm booking %. Vehicle is blocked by owner from % to % for reason: %.',
        NEW.reference_no,
        v_blocked.start_date,
        v_blocked.end_date,
        v_blocked.reason;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_single_vehicle_schedule
BEFORE INSERT OR UPDATE OF status, pickup_datetime, return_datetime ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_single_vehicle_schedule();

-- SECURE RPC FOR PUBLIC TRACKING
CREATE OR REPLACE FUNCTION public.track_booking_public(
  p_reference_no TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
  reference_no TEXT,
  customer_name TEXT,
  customer_phone_masked TEXT,
  service_type TEXT,
  trip_type TEXT,
  pickup_location TEXT,
  destination TEXT,
  pickup_datetime TIMESTAMPTZ,
  return_datetime TIMESTAMPTZ,
  passengers INTEGER,
  luggage_count INTEGER,
  estimated_fare_min INTEGER,
  estimated_fare_max INTEGER,
  final_quoted_fare INTEGER,
  status TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_clean_phone TEXT;
BEGIN
  IF p_reference_no IS NOT NULL AND trim(p_reference_no) != '' THEN
    RETURN QUERY
    SELECT 
      b.reference_no,
      b.customer_name,
      regexp_replace(b.customer_phone, '(\d{2})\d{6}(\d{2})', '\1******\2') AS customer_phone_masked,
      b.service_type,
      b.trip_type,
      b.pickup_location,
      b.destination,
      b.pickup_datetime,
      b.return_datetime,
      b.passengers,
      b.luggage_count,
      b.estimated_fare_min,
      b.estimated_fare_max,
      b.final_quoted_fare,
      b.status,
      b.admin_notes,
      b.created_at
    FROM public.bookings b
    WHERE b.reference_no = upper(trim(p_reference_no))
    LIMIT 1;
  ELSIF p_phone IS NOT NULL AND trim(p_phone) != '' THEN
    v_clean_phone := right(regexp_replace(p_phone, '\D', '', 'g'), 10);
    RETURN QUERY
    SELECT 
      b.reference_no,
      b.customer_name,
      regexp_replace(b.customer_phone, '(\d{2})\d{6}(\d{2})', '\1******\2') AS customer_phone_masked,
      b.service_type,
      b.trip_type,
      b.pickup_location,
      b.destination,
      b.pickup_datetime,
      b.return_datetime,
      b.passengers,
      b.luggage_count,
      b.estimated_fare_min,
      b.estimated_fare_max,
      b.final_quoted_fare,
      b.status,
      b.admin_notes,
      b.created_at
    FROM public.bookings b
    WHERE right(regexp_replace(b.customer_phone, '\D', '', 'g'), 10) = v_clean_phone
    ORDER BY b.created_at DESC
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
