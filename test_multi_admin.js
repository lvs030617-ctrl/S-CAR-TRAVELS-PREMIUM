/**
 * test_multi_admin.js
 * Comprehensive automated test suite for Phase 2: Multiple Admin Management
 * 
 * Verifies:
 * 1. Super Admin vs ordinary Admin role enforcement (403 on privileged routes)
 * 2. Unauthenticated access prevention (401)
 * 3. Single-use invitation generation, token hashing & email delivery
 * 4. Duplicate prevention for usernames and registered emails
 * 5. Invitation verification and password setting (account activation)
 * 6. Single-use token enforcement & reuse rejection
 * 7. Token expiration enforcement
 * 8. Requirement that every admin uses email + password + OTP to their own registered email
 * 9. Account disabling & instant session revocation for previously issued JWTs
 * 10. Prevention of disabling, demoting, or deleting the last active Super Admin
 * 11. Complete administrative audit log tracking
 */

import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, initDatabase } from './server/db.js';
import {
  signAdminToken,
  clearFailedLogin
} from './server/auth.js';
import adminRoutes from './server/routes/admin.js';
import publicRoutes from './server/routes/public.js';
import { getLastDispatchedInviteForTest, clearLastDispatchedInviteForTest, getLastDispatchedOtpForTest } from './server/email.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_scar_kotananduru_super_secret_jwt_key_2026_at_least_64_characters_long_for_security';

initDatabase();

// Setup Express application
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

const server = http.createServer(app);

// Helper for making HTTP requests
function request(method, path, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`\n====================================================`);
  console.log(`🛡️  PHASE 2: MULTI-ADMIN MANAGEMENT SECURITY SUITE`);
  console.log(`   Running on ephemeral port ${port}`);
  console.log(`====================================================\n`);

  try {
    // 0. Clean test state & prepare initial test accounts
    clearFailedLogin('127.0.0.1');
    clearLastDispatchedInviteForTest();

    // Ensure Srinu is active superadmin
    db.prepare(`
      UPDATE admins
      SET role = 'superadmin', is_active = 1, status = 'active'
      WHERE username = 'srinu'
    `).run();

    const srinuAdmin = db.prepare("SELECT * FROM admins WHERE username = 'srinu'").get();
    const superAdminToken = signAdminToken(srinuAdmin);

    // Create an ordinary admin account for role enforcement testing
    const testAdminPassword = 'StandardAdmin@2026';
    const testAdminHash = bcrypt.hashSync(testAdminPassword, 10);
    db.prepare('DELETE FROM admins WHERE username = ? OR email = ?').run('standard_admin', 'standard@scar.com');
    const stdAdminInsert = db.prepare(`
      INSERT INTO admins (username, email, password_hash, role, is_active, status)
      VALUES (?, ?, ?, 'admin', 1, 'active')
    `).run('standard_admin', 'standard@scar.com', testAdminHash);
    const stdAdmin = db.prepare('SELECT * FROM admins WHERE id = ?').get(stdAdminInsert.lastInsertRowid);
    const standardAdminToken = signAdminToken(stdAdmin);

    // =========================================================================
    console.log('--- 1. Role Enforcement & Privileged Access Control ---');
    // =========================================================================

    // 1a. Unauthenticated access
    const unauthAccounts = await request('GET', '/api/admin/accounts');
    assert(unauthAccounts.status === 401, 'Unauthenticated request to GET /accounts rejected with 401');

    const unauthInvite = await request('POST', '/api/admin/accounts/invite', {
      body: { username: 'intruder', email: 'intruder@test.com' }
    });
    assert(unauthInvite.status === 401, 'Unauthenticated request to POST /accounts/invite rejected with 401');

    // 1b. Standard Admin trying to access Super Admin APIs
    const stdAccounts = await request('GET', '/api/admin/accounts', {
      headers: { Authorization: `Bearer ${standardAdminToken}` }
    });
    assert(stdAccounts.status === 403, 'Standard admin GET /accounts rejected with 403 Forbidden');
    assert(stdAccounts.body?.code === 'SUPERADMIN_REQUIRED', 'Returns SUPERADMIN_REQUIRED code');

    const stdInvite = await request('POST', '/api/admin/accounts/invite', {
      headers: { Authorization: `Bearer ${standardAdminToken}` },
      body: { username: 'test_invite', email: 'test_invite@example.com' }
    });
    assert(stdInvite.status === 403, 'Standard admin POST /accounts/invite rejected with 403 Forbidden');

    const stdStatus = await request('PATCH', `/api/admin/accounts/${srinuAdmin.id}/status`, {
      headers: { Authorization: `Bearer ${standardAdminToken}` },
      body: { status: 'disabled' }
    });
    assert(stdStatus.status === 403, 'Standard admin PATCH /accounts/:id/status rejected with 403 Forbidden');

    const stdRole = await request('PATCH', `/api/admin/accounts/${stdAdmin.id}/role`, {
      headers: { Authorization: `Bearer ${standardAdminToken}` },
      body: { role: 'superadmin' }
    });
    assert(stdRole.status === 403, 'Standard admin cannot elevate themselves: PATCH /accounts/:id/role rejected with 403');

    const stdDelete = await request('DELETE', `/api/admin/accounts/${srinuAdmin.id}`, {
      headers: { Authorization: `Bearer ${standardAdminToken}` }
    });
    assert(stdDelete.status === 403, 'Standard admin DELETE /accounts/:id rejected with 403 Forbidden');

    // 1c. Super Admin can access accounts list
    const superAccounts = await request('GET', '/api/admin/accounts', {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert(superAccounts.status === 200, 'Super Admin GET /accounts succeeds with 200');
    assert(Array.isArray(superAccounts.body?.admins), 'Returns admins array');
    assert(superAccounts.body.admins.some(a => a.username === 'srinu'), 'Super Admin list includes srinu');
    assert(superAccounts.body.admins.some(a => a.username === 'standard_admin'), 'Super Admin list includes standard_admin');

    // =========================================================================
    console.log('\n--- 2. Admin Invitation & Duplicate Prevention ---');
    // =========================================================================

    // Clean any prior invites for test invitees
    db.prepare(`DELETE FROM admins WHERE username IN ('new_fleet_admin', 'dup_admin', 'expired_admin') OR email IN ('fleet@scar.com', 'dup@scar.com', 'expired@scar.com')`).run();

    // 2a. Send valid invitation
    const inviteRes = await request('POST', '/api/admin/accounts/invite', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: {
        username: 'new_fleet_admin',
        email: 'fleet@scar.com',
        role: 'admin'
      }
    });
    assert(inviteRes.status === 201, 'Super Admin invites new admin with HTTP 201');
    assert(inviteRes.body?.admin?.status === 'invited', 'Admin status is initially "invited"');
    assert(inviteRes.body?.admin?.is_active === 0, 'Admin account is initially inactive (is_active = 0)');

    const dispatchedInvite = getLastDispatchedInviteForTest();
    assert(dispatchedInvite !== null, 'Single-use invitation email was dispatched');
    assert(dispatchedInvite?.recipient === 'fleet@scar.com', 'Invitation sent to recipient fleet@scar.com');
    assert(typeof dispatchedInvite?.inviteToken === 'string' && dispatchedInvite.inviteToken.length === 64, 'Generated 64-hex-char cryptographically random invitation token');
    const validInviteToken = dispatchedInvite.inviteToken;

    // 2b. Duplicate Email prevention
    const dupEmailRes = await request('POST', '/api/admin/accounts/invite', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: {
        username: 'another_user',
        email: 'fleet@scar.com' // same email
      }
    });
    assert(dupEmailRes.status === 400, 'Duplicate email rejected with HTTP 400');
    assert(/email address already exists/i.test(dupEmailRes.body?.error), 'Clear duplicate email error returned');

    // 2c. Duplicate Username prevention
    const dupUserRes = await request('POST', '/api/admin/accounts/invite', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: {
        username: 'new_fleet_admin', // same username
        email: 'different@scar.com'
      }
    });
    assert(dupUserRes.status === 400, 'Duplicate username rejected with HTTP 400');
    assert(/username already exists/i.test(dupUserRes.body?.error), 'Clear duplicate username error returned');

    // 2d. Case-insensitive duplicate check
    const dupCaseRes = await request('POST', '/api/admin/accounts/invite', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: {
        username: 'NEW_FLEET_ADMIN',
        email: 'FLEET@SCAR.COM'
      }
    });
    assert(dupCaseRes.status === 400, 'Case-insensitive duplicate rejected with HTTP 400');

    // 2e. Unactivated account cannot log in
    const prematureLogin = await request('POST', '/api/admin/login', {
      body: {
        email: 'fleet@scar.com',
        password: 'AnyPassword123'
      }
    });
    assert(prematureLogin.status === 401 || prematureLogin.status === 403, 'Unactivated account login rejected');
    assert(prematureLogin.body?.code !== 'otp_required', 'Never sends OTP to unactivated account');

    // =========================================================================
    console.log('\n--- 3. Public Invitation Verification & Account Activation ---');
    // =========================================================================

    // 3a. Invalid token verification
    const invalidTokenRes = await request('GET', '/api/public/admin/verify-invite-token?token=non_existent_fake_token_123');
    assert(invalidTokenRes.status === 404, 'Invalid token verification returns 404');

    // 3b. Valid token verification
    const validTokenVerify = await request('GET', `/api/public/admin/verify-invite-token?token=${validInviteToken}`);
    assert(validTokenVerify.status === 200, 'Valid token verification returns 200');
    assert(validTokenVerify.body?.valid === true, 'Token confirmed valid');
    assert(validTokenVerify.body?.email === 'fleet@scar.com', 'Returns registered email');
    assert(validTokenVerify.body?.username === 'new_fleet_admin', 'Returns username');

    // 3c. Password length requirement (< 8 characters)
    const shortPwdRes = await request('POST', '/api/public/admin/accept-invite', {
      body: {
        token: validInviteToken,
        password: 'short'
      }
    });
    assert(shortPwdRes.status === 400, 'Password shorter than 8 chars rejected with 400');

    // 3d. Valid account activation & password setting
    const activatedPassword = 'FleetAdmin@2026Safe';
    const acceptRes = await request('POST', '/api/public/admin/accept-invite', {
      body: {
        token: validInviteToken,
        password: activatedPassword
      }
    });
    assert(acceptRes.status === 200, 'Account successfully activated with 200');
    assert(/activated successfully/i.test(acceptRes.body?.message), 'Success confirmation message returned');

    // Verify database record
    const activatedAdmin = db.prepare("SELECT * FROM admins WHERE username = 'new_fleet_admin'").get();
    assert(activatedAdmin.is_active === 1, 'Admin is_active set to 1');
    assert(activatedAdmin.status === 'active', 'Admin status set to "active"');
    assert(bcrypt.compareSync(activatedPassword, activatedAdmin.password_hash), 'Password hash verified in SQLite');

    // =========================================================================
    console.log('\n--- 4. Single-Use Token Enforcement & Reuse Rejection ---');
    // =========================================================================

    // 4a. Verify-token rejects already used token
    const reuseVerify = await request('GET', `/api/public/admin/verify-invite-token?token=${validInviteToken}`);
    assert(reuseVerify.status === 400, 'Used token verification rejected with 400');
    assert(/already been accepted/i.test(reuseVerify.body?.error), 'Clear error stating token already accepted');

    // 4b. Accept-invite rejects already used token
    const reuseAccept = await request('POST', '/api/public/admin/accept-invite', {
      body: {
        token: validInviteToken,
        password: 'AnotherPassword@999'
      }
    });
    assert(reuseAccept.status === 400, 'Used token acceptance rejected with 400');

    // =========================================================================
    console.log('\n--- 5. Invitation Expiry Enforcement ---');
    // =========================================================================

    // Invite expired_admin
    const expiredInviteRes = await request('POST', '/api/admin/accounts/invite', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: {
        username: 'expired_admin',
        email: 'expired@scar.com',
        role: 'admin'
      }
    });
    assert(expiredInviteRes.status === 201, 'Created invitation for expiry testing');

    const expiredDispatched = getLastDispatchedInviteForTest();
    const expiredToken = expiredDispatched.inviteToken;

    // Simulate token expiration by modifying expires_at in database
    db.prepare(`
      UPDATE admin_invitations
      SET expires_at = datetime('now', '-2 hours')
      WHERE token_hash = ?
    `).run(crypto.createHash('sha256').update(expiredToken).digest('hex'));

    const expiredCheck = await request('GET', `/api/public/admin/verify-invite-token?token=${expiredToken}`);
    assert(expiredCheck.status === 400, 'Expired token verification rejected with 400');
    assert(/expired/i.test(expiredCheck.body?.error), 'Error indicates invitation has expired');

    const expiredAccept = await request('POST', '/api/public/admin/accept-invite', {
      body: {
        token: expiredToken,
        password: 'ValidPassword@123'
      }
    });
    assert(expiredAccept.status === 400, 'Expired token acceptance rejected with 400');

    // =========================================================================
    console.log('\n--- 6. Activated Admin Login & Dedicated Registered Email OTP ---');
    // =========================================================================

    clearFailedLogin('127.0.0.1');

    // 6a. Step 1: Login with registered email + new password
    const loginStep1 = await request('POST', '/api/admin/login', {
      body: {
        email: 'fleet@scar.com',
        password: activatedPassword
      }
    });
    assert(loginStep1.status === 200, 'Activated admin Step 1 login returns 200');
    assert(loginStep1.body?.step === 'otp_required', 'Demands OTP verification');

    // Verify OTP was sent to fleet@scar.com (this admin's own registered email)
    const otpSent = getLastDispatchedOtpForTest();
    assert(otpSent !== null, 'OTP was dispatched');
    assert(otpSent?.recipient === 'fleet@scar.com', 'OTP delivered strictly to newly activated admin own email (fleet@scar.com)');
    assert(typeof otpSent?.otp === 'string' && otpSent.otp.length === 8, '8-digit security OTP code dispatched');

    // 6b. Step 2: Submit OTP
    const loginStep2 = await request('POST', '/api/admin/verify-otp', {
      body: {
        challengeId: loginStep1.body.challengeId,
        otp: otpSent.otp
      }
    });
    assert(loginStep2.status === 200, 'Step 2 OTP verification returns 200');
    const newAdminToken = loginStep2.body?.token;
    assert(typeof newAdminToken === 'string', 'Issued JWT token to newly activated admin');

    // Verify newly logged in admin can access protected admin routes
    const bookingCheck = await request('GET', '/api/admin/bookings', {
      headers: { Authorization: `Bearer ${newAdminToken}` }
    });
    assert(bookingCheck.status === 200, 'Activated admin can access /api/admin/bookings');

    // But cannot access /api/admin/accounts
    const accountsForbidden = await request('GET', '/api/admin/accounts', {
      headers: { Authorization: `Bearer ${newAdminToken}` }
    });
    assert(accountsForbidden.status === 403, 'Activated ordinary admin denied access to /api/admin/accounts');

    // =========================================================================
    console.log('\n--- 7. Disabling Accounts & Instant Session Invalidation ---');
    // =========================================================================

    // 7a. Super Admin disables fleet admin account
    const disableRes = await request('PATCH', `/api/admin/accounts/${activatedAdmin.id}/status`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { status: 'disabled' }
    });
    assert(disableRes.status === 200, 'Super Admin disables account with 200');
    assert(disableRes.body?.admin?.status === 'disabled', 'Status is now "disabled"');
    assert(disableRes.body?.admin?.is_active === 0, 'is_active is now 0');

    // 7b. INSTANT SESSION INVALIDATION: Previously issued JWT immediately rejected on next request
    const disabledSessionAttempt = await request('GET', '/api/admin/bookings', {
      headers: { Authorization: `Bearer ${newAdminToken}` }
    });
    assert(disabledSessionAttempt.status === 401, 'Previously issued active JWT token immediately rejected with 401');
    assert(disabledSessionAttempt.body?.code === 'ACCOUNT_DISABLED', 'Rejection code is ACCOUNT_DISABLED');

    // 7c. Disabled admin cannot log in even with correct credentials
    const disabledLoginAttempt = await request('POST', '/api/admin/login', {
      body: {
        email: 'fleet@scar.com',
        password: activatedPassword
      }
    });
    assert(disabledLoginAttempt.status === 403, 'Disabled admin login rejected with 403');
    assert(disabledLoginAttempt.body?.code === 'ACCOUNT_DISABLED', 'Login rejection code is ACCOUNT_DISABLED');

    // 7d. Re-enabling account
    const reEnableRes = await request('PATCH', `/api/admin/accounts/${activatedAdmin.id}/status`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { status: 'active' }
    });
    assert(reEnableRes.status === 200, 'Super Admin re-enables account with 200');
    assert(reEnableRes.body?.admin?.status === 'active', 'Account status restored to "active"');

    // Re-enabled admin can now initiate login again
    const reEnabledLogin = await request('POST', '/api/admin/login', {
      body: {
        email: 'fleet@scar.com',
        password: activatedPassword
      }
    });
    assert(reEnabledLogin.status === 200, 'Re-enabled admin can initiate login again');
    assert(reEnabledLogin.body?.step === 'otp_required', 'OTP requested again');

    // =========================================================================
    console.log('\n--- 8. Last Active Super Admin Protection Invariant ---');
    // =========================================================================

    // Currently srinu is the ONLY active superadmin
    // 8a. Attempt to disable the last active Super Admin
    const disableLastSuper = await request('PATCH', `/api/admin/accounts/${srinuAdmin.id}/status`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { status: 'disabled' }
    });
    assert(disableLastSuper.status === 400, 'Disabling last active Super Admin rejected with 400');
    assert(/last active Super Administrator/i.test(disableLastSuper.body?.error), 'Clear invariant protection error');

    // 8b. Attempt to demote the last active Super Admin to ordinary admin
    const demoteLastSuper = await request('PATCH', `/api/admin/accounts/${srinuAdmin.id}/role`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { role: 'admin' }
    });
    assert(demoteLastSuper.status === 400, 'Demoting last active Super Admin rejected with 400');
    assert(/last active Super Administrator/i.test(demoteLastSuper.body?.error), 'Clear invariant demotion protection');

    // 8c. Attempt to delete the last active Super Admin
    const deleteLastSuper = await request('DELETE', `/api/admin/accounts/${srinuAdmin.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert(deleteLastSuper.status === 400, 'Deleting last active Super Admin rejected with 400');

    // 8d. Promote second admin to superadmin, then demotion/disabling works
    const promoteFleet = await request('PATCH', `/api/admin/accounts/${activatedAdmin.id}/role`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { role: 'superadmin' }
    });
    assert(promoteFleet.status === 200, 'Promoted second admin to superadmin');

    // Now there are 2 active superadmins. Demoting fleet admin back to admin is now allowed
    const demoteFleet = await request('PATCH', `/api/admin/accounts/${activatedAdmin.id}/role`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { role: 'admin' }
    });
    assert(demoteFleet.status === 200, 'Demoting fleet admin back to ordinary admin succeeds because 1 superadmin remains');

    // Once again srinu is the only superadmin -> cannot be disabled
    const disableSrinuAgain = await request('PATCH', `/api/admin/accounts/${srinuAdmin.id}/status`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { status: 'disabled' }
    });
    assert(disableSrinuAgain.status === 400, 'Disabling srinu blocked once more as only superadmin');

    // 8e. Super Admin deleting ordinary admin
    const deleteFleet = await request('DELETE', `/api/admin/accounts/${activatedAdmin.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert(deleteFleet.status === 200, 'Super Admin successfully deleted ordinary admin');
    const verifyDeleted = db.prepare('SELECT id FROM admins WHERE id = ?').get(activatedAdmin.id);
    assert(!verifyDeleted, 'Admin deleted from SQLite database');

    // =========================================================================
    console.log('\n--- 9. Administrative Audit Trail System ---');
    // =========================================================================

    const auditRes = await request('GET', '/api/admin/accounts/audit-logs', {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert(auditRes.status === 200, 'Super Admin can fetch audit logs');
    const logs = auditRes.body?.logs || [];
    assert(logs.length > 0, 'Audit logs recorded multiple events');

    const actions = logs.map(l => l.action);
    assert(actions.includes('ADMIN_INVITED'), 'Recorded ADMIN_INVITED event');
    assert(actions.includes('ADMIN_ACTIVATED'), 'Recorded ADMIN_ACTIVATED event');
    assert(actions.includes('ADMIN_DISABLED'), 'Recorded ADMIN_DISABLED event');
    assert(actions.includes('ADMIN_ENABLED'), 'Recorded ADMIN_ENABLED event');
    assert(actions.includes('ADMIN_ROLE_CHANGED'), 'Recorded ADMIN_ROLE_CHANGED event');
    assert(actions.includes('ADMIN_DELETED'), 'Recorded ADMIN_DELETED event');

    const inviteEvent = logs.find(l => l.action === 'ADMIN_INVITED');
    assert(inviteEvent?.actor_username === 'srinu', 'Audit log records actor username');
    assert(inviteEvent?.ip_address !== undefined, 'Audit log records client IP');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log(`\n====================================================`);
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log(`====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
