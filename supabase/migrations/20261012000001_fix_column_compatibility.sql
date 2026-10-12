-- Migration: 20261012000001_fix_column_compatibility.sql
-- S CAR TRAVELS PREMIUM — Pre-Flight Compatibility & Column Migration
-- Resolves ERROR 42703 (sort_order does not exist) and legacy price column names
-- Safe, non-destructive, and idempotent.

-- 1. Align destinations table: display_order -> sort_order
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'destinations' AND column_name = 'display_order'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'destinations' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.destinations RENAME COLUMN display_order TO sort_order;
    RAISE NOTICE 'Migrated public.destinations: display_order renamed to sort_order';
  ELSE
    ALTER TABLE public.destinations ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Align pricing_rules table: display_order -> sort_order
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pricing_rules' AND column_name = 'display_order'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pricing_rules' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.pricing_rules RENAME COLUMN display_order TO sort_order;
    RAISE NOTICE 'Migrated public.pricing_rules: display_order renamed to sort_order';
  ELSE
    ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 3. Align bookings table: fare columns -> price columns
DO $$
BEGIN
  -- estimated_fare_min -> estimated_min_price
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'estimated_fare_min'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'estimated_min_price'
  ) THEN
    ALTER TABLE public.bookings RENAME COLUMN estimated_fare_min TO estimated_min_price;
    RAISE NOTICE 'Migrated public.bookings: estimated_fare_min renamed to estimated_min_price';
  ELSE
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS estimated_min_price INTEGER CHECK (estimated_min_price IS NULL OR estimated_min_price >= 0);
  END IF;

  -- estimated_fare_max -> estimated_max_price
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'estimated_fare_max'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'estimated_max_price'
  ) THEN
    ALTER TABLE public.bookings RENAME COLUMN estimated_fare_max TO estimated_max_price;
    RAISE NOTICE 'Migrated public.bookings: estimated_fare_max renamed to estimated_max_price';
  ELSE
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS estimated_max_price INTEGER CHECK (estimated_max_price IS NULL OR estimated_max_price >= 0);
  END IF;

  -- final_quoted_fare -> final_agreed_price
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'final_quoted_fare'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'final_agreed_price'
  ) THEN
    ALTER TABLE public.bookings RENAME COLUMN final_quoted_fare TO final_agreed_price;
    RAISE NOTICE 'Migrated public.bookings: final_quoted_fare renamed to final_agreed_price';
  ELSE
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS final_agreed_price INTEGER CHECK (final_agreed_price IS NULL OR final_agreed_price >= 0);
  END IF;

  -- Ensure vehicle_id column exists
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id);
END $$;

-- 4. Clean up legacy triggers that conflict with atomic advisory locking
DROP TRIGGER IF EXISTS trigger_validate_single_vehicle_schedule ON public.bookings;

-- 5. Drop legacy indexes that may be bound to display_order and re-create them on sort_order
DROP INDEX IF EXISTS public.idx_destinations_active;
CREATE INDEX IF NOT EXISTS idx_destinations_active ON public.destinations(active, sort_order);

DROP INDEX IF EXISTS public.idx_pricing_rules_active;
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON public.pricing_rules(active, sort_order);
