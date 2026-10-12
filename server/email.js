import { Resend } from 'resend';

// Default recipient if not configured in environment
export const DEFAULT_ADMIN_EMAIL = 'srinucartravelspremium@gmail.com';
export const DEFAULT_FROM_EMAIL = 'S CAR TRAVELS PREMIUM <onboarding@resend.dev>';

/**
 * Resolves the sanitized sender email address from environment.
 * Strips accidental surrounding quotes and falls back safely to DEFAULT_FROM_EMAIL.
 */
export function getFromEmail() {
  const envFrom = (process.env.RESEND_FROM_EMAIL || '').trim().replace(/^["']|["']$/g, '');
  return envFrom && envFrom.length > 0 ? envFrom : DEFAULT_FROM_EMAIL;
}

/**
 * Returns an instance of the Resend client if RESEND_API_KEY is configured.
 * Safely reads exclusively from server-side environment variables.
 */
export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return null;
  }
  return new Resend(apiKey.trim());
}

/**
 * Helper to build branded HTML email for owner Srinu
 */
export function buildBookingEmailHtml(booking) {
  const isSelfDrive = booking.service_type === 'self_drive';
  const serviceLabel = isSelfDrive ? 'Self-Drive Ertiga Rental' : 'Rental with Chauffeur (Driver)';
  const tripTypeLabel = (booking.trip_type || 'round_trip').replace(/_/g, ' ').toUpperCase();

  const formattedPickup = booking.pickup_datetime
    ? new Date(booking.pickup_datetime).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
      })
    : 'Not Specified';

  const formattedReturn = booking.return_datetime
    ? new Date(booking.return_datetime).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
      })
    : null;

  const cleanPhone = (booking.customer_phone || '').replace(/\D/g, '');
  const phoneLink = `tel:+91${cleanPhone}`;
  const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
    `Namaste ${booking.customer_name}, regarding your S CAR TRAVELS Ertiga booking inquiry (${booking.reference_no}) to ${booking.destination}:`
  )}`;

  const dashboardUrl = process.env.APP_BASE_URL
    ? `${process.env.APP_BASE_URL.replace(/\/+$/, '')}/admin/bookings`
    : 'https://s-car-travels-premium.onrender.com/admin/bookings';

  const priceText = (booking.estimated_min_price && booking.estimated_max_price)
    ? `₹${Number(booking.estimated_min_price).toLocaleString('en-IN')} - ₹${Number(booking.estimated_max_price).toLocaleString('en-IN')} (Estimated)`
    : (booking.estimated_min_price ? `₹${Number(booking.estimated_min_price).toLocaleString('en-IN')}` : 'Custom Quote Required');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Customer Booking Inquiry</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080f1e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #080f1e; padding: 25px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 620px; background: #0f172a; border: 1px solid rgba(229, 184, 59, 0.4); border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0b132b 0%, #1c2541 100%); padding: 25px 30px; border-bottom: 2px solid #e5b83b;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #e5b83b; letter-spacing: 0.5px;">
                      🚗 S CAR TRAVELS PREMIUM
                    </h1>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">
                      Kotananduru, AP • Single White Ertiga Fleet
                    </p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background: rgba(229, 184, 59, 0.15); border: 1px solid #e5b83b; color: #f6d365; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px;">
                      NEW BOOKING
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Schedule Advisory Warning if Conflict Detected -->
          ${booking.hasConflict ? `
          <tr>
            <td style="padding: 16px 30px 0;">
              <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 8px; padding: 12px 16px; color: #fca5a5; font-size: 13px; line-height: 1.5;">
                ⚠️ <strong>Schedule Advisory:</strong> The Ertiga has another scheduled trip or blocked date near these dates. Review your calendar before confirming with the customer.
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Main Content -->
          <tr>
            <td style="padding: 25px 30px;">
              <div style="margin-bottom: 20px;">
                <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Booking Reference</span>
                <div style="font-size: 24px; font-weight: 800; color: #e5b83b; margin-top: 2px;">
                  ${booking.reference_no}
                </div>
              </div>

              <!-- Customer Details Card -->
              <table role="presentation" width="100%" style="background: #1e293b; border-radius: 10px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.06);">
                <tr>
                  <td colspan="2" style="padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <strong style="color: #f6d365; font-size: 14px;">👤 Customer Contact Details</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0 4px; font-size: 13px; color: #94a3b8; width: 40%;">Customer Name:</td>
                  <td style="padding: 10px 0 4px; font-size: 14px; font-weight: 700; color: #ffffff;">${booking.customer_name}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Phone Number:</td>
                  <td style="padding: 4px 0; font-size: 14px; font-weight: 700;">
                    <a href="${phoneLink}" style="color: #38bdf8; text-decoration: none;">+91 ${cleanPhone}</a>
                  </td>
                </tr>
                ${booking.customer_email ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Customer Email:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #cbd5e1;">${booking.customer_email}</td>
                </tr>
                ` : ''}
              </table>

              <!-- Journey Details Card -->
              <table role="presentation" width="100%" style="background: #1e293b; border-radius: 10px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.06);">
                <tr>
                  <td colspan="2" style="padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <strong style="color: #f6d365; font-size: 14px;">🗺️ Journey & Vehicle Specifications</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0 4px; font-size: 13px; color: #94a3b8; width: 40%;">Service Type:</td>
                  <td style="padding: 10px 0 4px; font-size: 13px; font-weight: 600; color: #ffffff;">${serviceLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Trip Type:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #cbd5e1;">${tripTypeLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Pickup Location:</td>
                  <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #ffffff;">${booking.pickup_location}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Destination:</td>
                  <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #e5b83b;">${booking.destination}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Pickup Time:</td>
                  <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #ffffff;">${formattedPickup}</td>
                </tr>
                ${formattedReturn ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Return Time:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #cbd5e1;">${formattedReturn}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Passengers:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #ffffff;">${booking.passengers || 1} passenger(s)</td>
                </tr>
                ${booking.luggage_count ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Luggage:</td>
                  <td style="padding: 4px 0; font-size: 13px; color: #cbd5e1;">${booking.luggage_count} bag(s)</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #94a3b8;">Estimated Fare:</td>
                  <td style="padding: 4px 0; font-size: 13px; font-weight: 700; color: #4ade80;">${priceText}</td>
                </tr>
                ${booking.special_notes ? `
                <tr>
                  <td style="padding: 6px 0 2px; font-size: 13px; color: #94a3b8; vertical-align: top;">Customer Notes:</td>
                  <td style="padding: 6px 0 2px; font-size: 13px; color: #fcd34d; font-style: italic;">"${booking.special_notes}"</td>
                </tr>
                ` : ''}
              </table>

              <!-- Quick Action Links -->
              <table role="presentation" width="100%" style="margin-top: 25px;">
                <tr>
                  <td align="center" style="padding-bottom: 10px;">
                    <a href="${whatsappUrl}" style="display: inline-block; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">
                      💬 Reply to Customer on WhatsApp
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; background-color: rgba(229, 184, 59, 0.15); color: #e5b83b; border: 1px solid #e5b83b; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-weight: 600; font-size: 13px;">
                      Open Admin Portal & Confirm Booking
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #080f1e; padding: 20px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b;">
              This notification was generated automatically by S CAR TRAVELS PREMIUM.<br>
              Proprietor: SRINU • Base: Kotananduru, Andhra Pradesh
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Builds plain-text fallback for email clients without HTML support
 */
export function buildBookingEmailText(booking) {
  const isSelfDrive = booking.service_type === 'self_drive';
  const serviceLabel = isSelfDrive ? 'Self-Drive Ertiga Rental' : 'Rental with Chauffeur (Driver)';
  const tripTypeLabel = (booking.trip_type || 'round_trip').replace(/_/g, ' ').toUpperCase();

  const formattedPickup = booking.pickup_datetime
    ? new Date(booking.pickup_datetime).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
      })
    : 'Not Specified';

  const formattedReturn = booking.return_datetime
    ? new Date(booking.return_datetime).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
      })
    : 'Single day / Drop';

  const cleanPhone = (booking.customer_phone || '').replace(/\D/g, '');
  const priceText = (booking.estimated_min_price && booking.estimated_max_price)
    ? `₹${Number(booking.estimated_min_price).toLocaleString('en-IN')} - ₹${Number(booking.estimated_max_price).toLocaleString('en-IN')}`
    : 'Custom Quote Required';

  return `NEW CUSTOMER BOOKING INQUIRY - S CAR TRAVELS PREMIUM
=====================================================
Booking Reference: ${booking.reference_no}
${booking.hasConflict ? '⚠️ SCHEDULE ADVISORY: Potential overlap with existing trip\n' : ''}
CUSTOMER DETAILS:
- Name: ${booking.customer_name}
- Phone: +91 ${cleanPhone}
${booking.customer_email ? `- Email: ${booking.customer_email}\n` : ''}
JOURNEY DETAILS:
- Service: ${serviceLabel}
- Trip Type: ${tripTypeLabel}
- Pickup Location: ${booking.pickup_location}
- Destination: ${booking.destination}
- Pickup Time: ${formattedPickup}
- Return Time: ${formattedReturn}
- Passengers: ${booking.passengers || 1}
${booking.luggage_count ? `- Luggage Bags: ${booking.luggage_count}\n` : ''}
- Estimated Fare: ${priceText}
${booking.special_notes ? `- Customer Notes: ${booking.special_notes}\n` : ''}
=====================================================
WhatsApp Link: https://wa.me/91${cleanPhone}
Admin Portal: https://s-car-travels-premium.onrender.com/admin/bookings`.trim();
}

/**
 * Sends a booking notification email to the admin.
 * Guaranteed safe: never throws and never interferes with booking persistence.
 */
export async function sendBookingNotificationEmail(booking, customClient = null) {
  // If customClient is provided (e.g. for testing/mocking), use it; otherwise use default Resend client
  const client = customClient || getResendClient();

  if (!client) {
    // API key not configured: log safe notice and return gracefully
    return {
      success: false,
      skipped: true,
      reason: 'RESEND_API_KEY_NOT_CONFIGURED',
      message: 'Email notification skipped: RESEND_API_KEY is not set.'
    };
  }

  const toEmail = process.env.ADMIN_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL;
  const fromEmail = getFromEmail();
  const subject = `🚗 New Booking [${booking.reference_no}]: ${booking.customer_name} → ${booking.destination}`;

  try {
    const html = buildBookingEmailHtml(booking);
    const text = buildBookingEmailText(booking);

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject,
      html,
      text
    });

    if (error) {
      console.warn('[Notification] Resend email delivery warning:', error.message || error);
      return {
        success: false,
        error: error.message || 'Resend delivery failed'
      };
    }

    console.log(`[Notification] Admin email sent successfully for ${booking.reference_no} to ${toEmail} (ID: ${data?.id})`);
    return {
      success: true,
      messageId: data?.id
    };
  } catch (err) {
    // Network or SDK exception caught safely without affecting booking creation
    console.warn('[Notification] Email delivery exception:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Builds responsive HTML email template for 8-digit admin login OTP code
 */
export function buildAdminLoginOtpEmailHtml({ adminName, otp, expiresMinutes = 5 }) {
  const formattedOtp = String(otp).trim();
  const name = adminName || 'Admin';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your S CAR TRAVELS Admin Login Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080f1e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #080f1e; padding: 25px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background: #0f172a; border: 1px solid rgba(229, 184, 59, 0.4); border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0b132b 0%, #1c2541 100%); padding: 25px 30px; border-bottom: 2px solid #e5b83b;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #e5b83b; letter-spacing: 0.5px;">
                      🚗 S CAR TRAVELS PREMIUM
                    </h1>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">
                      Owner Administration • Security Portal
                    </p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background: rgba(229, 184, 59, 0.15); border: 1px solid #e5b83b; color: #f6d365; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px;">
                      LOGIN SECURITY
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 700; color: #ffffff;">
                Your Login Verification Code
              </h2>
              <p style="margin: 0 0 24px; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                Hello <strong>${name}</strong>, use the 8-digit verification code below to complete your sign-in to the S CAR TRAVELS owner administration console.
              </p>

              <!-- OTP Code Display Box -->
              <div style="background: #1e293b; border: 2px dashed #e5b83b; border-radius: 12px; padding: 20px 15px; margin: 0 auto 25px; max-width: 380px;">
                <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace; color: #e5b83b; padding-left: 8px;">
                  ${formattedOtp}
                </div>
              </div>

              <!-- Expiry Alert -->
              <div style="background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; padding: 12px 16px; margin: 0 auto 25px; max-width: 440px; font-size: 13px; color: #facc15; text-align: left; line-height: 1.5;">
                ⏱️ <strong>Time-Sensitive:</strong> This security code will expire in <strong>${expiresMinutes} minutes</strong> and can only be used once. After 5 incorrect attempts, it will be automatically invalidated.
              </div>

              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                If you did not attempt to sign in to S CAR TRAVELS PREMIUM, please disregard this email or review your account password immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #080f1e; padding: 18px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b;">
              S CAR TRAVELS PREMIUM • Proprietor: SRINU • Kotananduru, Andhra Pradesh
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Builds plain-text fallback version of admin login OTP code
 */
export function buildAdminLoginOtpEmailText({ adminName, otp, expiresMinutes = 5 }) {
  const name = adminName || 'Admin';
  return `S CAR TRAVELS PREMIUM - ADMIN LOGIN VERIFICATION
=====================================================
Hello ${name},

Your 8-digit security verification code is:

    ${otp}

This code will expire in ${expiresMinutes} minutes and can only be used once.
Do not share this code with anyone.

If you did not attempt to sign in, please disregard this email.
=====================================================
S CAR TRAVELS PREMIUM • Kotananduru, Andhra Pradesh`.trim();
}

// In-memory test store for automated integration tests
let lastDispatchedOtpForTest = null;
export function getLastDispatchedOtpForTest() {
  return lastDispatchedOtpForTest;
}
export function clearLastDispatchedOtpForTest() {
  lastDispatchedOtpForTest = null;
}

/**
 * Sends the 8-digit login OTP code to that specific admin's registered email address.
 * Never throws and handles delivery failures safely.
 */
export async function sendAdminLoginOtpEmail({ email, adminName, otp, expiresMinutes = 5 }, customClient = null) {
  if (!email || !otp) {
    return { success: false, error: 'Email and OTP code are required' };
  }

  // Record for test suites if running in test environment
  if (process.env.NODE_ENV === 'test' || process.env.RESEND_MOCK === 'true') {
    lastDispatchedOtpForTest = {
      email: email.trim().toLowerCase(),
      recipient: email.trim().toLowerCase(),
      otp,
      timestamp: Date.now()
    };
  }

  // If a mock or custom client is provided, use it
  const client = customClient || getResendClient();

  if (!client) {
    // If running in test mode without an API key, simulate delivery success for clean test execution
    if (process.env.NODE_ENV === 'test' || process.env.RESEND_MOCK === 'true') {
      console.log(`[Auth OTP Mock] Simulated OTP dispatch for ${email} in test mode`);
      return { success: true, messageId: 'mock_test_otp_msg_id' };
    }

    console.warn('[Auth OTP] Cannot send login OTP: RESEND_API_KEY is not configured on server.');
    return {
      success: false,
      skipped: true,
      reason: 'RESEND_API_KEY_NOT_CONFIGURED',
      error: 'RESEND_API_KEY is not configured on the server. Unable to send verification email.'
    };
  }

  const fromEmail = getFromEmail();
  const subject = `🔐 S CAR TRAVELS PREMIUM - Admin Login Code`;

  try {
    const html = buildAdminLoginOtpEmailHtml({ adminName, otp, expiresMinutes });
    const text = buildAdminLoginOtpEmailText({ adminName, otp, expiresMinutes });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: email.trim().toLowerCase(),
      subject,
      html,
      text
    });

    if (error) {
      console.warn('[Auth OTP] Resend delivery error for admin email:', error.message || error);
      return {
        success: false,
        error: error.message || 'Resend delivery failed'
      };
    }

    console.log(`[Auth OTP] Security code successfully dispatched to ${email.trim().toLowerCase()} (ID: ${data?.id})`);
    return {
      success: true,
      messageId: data?.id
    };
  } catch (err) {
    console.warn('[Auth OTP] Exception while sending admin OTP email:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Builds responsive HTML email template for new Administrator Invitations
 */
export function buildAdminInvitationEmailHtml({ adminName, role, inviteUrl, expiresHours = 48 }) {
  const name = adminName || 'Admin';
  const roleDisplay = role === 'superadmin' ? 'Super Administrator' : 'Administrator';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Administrator Invitation - S CAR TRAVELS PREMIUM</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080f1e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #080f1e; padding: 25px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background: #0f172a; border: 1px solid rgba(229, 184, 59, 0.4); border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0b132b 0%, #1c2541 100%); padding: 25px 30px; border-bottom: 2px solid #e5b83b;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #e5b83b; letter-spacing: 0.5px;">
                      🚗 S CAR TRAVELS PREMIUM
                    </h1>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">
                      Owner Administration • Staff Portal
                    </p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background: rgba(229, 184, 59, 0.15); border: 1px solid #e5b83b; color: #f6d365; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px;">
                      INVITATION
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <h2 style="margin: 0 0 12px; font-size: 21px; font-weight: 700; color: #ffffff;">
                You're Invited to Manage S CAR TRAVELS
              </h2>
              <p style="margin: 0 0 20px; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                Hello <strong>${name}</strong>, you have been invited to join the S CAR TRAVELS PREMIUM administration console as a <strong>${roleDisplay}</strong>.
              </p>

              <p style="margin: 0 0 25px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                To activate your account, verify your email and set your private password using the secure link below:
              </p>

              <!-- Action Button -->
              <div style="margin: 25px 0 30px;">
                <a href="${inviteUrl}" style="background: #e5b83b; color: #080f1e; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(229, 184, 59, 0.35);">
                  Accept Invitation & Set Password →
                </a>
              </div>

              <!-- Time Limit Alert -->
              <div style="background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; padding: 12px 16px; margin: 0 auto 20px; max-width: 440px; font-size: 13px; color: #facc15; text-align: left; line-height: 1.5;">
                ⏱️ <strong>Time-Sensitive:</strong> This single-use invitation link expires in <strong>${expiresHours} hours</strong>. Once activated, every future login will require email + password + OTP verification.
              </div>

              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                If you did not expect this invitation, you may safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #080f1e; padding: 18px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b;">
              S CAR TRAVELS PREMIUM • Proprietor: SRINU • Kotananduru, Andhra Pradesh
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Builds plain-text fallback version of admin invitation
 */
export function buildAdminInvitationEmailText({ adminName, role, inviteUrl, expiresHours = 48 }) {
  const name = adminName || 'Admin';
  const roleDisplay = role === 'superadmin' ? 'Super Administrator' : 'Administrator';
  return `S CAR TRAVELS PREMIUM - ADMINISTRATOR INVITATION
=====================================================
Hello ${name},

You have been invited to join the S CAR TRAVELS PREMIUM administration console as a ${roleDisplay}.

To activate your account and set your private password, visit the secure link below:

    ${inviteUrl}

This invitation link is valid for ${expiresHours} hours and can only be used once.
Every administrator login requires email + password + OTP verification.

If you did not expect this invitation, you can disregard this email.
=====================================================
S CAR TRAVELS PREMIUM • Kotananduru, Andhra Pradesh`.trim();
}

// In-memory test store for automated integration tests
let lastDispatchedInviteForTest = null;
export function getLastDispatchedInviteForTest() {
  return lastDispatchedInviteForTest;
}
export function clearLastDispatchedInviteForTest() {
  lastDispatchedInviteForTest = null;
}

/**
 * Sends single-use invitation email to invited administrator
 */
export async function sendAdminInvitationEmail({ email, adminName, role, inviteToken, frontendBaseUrl, expiresHours = 48 }, customClient = null) {
  if (!email || !inviteToken) {
    return { success: false, error: 'Email and inviteToken are required' };
  }

  const base = frontendBaseUrl || process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173';
  const cleanBase = base.replace(/\/+$/, '');
  const inviteUrl = `${cleanBase}/admin/accept-invite?token=${encodeURIComponent(inviteToken)}`;

  if (process.env.NODE_ENV === 'test' || process.env.RESEND_MOCK === 'true') {
    lastDispatchedInviteForTest = {
      email: email.trim().toLowerCase(),
      recipient: email.trim().toLowerCase(),
      adminName,
      role,
      inviteToken,
      inviteUrl,
      timestamp: Date.now()
    };
  }

  const client = customClient || getResendClient();
  if (!client) {
    if (process.env.NODE_ENV === 'test' || process.env.RESEND_MOCK === 'true') {
      console.log(`[Admin Invite Mock] Simulated invitation email dispatch for ${email} in test mode`);
      return { success: true, messageId: 'mock_test_invite_msg_id', inviteUrl };
    }

    console.warn('[Admin Invite] Cannot send invitation email: RESEND_API_KEY is not configured on server.');
    return {
      success: false,
      skipped: true,
      reason: 'RESEND_API_KEY_NOT_CONFIGURED',
      error: 'RESEND_API_KEY is not configured on the server. Unable to send invitation email.'
    };
  }

  const fromEmail = getFromEmail();
  const subject = `✉️ Invitation to join S CAR TRAVELS PREMIUM as ${role === 'superadmin' ? 'Super Administrator' : 'Administrator'}`;

  try {
    const html = buildAdminInvitationEmailHtml({ adminName, role, inviteUrl, expiresHours });
    const text = buildAdminInvitationEmailText({ adminName, role, inviteUrl, expiresHours });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: email.trim().toLowerCase(),
      subject,
      html,
      text
    });

    if (error) {
      console.warn('[Admin Invite] Resend delivery error for admin invitation:', error.message || error);
      return {
        success: false,
        error: error.message || 'Resend delivery failed',
        inviteUrl
      };
    }

    console.log(`[Admin Invite] Invitation successfully dispatched to ${email.trim().toLowerCase()} (ID: ${data?.id})`);
    return {
      success: true,
      messageId: data?.id,
      inviteUrl
    };
  } catch (err) {
    console.warn('[Admin Invite] Exception while sending admin invitation email:', err.message);
    return {
      success: false,
      error: err.message,
      inviteUrl
    };
  }
}

// ==========================================
// PASSWORD RESET EMAIL BUILDERS & DISPATCHERS
// ==========================================

// In-memory test stores for automated integration tests
let lastDispatchedResetOtpForTest = null;
export function getLastDispatchedResetOtpForTest() {
  return lastDispatchedResetOtpForTest;
}
export function clearLastDispatchedResetOtpForTest() {
  lastDispatchedResetOtpForTest = null;
}

let lastDispatchedPasswordChangedForTest = null;
export function getLastDispatchedPasswordChangedForTest() {
  return lastDispatchedPasswordChangedForTest;
}
export function clearLastDispatchedPasswordChangedForTest() {
  lastDispatchedPasswordChangedForTest = null;
}

/**
 * Builds HTML email containing 8-digit OTP for password reset
 */
export function buildAdminPasswordResetOtpEmailHtml({ adminName, otp, expiresMinutes = 5 }) {
  const name = adminName || 'Administrator';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Password Reset Security Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050507; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #050507; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #0f172a; border-radius: 12px; overflow: hidden; border: 1px solid rgba(229, 184, 59, 0.3); box-shadow: 0 15px 35px rgba(0,0,0,0.8);">
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 25px 30px; border-bottom: 1px solid rgba(255,255,255,0.08);">
              <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #f6d365; letter-spacing: 0.5px;">
                S CAR TRAVELS PREMIUM
              </h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">
                Administrator Password Recovery • Kotananduru, AP
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; text-align: center;">
              <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 700; color: #ffffff;">
                Password Reset Verification
              </h2>
              <p style="margin: 0 0 25px; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
                Hello <strong>${name}</strong>, we received a request to reset the password for your administrator account. Use the single-use 8-digit verification code below:
              </p>

              <!-- 8-Digit OTP Box -->
              <div style="background: #020617; border: 2px dashed #e5b83b; border-radius: 10px; padding: 20px; margin: 0 auto 25px; max-width: 320px;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #f6d365; display: block;">
                  ${otp}
                </span>
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; display: block; margin-top: 6px;">
                  Single-Use Recovery Code
                </span>
              </div>

              <div style="background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; padding: 12px 16px; margin: 0 auto 25px; font-size: 13px; color: #facc15; text-align: left; line-height: 1.5;">
                ⏱️ <strong>Time-Sensitive:</strong> This security code expires in <strong>${expiresMinutes} minutes</strong> and allows a maximum of 5 attempts.
              </div>

              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                If you did not request a password reset, your credentials are still secure. Please contact your Super Administrator immediately.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #080f1e; padding: 18px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b;">
              S CAR TRAVELS PREMIUM • Proprietor: SRINU • Kotananduru, Andhra Pradesh
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildAdminPasswordResetOtpEmailText({ adminName, otp, expiresMinutes = 5 }) {
  const name = adminName || 'Administrator';
  return `S CAR TRAVELS PREMIUM - PASSWORD RESET VERIFICATION
=====================================================
Hello ${name},

A password reset was requested for your administrator account.
Your 8-digit security verification code is:

    ${otp}

This code will expire in ${expiresMinutes} minutes and can only be used once.
Do not share this code with anyone.

If you did not request this password reset, please contact your Super Administrator immediately.
=====================================================
S CAR TRAVELS PREMIUM • Kotananduru, Andhra Pradesh`.trim();
}

/**
 * Sends 8-digit password reset OTP email
 */
export async function sendAdminPasswordResetOtpEmail({ email, adminName, otp, expiresMinutes = 5 }, customClient = null) {
  if (!email || !otp) {
    return { success: false, error: 'Email and OTP code are required' };
  }

  if (process.env.TEST_FORCE_RESEND_FAIL === 'true') {
    return { success: false, error: 'Simulated Resend delivery failure' };
  }

  if (process.env.NODE_ENV === 'test' || process.env.RESEND_MOCK === 'true') {
    lastDispatchedResetOtpForTest = {
      email: email.trim().toLowerCase(),
      recipient: email.trim().toLowerCase(),
      otp,
      timestamp: Date.now()
    };
  }

  const client = customClient || getResendClient();

  if (!client) {
    if (process.env.NODE_ENV === 'test' || process.env.RESEND_MOCK === 'true') {
      console.log(`[Password Reset Mock] Simulated OTP dispatch for ${email} in test mode`);
      return { success: true, messageId: 'mock_reset_otp_msg_id' };
    }

    console.warn('[Password Reset] Cannot send OTP: RESEND_API_KEY is not configured on server.');
    return {
      success: false,
      skipped: true,
      reason: 'RESEND_API_KEY_NOT_CONFIGURED',
      error: 'RESEND_API_KEY is not configured on the server.'
    };
  }

  const fromEmail = getFromEmail();
  const subject = `🔐 S CAR TRAVELS PREMIUM - Password Reset Code`;

  try {
    const html = buildAdminPasswordResetOtpEmailHtml({ adminName, otp, expiresMinutes });
    const text = buildAdminPasswordResetOtpEmailText({ adminName, otp, expiresMinutes });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: email.trim().toLowerCase(),
      subject,
      html,
      text
    });

    if (error) {
      console.warn('[Password Reset] Resend delivery error:', error.message || error);
      return { success: false, error: error.message || 'Resend delivery failed' };
    }

    console.log(`[Password Reset] OTP dispatched to ${email.trim().toLowerCase()} (ID: ${data?.id})`);
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.warn('[Password Reset] Exception while sending OTP email:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Builds HTML confirmation email when admin password has been changed
 */
export function buildAdminPasswordChangedEmailHtml({ adminName, timestamp, clientIp }) {
  const name = adminName || 'Administrator';
  const formattedTime = timestamp ? new Date(timestamp).toUTCString() : new Date().toUTCString();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Security Alert - Password Changed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050507; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #050507; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #0f172a; border-radius: 12px; overflow: hidden; border: 1px solid rgba(229, 184, 59, 0.3); box-shadow: 0 15px 35px rgba(0,0,0,0.8);">
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 25px 30px; border-bottom: 1px solid rgba(255,255,255,0.08);">
              <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #f6d365; letter-spacing: 0.5px;">
                S CAR TRAVELS PREMIUM
              </h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">
                Security Alert • Kotananduru, AP
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <div style="background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; color: #4ade80; font-size: 14px; font-weight: 600;">
                🛡️ Your Administrator Password Was Successfully Reset
              </div>

              <p style="margin: 0 0 15px; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
                Hello <strong>${name}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                This email confirms that the password for your administrator account was updated on <strong>${formattedTime}</strong>.
              </p>

              <div style="background: #020617; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px; color: #cbd5e1;">
                <div style="margin-bottom: 6px;"><span style="color: #64748b;">Account:</span> <strong>${name}</strong></div>
                <div style="margin-bottom: 6px;"><span style="color: #64748b;">Time:</span> ${formattedTime}</div>
                <div><span style="color: #64748b;">Session Status:</span> All previous sessions have been signed out</div>
              </div>

              <p style="margin: 0; font-size: 13px; color: #ef4444; line-height: 1.5; font-weight: 600;">
                ⚠️ If you did NOT perform this password reset, your account may be compromised. Please contact Proprietor Srinu (+91 9550641408) immediately.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #080f1e; padding: 18px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b;">
              S CAR TRAVELS PREMIUM • Proprietor: SRINU • Kotananduru, Andhra Pradesh
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildAdminPasswordChangedEmailText({ adminName, timestamp }) {
  const name = adminName || 'Administrator';
  const formattedTime = timestamp ? new Date(timestamp).toUTCString() : new Date().toUTCString();
  return `S CAR TRAVELS PREMIUM - SECURITY ALERT: PASSWORD CHANGED
=====================================================
Hello ${name},

This email confirms that the password for your administrator account was successfully reset on ${formattedTime}.
All prior active sessions for this account have been invalidated.

IF YOU DID NOT PERFORM THIS ACTION:
Please contact Proprietor Srinu (+91 9550641408) immediately.
=====================================================
S CAR TRAVELS PREMIUM • Kotananduru, Andhra Pradesh`.trim();
}

/**
 * Sends confirmation email when password was reset
 */
export async function sendAdminPasswordChangedEmail({ email, adminName, timestamp, clientIp }, customClient = null) {
  if (!email) {
    return { success: false, error: 'Email is required' };
  }

  if (process.env.NODE_ENV === 'test' || process.env.RESEND_MOCK === 'true') {
    lastDispatchedPasswordChangedForTest = {
      email: email.trim().toLowerCase(),
      recipient: email.trim().toLowerCase(),
      adminName,
      timestamp,
      clientIp
    };
  }

  const client = customClient || getResendClient();

  if (!client) {
    if (process.env.NODE_ENV === 'test' || process.env.RESEND_MOCK === 'true') {
      console.log(`[Password Changed Mock] Simulated security alert for ${email} in test mode`);
      return { success: true, messageId: 'mock_pwd_changed_msg_id' };
    }

    console.warn('[Password Changed] Cannot send alert: RESEND_API_KEY is not configured on server.');
    return { success: false, skipped: true };
  }

  const fromEmail = getFromEmail();
  const subject = `🛡️ S CAR TRAVELS PREMIUM - Password Changed`;

  try {
    const html = buildAdminPasswordChangedEmailHtml({ adminName, timestamp, clientIp });
    const text = buildAdminPasswordChangedEmailText({ adminName, timestamp });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: email.trim().toLowerCase(),
      subject,
      html,
      text
    });

    if (error) {
      console.warn('[Password Changed] Resend delivery error:', error.message || error);
      return { success: false, error: error.message };
    }

    console.log(`[Password Changed] Security alert dispatched to ${email.trim().toLowerCase()} (ID: ${data?.id})`);
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.warn('[Password Changed] Exception while sending security alert:', err.message);
    return { success: false, error: err.message };
  }
}

