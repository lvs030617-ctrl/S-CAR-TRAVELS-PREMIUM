-- ==============================================================================
-- S CAR TRAVELS PREMIUM — Complete Supabase PostgreSQL Schema & Security Script
-- Business: S CAR TRAVELS PREMIUM | Owner: SRINU | Phone: +91 9550641408
-- Base Hub: Kotananduru, Andhra Pradesh | Fleet: 1 White Suzuki Ertiga
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. TABLE DEFINITIONS
-- ------------------------------------------------------------------------------

-- 2.1 VEHICLES TABLE (Strictly dedicated single-fleet White Ertiga)
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

-- 2.2 DESTINATIONS TABLE
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

-- 2.3 PRICING RULES TABLE
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

-- 2.4 BLOCKED DATES TABLE (For vehicle maintenance, oil service, leave)
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  reason TEXT NOT NULL,
  created_by TEXT DEFAULT 'Owner Srinu',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 SITE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.6 BOOKINGS TABLE
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

-- 2.7 BOOKING STATUS HISTORY (Audit Trail)
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON public.bookings(reference_no);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_datetime ON public.bookings(pickup_datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON public.bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_destinations_active ON public.destinations(active, display_order);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON public.pricing_rules(active, display_order);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_dates ON public.blocked_dates(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_booking_history_booking_id ON public.booking_status_history(booking_id);

-- ------------------------------------------------------------------------------
-- 4. DATABASE FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------------------------

-- 4.1 Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- 4.2 Auto-generate Booking Reference: SCT-YYYY-XXXX
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

DROP TRIGGER IF EXISTS trigger_generate_booking_reference ON public.bookings;
CREATE TRIGGER trigger_generate_booking_reference
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.generate_booking_reference();

-- 4.3 Audit status changes automatically
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

DROP TRIGGER IF EXISTS trigger_log_booking_status_change ON public.bookings;
CREATE TRIGGER trigger_log_booking_status_change
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

-- 4.4 PREVENT OVERLAPPING CONFIRMED BOOKINGS ON THE SINGLE VEHICLE
CREATE OR REPLACE FUNCTION public.validate_single_vehicle_schedule()
RETURNS TRIGGER AS $$
DECLARE
  v_req_start TIMESTAMPTZ;
  v_req_end TIMESTAMPTZ;
  v_conflict RECORD;
  v_blocked RECORD;
BEGIN
  -- Only validate schedule conflicts when confirming or if already confirmed
  IF NEW.status = 'confirmed' THEN
    v_req_start := NEW.pickup_datetime;
    -- Default to 10 hours if single-day return is omitted
    v_req_end := COALESCE(NEW.return_datetime, NEW.pickup_datetime + interval '10 hours');

    -- 1. Check for overlapping CONFIRMED trips
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

    -- 2. Check for blocked calendar dates
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

DROP TRIGGER IF EXISTS trigger_validate_single_vehicle_schedule ON public.bookings;
CREATE TRIGGER trigger_validate_single_vehicle_schedule
BEFORE INSERT OR UPDATE OF status, pickup_datetime, return_datetime ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_single_vehicle_schedule();

-- 4.5 SECURE RPC: Public Tracking with Phone Masking
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

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Default Deny on all tables. Public access is strictly scoped.
-- ------------------------------------------------------------------------------

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;

-- 5.1 VEHICLES POLICIES
-- Anyone can view the single fleet vehicle details
CREATE POLICY "Public can view vehicle specs"
  ON public.vehicles FOR SELECT
  USING (true);

-- Only authenticated admins can modify vehicle specs
CREATE POLICY "Admin can modify vehicle"
  ON public.vehicles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5.2 DESTINATIONS POLICIES
-- Public can view active destinations
CREATE POLICY "Public can view active destinations"
  ON public.destinations FOR SELECT
  USING (active = true);

-- Admins can view and edit all destinations
CREATE POLICY "Admin can manage destinations"
  ON public.destinations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5.3 PRICING RULES POLICIES
-- Public can view active pricing packages
CREATE POLICY "Public can view active pricing rules"
  ON public.pricing_rules FOR SELECT
  USING (active = true);

-- Admins can manage all pricing rules
CREATE POLICY "Admin can manage pricing rules"
  ON public.pricing_rules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5.4 BLOCKED DATES POLICIES
-- Public can view blocked dates to see schedule availability
CREATE POLICY "Public can view blocked dates"
  ON public.blocked_dates FOR SELECT
  USING (end_date >= current_date);

-- Admins can manage blocked dates
CREATE POLICY "Admin can manage blocked dates"
  ON public.blocked_dates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5.5 SITE SETTINGS POLICIES
-- Public can view settings (phone, contact, taglines)
CREATE POLICY "Public can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

-- Admins can manage site settings
CREATE POLICY "Admin can manage site settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5.6 BOOKINGS POLICIES (STRICT PROTECTION)
-- Public CANNOT view all customer bookings!
-- Public can only submit a new inquiry with status = 'pending'
CREATE POLICY "Public can insert pending booking inquiry"
  ON public.bookings FOR INSERT
  WITH CHECK (
    status = 'pending' AND
    char_length(trim(customer_name)) >= 2 AND
    char_length(trim(customer_phone)) >= 10 AND
    passengers >= 1 AND passengers <= 6
  );

-- Admins have full access to view, confirm, update, and delete bookings
CREATE POLICY "Admin can manage all bookings"
  ON public.bookings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5.7 BOOKING STATUS HISTORY POLICIES
-- Only authenticated admins can read audit history
CREATE POLICY "Admin can view booking history"
  ON public.booking_status_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert booking history"
  ON public.booking_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. INITIAL SEED DATA
-- ------------------------------------------------------------------------------

-- 6.1 Sole Fleet Vehicle (White Suzuki Ertiga)
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

-- 6.2 Site Settings
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
  ('extra_km_rate_min', '18', 'Extra kilometre starting charge in INR'),
  ('extra_km_rate_max', '20', 'Extra kilometre maximum charge in INR'),
  ('driver_bata_per_day', '400', 'Driver day allowance in INR'),
  ('night_halt_charge', '500', 'Driver night halt allowance in INR'),
  ('fuel_policy_summary', 'Tolls, parking, and permit charges are additional as per actuals unless agreed. Rates are preliminary estimates subject to owner confirmation.', 'Fuel & Toll Policy'),
  ('self_drive_terms_en', 'Self-drive rental requires valid Original Driving Licence (min 2 yrs experience), Aadhaar Card verification, and refundable security deposit of ₹3,000. Fuel is at customer expense. Speed limit 80 km/h.', 'Self-Drive Mandatory Terms')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 6.3 Pricing Rules
INSERT INTO public.pricing_rules (
  rule_code, title_en, title_te, rate_type, min_price, max_price,
  duration_hours, distance_limit_km, extra_km_rate, fuel_included,
  tolls_included, driver_bata_included, description_en, description_te, display_order
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

-- 6.4 Destinations
INSERT INTO public.destinations (
  key_slug, name_en, name_te, distance_km, duration_hours,
  one_way_price_min, round_trip_price_min, round_trip_price_max,
  popular, category, description_en, description_te, display_order
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
