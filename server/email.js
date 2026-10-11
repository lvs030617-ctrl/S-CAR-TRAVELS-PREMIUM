import { Resend } from 'resend';

// Default recipient if not configured in environment
export const DEFAULT_ADMIN_EMAIL = 'srinucartravelsremium@gmail.com';
export const DEFAULT_FROM_EMAIL = 'S CAR TRAVELS PREMIUM <onboarding@resend.dev>';

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
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;
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
