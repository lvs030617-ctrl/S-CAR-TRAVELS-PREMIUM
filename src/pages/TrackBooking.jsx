import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Clock, CheckCircle2, Phone, MessageCircle, AlertCircle, MapPin, Calendar, Users, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import StatusBadge from '../components/StatusBadge';
import { apiUrl } from '../lib/api';

export default function TrackBooking() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();

  const [referenceNo, setReferenceNo] = useState(searchParams.get('ref') || '');
  const [phone, setPhone] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (searchParams.get('ref')) {
      handleSearch(searchParams.get('ref'), '');
    }
  }, [searchParams]);

  const handleSearch = async (refVal, phoneVal) => {
    setErrorMsg('');
    setBooking(null);

    const refQuery = (refVal || referenceNo).trim();
    const phoneQuery = (phoneVal || phone).trim();

    if (!refQuery && !phoneQuery) {
      setErrorMsg('Please enter either a Booking Reference or Mobile Number');
      return;
    }

    setLoading(true);
    try {
      const url = apiUrl(`/api/public/bookings/track?reference_no=${encodeURIComponent(refQuery)}&phone=${encodeURIComponent(phoneQuery)}`);
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.trackNotFound);
      }

      setBooking(data.booking);
    } catch (err) {
      setErrorMsg(err.message || t.trackNotFound);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleSearch(referenceNo, phone);
  };

  return (
    <div className="section-spacing">
      <div className="container" style={{ maxWidth: '820px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>
            <Clock size={14} />
            <span>CUSTOMER RESERVATION TRACKER</span>
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
            {t.trackTitle}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
            {t.trackSubtitle}
          </p>
        </div>

        {/* Search Card */}
        <form onSubmit={onSubmit} className="gold-card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
          <div className="grid-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t.trackRefLabel}</label>
              <input
                type="text"
                placeholder="e.g. SCT-2026-9481"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t.trackPhoneLabel}</label>
              <input
                type="tel"
                placeholder="10-digit registered number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-gold"
            style={{ width: '100%', padding: '0.85rem' }}
          >
            <Search size={18} />
            <span>{loading ? 'Searching...' : t.btnTrack}</span>
          </button>
        </form>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px',
            padding: '1.25rem',
            color: '#fca5a5',
            fontSize: '0.9rem',
            textAlign: 'center',
            marginBottom: '2rem'
          }}>
            {errorMsg}
          </div>
        )}

        {/* Booking Details Display */}
        {booking && (
          <div className="gold-card animate-fade-in" style={{ padding: '2rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Booking Reference</span>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--gold-bright)' }}>
                  {booking.reference_no}
                </div>
              </div>
              <div>
                <StatusBadge status={booking.status} />
              </div>
            </div>

            {/* Status explanation */}
            {booking.status === 'pending' && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                color: '#fbbf24',
                fontSize: '0.85rem',
                marginBottom: '1.5rem'
              }}>
                <strong>Pending Owner Approval:</strong> Srinu is verifying the Ertiga schedule for your date. You can message on WhatsApp or call 9550641408 for immediate priority.
              </div>
            )}

            {booking.status === 'confirmed' && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                color: '#4ade80',
                fontSize: '0.85rem',
                marginBottom: '1.5rem'
              }}>
                <strong>Confirmed Trip:</strong> The Ertiga is reserved for your journey! Srinu will arrive at the scheduled pickup point.
              </div>
            )}

            <div className="grid-2" style={{ gap: '1.25rem', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Customer:</span>{' '}
                <strong style={{ color: 'var(--text-main)' }}>{booking.customer_name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Phone:</span>{' '}
                <strong style={{ color: 'var(--text-main)' }}>{booking.customer_phone}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Route:</span>{' '}
                <strong style={{ color: 'var(--gold-bright)' }}>{booking.pickup_location} → {booking.destination}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Pickup:</span>{' '}
                <strong style={{ color: 'var(--text-main)' }}>{new Date(booking.pickup_datetime).toLocaleString('en-IN')}</strong>
              </div>
              {booking.return_datetime && (
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Return:</span>{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{new Date(booking.return_datetime).toLocaleString('en-IN')}</strong>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Service:</span>{' '}
                <strong style={{ color: 'var(--text-main)' }}>{booking.service_type === 'self_drive' ? 'Self Drive' : 'With Driver'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Trip Type:</span>{' '}
                <strong style={{ color: 'var(--text-main)' }}>{booking.trip_type.replace('_', ' ').toUpperCase()}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Passengers:</span>{' '}
                <strong style={{ color: 'var(--text-main)' }}>{booking.passengers} persons</strong>
              </div>
            </div>

            {/* Price Details */}
            <div style={{
              background: 'var(--card-subtle)',
              border: '1px solid var(--border-gold)',
              borderRadius: '10px',
              padding: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  {booking.final_agreed_price ? 'Confirmed Final Fare' : 'Preliminary Estimated Range'}
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--gold-bright)' }}>
                  {booking.final_agreed_price
                    ? `₹${booking.final_agreed_price.toLocaleString('en-IN')}`
                    : booking.estimated_min_price
                    ? `₹${booking.estimated_min_price.toLocaleString('en-IN')} – ₹${booking.estimated_max_price.toLocaleString('en-IN')}`
                    : 'Quote upon confirmation'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <a
                  href="tel:+919550641408"
                  className="btn btn-phone btn-sm"
                >
                  <Phone size={14} />
                  <span>Call Srinu</span>
                </a>

                <a
                  href={`https://wa.me/919550641408?text=${encodeURIComponent(`Hello Srinu Garu, Following up on Booking Ref ${booking.reference_no} (${booking.customer_name})`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-whatsapp btn-sm"
                >
                  <MessageCircle size={14} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {booking.admin_notes && (
              <div style={{ background: 'var(--card-subtle)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--gold-bright)', fontWeight: '700' }}>Note from Owner: </span>
                <span style={{ color: 'var(--text-muted)' }}>{booking.admin_notes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
