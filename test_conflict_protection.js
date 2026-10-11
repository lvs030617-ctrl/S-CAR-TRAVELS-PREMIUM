import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000';

async function runConflictTests() {
  console.log('====================================================');
  console.log('🚗 SINGLE ERTIGA FLEET CONFLICT PROTECTION AUDIT');
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

  // 1. Admin Login to get token
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'srinu', password: 'Srinu@2026' })
  });
  const { token } = await loginRes.json();
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  // 2. Public Availability check for clean future date
  const cleanDateStart = '2026-12-01T08:00';
  const cleanDateEnd = '2026-12-01T18:00';

  const initialAvailRes = await fetch(`${BASE_URL}/api/public/check-availability?pickup_datetime=${cleanDateStart}&return_datetime=${cleanDateEnd}`);
  const initialAvail = await initialAvailRes.json();
  assert(initialAvail.available === true, 'Initially slot 2026-12-01 is available');

  // 3. Submit Booking Inquiry 1
  const b1Res = await fetch(`${BASE_URL}/api/public/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Conflict Test Traveler A',
      customer_phone: '9550641408',
      service_type: 'with_driver',
      trip_type: 'round_trip',
      pickup_location: 'Kotananduru',
      destination: 'Annavaram Temple',
      pickup_datetime: cleanDateStart,
      return_datetime: cleanDateEnd,
      passengers: 4
    })
  });
  const b1Data = await b1Res.json();
  assert(b1Res.status === 201, 'Booking 1 submitted successfully with HTTP 201');
  const b1Id = b1Data.booking.id;

  // 4. Admin confirms Booking 1
  const confirm1Res = await fetch(`${BASE_URL}/api/admin/bookings/${b1Id}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'confirmed', remarks: 'Confirmed for Ertiga AP03 CZ 4567' })
  });
  assert(confirm1Res.status === 200, 'Admin successfully confirmed Booking 1');

  // 5. Public Availability check for overlapping time on 2026-12-01
  const overlapStart = '2026-12-01T12:00';
  const overlapEnd = '2026-12-01T16:00';

  const overlapAvailRes = await fetch(`${BASE_URL}/api/public/check-availability?pickup_datetime=${overlapStart}&return_datetime=${overlapEnd}`);
  const overlapAvail = await overlapAvailRes.json();
  assert(overlapAvail.available === false, 'Public availability flags overlapping slot as UNAVAILABLE');
  assert(overlapAvail.details.hasConflict === true, 'Availability details report conflict');
  assert(overlapAvail.details.type === 'booking', 'Conflict identified as overlapping confirmed booking');

  // 6. Customer submits Booking Inquiry 2 for overlapping slot
  const b2Res = await fetch(`${BASE_URL}/api/public/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Conflict Test Traveler B',
      customer_phone: '9848022338',
      service_type: 'with_driver',
      trip_type: 'one_way',
      pickup_location: 'Kotananduru',
      destination: 'Tuni Railway Station',
      pickup_datetime: overlapStart,
      return_datetime: overlapEnd,
      passengers: 2
    })
  });
  const b2Data = await b2Res.json();
  assert(b2Res.status === 201, 'Booking 2 inquiry accepted in pending status');
  assert(b2Data.advisory.includes('another scheduled trip'), 'Customer receives advisory warning of existing schedule');
  const b2Id = b2Data.booking.id;

  // 7. Admin attempts to CONFIRM Booking 2 -> MUST BE REJECTED WITH 409 CONFLICT
  const confirm2Res = await fetch(`${BASE_URL}/api/admin/bookings/${b2Id}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'confirmed', remarks: 'Attempting invalid double-booking' })
  });
  const confirm2Data = await confirm2Res.json();
  assert(confirm2Res.status === 409, 'Server REJECTS double-booking with HTTP 409 Conflict');
  assert(confirm2Data.conflict.hasConflict === true, 'Conflict payload returned to prevent administrator mistake');
  assert(confirm2Data.error.includes('Overlap detected for the Ertiga'), 'Clear explanatory error mentioning single Ertiga constraint');

  // 8. Test Blocked Calendar Dates (e.g. Maintenance)
  const blockRes = await fetch(`${BASE_URL}/api/admin/blocked-dates`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      start_date: '2026-12-15',
      end_date: '2026-12-16',
      reason: 'Scheduled Maruti 50,000 KM Maintenance & Dual-AC Servicing'
    })
  });
  const blockData = await blockRes.json();
  assert(blockRes.status === 201, 'Owner Srinu blocks Ertiga dates for maintenance (HTTP 201)');
  const blockId = blockData.blockedDate.id;

  // 9. Availability check for blocked maintenance date
  const blockedAvailRes = await fetch(`${BASE_URL}/api/public/check-availability?pickup_datetime=2026-12-15T09:00&return_datetime=2026-12-15T18:00`);
  const blockedAvail = await blockedAvailRes.json();
  assert(blockedAvail.available === false, 'Blocked maintenance date marked UNAVAILABLE');
  assert(blockedAvail.details.type === 'blocked', 'Conflict identified as owner-blocked calendar date');

  // 10. Clean up test data
  await fetch(`${BASE_URL}/api/admin/bookings/${b1Id}`, { method: 'DELETE', headers: adminHeaders });
  await fetch(`${BASE_URL}/api/admin/bookings/${b2Id}`, { method: 'DELETE', headers: adminHeaders });
  await fetch(`${BASE_URL}/api/admin/blocked-dates/${blockId}`, { method: 'DELETE', headers: adminHeaders });

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runConflictTests().catch(err => {
  console.error('Fatal conflict test error:', err);
  process.exit(1);
});
