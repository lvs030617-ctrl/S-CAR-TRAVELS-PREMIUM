import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, MessageCircle, Phone, ArrowRight, ShieldCheck, MapPin, Calendar, Users, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import StatusBadge from '../components/StatusBadge';
import { apiUrl } from '../lib/api';

export default function Confirmation() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const refNo = searchParams.get('ref');

  const [bookingData, setBookingData] = useState(null);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [advisory, setAdvisory] = useState('');

  useEffect(() => {
    // Check session storage first
    const saved = sessionStorage.getItem('scar_last_booking');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.booking?.reference_no === refNo) {
          setBookingData(parsed.booking);
          setWhatsappUrl(parsed.whatsappUrl);
          setAdvisory(parsed.advisory);
          return;
        }
      } catch (e) {}
    }

    // Otherwise fetch via public tracking endpoint
    if (refNo) {
      fetch(apiUrl(`/api/public/bookings/track?reference_no=${encodeURIComponent(refNo)}`))
        .then(res => res.json())
        .then(data => {
          if (data.booking) {
            setBookingData(data.booking);
            // Construct fallback WhatsApp link
            const msg = `*Namaste Srinu Garu, Following up on my S CAR TRAVELS Booking Ref: ${data.booking.reference_no}*\nCustomer: ${data.booking.customer_name}\nRoute: ${data.booking.pickup_location} to ${data.booking.destination}\nPickup: ${data.booking.pickup_datetime}\nPlease confirm availability for our Ertiga journey.`;
            setWhatsappUrl(`https://wa.me/919550641408?text=${encodeURIComponent(msg)}`);
          }
        })
        .catch(() => {});
    }
  }, [refNo]);

  return (
    <div className="section-spacing">
      <div className="container" style={{ maxWidth: '820px' }}>
        <div className="gold-card" style={{ padding: '2.5rem', textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '2px solid rgba(245, 158, 11, 0.4)',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem'
          }}>
            <Clock size={36} />
          </div>

          <h1 style={{ fontSize: '2rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            {t.confirmTitle}
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.25rem' }}>
            {t.confirmSubtitle}
          </p>

          <div style={{
            display: 'inline-block',
            fontSize: '1.8rem',
            fontWeight: '900',
            letterSpacing: '0.08em',
            color: 'var(--gold-bright)',
            background: 'var(--card-subtle)',
            padding: '0.65rem 1.75rem',
            borderRadius: '10px',
            border: '1px solid var(--border-gold)',
            marginBottom: '1.5rem'
          }}>
            {refNo || 'SCT-2026-INQUIRY'}
          </div>

          {/* Pending Status Highlight */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '2rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <AlertCircle size={22} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: '700', color: '#fbbf24', marginBottom: '0.2rem' }}>
                {t.confirmStatusPending}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                {advisory || t.confirmStatusDesc}
              </div>
            </div>
          </div>

          {/* Immediate Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginBottom: '2.5rem' }}>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp btn-lg"
                style={{ flex: '1 1 280px' }}
              >
                <MessageCircle size={20} />
                <span>{t.btnSendWhatsapp}</span>
              </a>
            )}

            <a
              href="tel:+919550641408"
              className="btn btn-phone btn-lg"
              style={{ flex: '1 1 240px' }}
            >
              <Phone size={20} />
              <span>{t.btnCallSrinu}</span>
            </a>
          </div>

          {/* Trip Summary Card */}
          {bookingData && (
            <div style={{
              background: 'var(--card-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'left',
              marginBottom: '2rem'
            }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                Trip Inquiry Summary
              </h3>

              <div className="grid-2" style={{ gap: '0.85rem', fontSize: '0.88rem' }}>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Customer:</span>{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{bookingData.customer_name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Phone:</span>{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{bookingData.customer_phone}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Route:</span>{' '}
                  <strong style={{ color: 'var(--gold-bright)' }}>{bookingData.pickup_location} → {bookingData.destination}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Pickup:</span>{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{new Date(bookingData.pickup_datetime).toLocaleString('en-IN')}</strong>
                </div>
                {bookingData.return_datetime && (
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Return:</span>{' '}
                    <strong style={{ color: 'var(--text-main)' }}>{new Date(bookingData.return_datetime).toLocaleString('en-IN')}</strong>
                  </div>
                )}
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Service:</span>{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{bookingData.service_type === 'self_drive' ? 'Self Drive' : 'With Chauffeur'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Passengers:</span>{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{bookingData.passengers} persons</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Starter Estimate:</span>{' '}
                  <strong style={{ color: 'var(--gold-bright)' }}>
                    {bookingData.estimated_min_price ? `₹${bookingData.estimated_min_price} – ₹${bookingData.estimated_max_price}` : 'Awaiting quote'}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div style={{ textAlign: 'left', background: 'var(--card-subtle)', padding: '1.25rem', borderRadius: '10px' }}>
            <h4 style={{ color: 'var(--gold-bright)', fontSize: '0.95rem', marginBottom: '0.65rem' }}>
              {t.confirmNextStepTitle}
            </h4>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>{t.confirmStep1}</div>
              <div>{t.confirmStep2}</div>
              <div>{t.confirmStep3}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <Link to={`/track?ref=${refNo}`} className="btn btn-outline-gold btn-sm">
            <span>Track Live Status</span>
          </Link>
          <Link to="/" className="btn btn-gold btn-sm">
            <span>{t.backToHome}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
