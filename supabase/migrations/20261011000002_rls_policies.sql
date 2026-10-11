-- Migration: 20261011000002_rls_policies.sql
-- S CAR TRAVELS PREMIUM — Row Level Security (RLS) Policies

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;

-- 1. VEHICLES
CREATE POLICY "Public can view vehicle specs"
  ON public.vehicles FOR SELECT
  USING (true);

CREATE POLICY "Admin can modify vehicle"
  ON public.vehicles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. DESTINATIONS
CREATE POLICY "Public can view active destinations"
  ON public.destinations FOR SELECT
  USING (active = true);

CREATE POLICY "Admin can manage destinations"
  ON public.destinations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. PRICING RULES
CREATE POLICY "Public can view active pricing rules"
  ON public.pricing_rules FOR SELECT
  USING (active = true);

CREATE POLICY "Admin can manage pricing rules"
  ON public.pricing_rules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. BLOCKED DATES
CREATE POLICY "Public can view blocked dates"
  ON public.blocked_dates FOR SELECT
  USING (end_date >= current_date);

CREATE POLICY "Admin can manage blocked dates"
  ON public.blocked_dates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. SITE SETTINGS
CREATE POLICY "Public can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage site settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. BOOKINGS (STRICT PUBLIC PROTECTION)
-- Public users CANNOT SELECT from bookings. (Prevents reading customer data)
-- Public can only INSERT pending inquiries with basic validation
CREATE POLICY "Public can insert pending booking inquiry"
  ON public.bookings FOR INSERT
  WITH CHECK (
    status = 'pending' AND
    char_length(trim(customer_name)) >= 2 AND
    char_length(trim(customer_phone)) >= 10 AND
    passengers >= 1 AND passengers <= 6
  );

-- Authenticated admins can view, confirm, update, and delete bookings
CREATE POLICY "Admin can manage all bookings"
  ON public.bookings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 7. BOOKING STATUS HISTORY
CREATE POLICY "Admin can view booking history"
  ON public.booking_status_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert booking history"
  ON public.booking_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);
