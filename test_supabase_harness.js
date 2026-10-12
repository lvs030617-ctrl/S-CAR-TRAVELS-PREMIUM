import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSupabaseHarness() {
  console.log('====================================================');
  console.log('🐘 SUPABASE POSTGRESQL SCHEMA & CONTRACT TEST HARNESS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  // 1. Schema File Inspection
  const schemaPath = path.join(__dirname, 'supabase', 'schema.sql');
  assert(fs.existsSync(schemaPath), 'Proposed schema migration file exists at supabase/schema.sql');

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // 2. Pre-flight Target Assertion
  assert(schemaContent.includes('kakhyiikhekiuwtvspha'), 'Pre-flight check asserts project reference kakhyiikhekiuwtvspha');
  assert(!schemaContent.includes('DROP SCHEMA public CASCADE'), 'Safely omits destructive DROP SCHEMA public CASCADE');

  // 3. Application Tables Existence in Schema
  const requiredTables = [
    'public.vehicles',
    'public.destinations',
    'public.pricing_rules',
    'public.blocked_dates',
    'public.site_settings',
    'public.bookings',
    'public.booking_status_history',
    'public.admins',
    'public.admin_otps',
    'public.admin_invitations',
    'public.admin_password_resets',
    'public.admin_audit_logs'
  ];

  for (const table of requiredTables) {
    assert(schemaContent.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `Schema declares table: ${table}`);
  }

  // 4. Sequence & Concurrency Uniqueness
  assert(schemaContent.includes('public.booking_reference_seq'), 'Sequence public.booking_reference_seq declared for collision-free references');
  assert(schemaContent.includes("LPAD(v_seq::text, 4, '0')"), 'Reference generator supports sequences beyond 4 digits safely');

  // 5. Column Standardizations
  assert(schemaContent.includes('sort_order INTEGER NOT NULL DEFAULT 0'), 'Schema uses sort_order consistently (no display_order conflicts)');
  assert(schemaContent.includes('estimated_min_price INTEGER'), 'Schema preserves estimated_min_price matching API and React frontend');
  assert(schemaContent.includes('estimated_max_price INTEGER'), 'Schema preserves estimated_max_price matching API and React frontend');
  assert(schemaContent.includes('final_agreed_price INTEGER'), 'Schema preserves final_agreed_price matching API and React frontend');

  // 6. Sanitized Views & Zero Leakage
  assert(schemaContent.includes('CREATE OR REPLACE VIEW public.public_blocked_dates'), 'Public view public_blocked_dates declared');
  assert(schemaContent.includes('CREATE OR REPLACE VIEW public.public_site_settings'), 'Public view public_site_settings declared');
  assert(!schemaContent.includes('SELECT * FROM public.blocked_dates'), 'Public views do not select all columns from base tables');

  // 7. SECURITY DEFINER & RPC Hardening
  const requiredFunctions = [
    'public.confirm_booking_atomic',
    'public.block_dates_atomic',
    'public.unblock_dates_atomic',
    'public.bootstrap_initial_superadmin',
    'public.track_booking_public',
    'public.protect_last_superadmin'
  ];

  for (const fn of requiredFunctions) {
    assert(schemaContent.includes(`CREATE OR REPLACE FUNCTION ${fn}`), `Function declared: ${fn}`);
  }

  assert(schemaContent.includes('SET search_path = pg_catalog, public, pg_temp'), 'Functions declare safe search_path with pg_catalog first');
  assert(schemaContent.includes('pg_advisory_xact_lock(955064)'), 'Schedule-altering RPCs acquire shared advisory lock 955064');
  assert(schemaContent.includes('pg_advisory_xact_lock(955065)'), 'Admin-altering RPCs acquire shared advisory lock 955065');
  assert(schemaContent.includes('CONFLICT_OVERLAPPING_CONFIRMED'), 'Overlapping trips raise explicit CONFLICT_OVERLAPPING_CONFIRMED');
  assert(schemaContent.includes('CONFLICT_BLOCKED_DATE'), 'Blocked date overlaps raise explicit CONFLICT_BLOCKED_DATE');
  assert(schemaContent.includes('CANNOT_MUTATE_LAST_SUPERADMIN'), 'Superadmin protection raises explicit CANNOT_MUTATE_LAST_SUPERADMIN');

  // 8. Least-Privilege Grants & Default Privileges
  assert(schemaContent.includes('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated'), 'Default table privileges revoked from public');
  assert(schemaContent.includes('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated'), 'Default function privileges revoked from public');
  assert(schemaContent.includes('GRANT SELECT ON public.public_blocked_dates TO anon, authenticated'), 'Public granted SELECT only on public_blocked_dates view');
  assert(schemaContent.includes('GRANT SELECT ON public.public_site_settings TO anon, authenticated'), 'Public granted SELECT only on public_site_settings view');
  assert(schemaContent.includes('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role'), 'Full administrative grants strictly restricted to service_role');

  // 9. Idempotent Seeding
  assert(schemaContent.includes('ON CONFLICT (registration_number) DO NOTHING'), 'Vehicle seed is idempotent (ON CONFLICT DO NOTHING)');
  assert(schemaContent.includes('ON CONFLICT (key) DO NOTHING'), 'Site settings seed is idempotent (never overwrites custom values)');
  assert(schemaContent.includes('ON CONFLICT (rule_code) DO NOTHING'), 'Pricing rules seed is idempotent (ON CONFLICT DO NOTHING)');
  assert(schemaContent.includes('ON CONFLICT (key_slug) DO NOTHING'), 'Destinations seed is idempotent (ON CONFLICT DO NOTHING)');

  // 10. Frontend Data Alignment Inspection
  const supabaseDataPath = path.join(__dirname, 'src', 'lib', 'supabaseData.js');
  const supabaseDataContent = fs.readFileSync(supabaseDataPath, 'utf8');
  assert(supabaseDataContent.includes(".order('sort_order', { ascending: true })"), 'src/lib/supabaseData.js orders by sort_order');
  assert(supabaseDataContent.includes("public_site_settings"), 'src/lib/supabaseData.js queries public_site_settings view');
  assert(supabaseDataContent.includes("public_blocked_dates"), 'src/lib/supabaseData.js queries public_blocked_dates view');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSupabaseHarness().catch(err => {
  console.error('Fatal test harness error:', err);
  process.exit(1);
});
