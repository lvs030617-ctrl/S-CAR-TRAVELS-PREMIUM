import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Clock, CreditCard, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import PageBanner from '../components/PageBanner';
import { apiUrl } from '../lib/api';

export default function Booking() {
  const { lang } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    pickup_location: 'Kotananduru',
    destination: searchParams.get('dest') || 'Visakhapatnam',
    trip_type: searchParams.get('trip') || 'round_trip',
    pickup_datetime: '',
    return_datetime: '',
    passengers: '4',
    luggage_count: '2',
    service_type: searchParams.get('service') === 'self_drive' ? 'self_drive' : 'with_driver',
    special_notes: '',
    agreeTerms: true
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Min pickup date is current time
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const minDateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const destinationsList = [
    'Visakhapatnam',
    'Kakinada',
    'Rajahmundry',
    'Vijayawada',
    'Tirupati',
    'Araku Valley',
    'Annavaram Temple',
    'Tuni',
    'Other (Enter in notes)'
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.customer_name.trim()) {
      setErrorMsg('Please enter customer full name');
      return;
    }

    const cleanPhone = formData.customer_phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!formData.pickup_datetime) {
      setErrorMsg('Please select pickup date & time');
      return;
    }

    if (new Date(formData.pickup_datetime).getTime() < new Date().getTime() - 10 * 60 * 1000) {
      setErrorMsg('Pickup date & time cannot be in the past');
      return;
    }

    if (formData.return_datetime && new Date(formData.return_datetime).getTime() <= new Date(formData.pickup_datetime).getTime()) {
      setErrorMsg('Return date & time must be after pickup date & time');
      return;
    }

    if (!formData.agreeTerms) {
      setErrorMsg('Please agree to the Terms & Conditions and Privacy Policy');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/public/bookings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit booking');
      }

      sessionStorage.setItem('scar_last_booking', JSON.stringify({
        booking: data.booking,
        whatsappUrl: data.whatsappUrl,
        advisory: data.advisory
      }));

      navigate(`/confirmation?ref=${data.reference_no}`);
    } catch (err) {
      setErrorMsg(err.message || 'Error submitting booking inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Top Banner (Matching Mockup Panel 5) */}
      <PageBanner
        title={lang === 'te' ? 'మీ ట్రిప్‌ని బుక్ చేసుకోండి' : 'Book Your Trip'}
        subtitle={lang === 'te' ? 'వివరాలను పూరించండి, మేము త్వరలోనే సంప్రదిస్తాము.' : "Fill in the details and we'll get back to you soon."}
      />

      <div className="container" style={{ maxWidth: '980px', paddingBottom: '4rem' }}>
        <form onSubmit={handleSubmit} className="gold-card" style={{ padding: '2.5rem' }}>
          {errorMsg && (
            <div style={{
              background: 'var(--color-error-bg)',
              border: '1px solid rgba(248, 113, 113, 0.35)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              color: 'var(--color-error)',
              fontSize: '0.88rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              animation: 'slideDown 0.2s ease both'
            }}>
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Name, Phone, Pickup Location */}
          <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                placeholder="Enter your name"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Phone Number *</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <span style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.85rem 0.75rem',
                  color: 'var(--gold-bright)',
                  fontWeight: '700',
                  fontSize: '0.9rem'
                }}>
                  +91
                </span>
                <input
                  type="tel"
                  required
                  placeholder="Enter phone number"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Pickup Location *</label>
              <input
                type="text"
                required
                placeholder="Enter pickup location"
                name="pickup_location"
                value={formData.pickup_location}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          {/* Row 2: Destination, Trip Type, Pickup Date & Time */}
          <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Destination *</label>
              <select
                name="destination"
                value={formData.destination}
                onChange={handleChange}
                className="form-select"
              >
                {destinationsList.map((d, i) => (
                  <option key={i} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Trip Type *</label>
              <select
                name="trip_type"
                value={formData.trip_type}
                onChange={handleChange}
                className="form-select"
              >
                <option value="round_trip">Round Trip</option>
                <option value="one_way">One Way</option>
                <option value="local_8h">Local (8 hrs / 80 km)</option>
                <option value="full_day">Full Day (10–12 hrs)</option>
                <option value="temple_tour">Temple Tour</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Pickup Date & Time *</label>
              <input
                type="datetime-local"
                required
                min={minDateTime}
                name="pickup_datetime"
                value={formData.pickup_datetime}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          {/* Row 3: Return Date & Time, Passengers, Luggage */}
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Return Date & Time (optional)</label>
              <input
                type="datetime-local"
                min={formData.pickup_datetime || minDateTime}
                name="return_datetime"
                value={formData.return_datetime}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Passengers * (Max 6 for Ertiga)</label>
              <select
                name="passengers"
                value={formData.passengers}
                onChange={handleChange}
                className="form-select"
              >
                <option value="1">1 Passenger</option>
                <option value="2">2 Passengers</option>
                <option value="3">3 Passengers</option>
                <option value="4">4 Passengers</option>
                <option value="5">5 Passengers</option>
                <option value="6">6 Passengers (Full Ertiga Comfort)</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Luggage *</label>
              <select
                name="luggage_count"
                value={formData.luggage_count}
                onChange={handleChange}
                className="form-select"
              >
                <option value="1">1 Bag</option>
                <option value="2">2 Bags</option>
                <option value="3">3 Bags</option>
                <option value="4">4+ Bags</option>
              </select>
            </div>
          </div>

          {/* Row 4: Service Preference & Special Requests */}
          <div className="grid-2" style={{ marginBottom: '1.5rem', alignItems: 'flex-start' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Service Preference *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)', fontSize: '0.92rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="service_type"
                    value="with_driver"
                    checked={formData.service_type === 'with_driver'}
                    onChange={handleChange}
                    style={{ accentColor: 'var(--gold-bright)' }}
                  />
                  <span>Driver with Car (Chauffeur driven)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)', fontSize: '0.92rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="service_type"
                    value="self_drive"
                    checked={formData.service_type === 'self_drive'}
                    onChange={handleChange}
                    style={{ accentColor: 'var(--gold-bright)' }}
                  />
                  <span>Self Drive (as per legal/insurance terms)</span>
                </label>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Special Requests / Notes</label>
              <textarea
                name="special_notes"
                rows={3}
                placeholder="Any special requirements, child on board, flight timings..."
                value={formData.special_notes}
                onChange={handleChange}
                className="form-textarea"
              />
            </div>
          </div>

          {/* Terms Agreement Checkbox */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.86rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="agreeTerms"
                checked={formData.agreeTerms}
                onChange={handleChange}
                style={{ accentColor: 'var(--gold-bright)' }}
              />
              <span>
                I agree to the <Link to="/privacy-terms" style={{ color: 'var(--gold-bright)', textDecoration: 'underline' }}>Terms & Conditions</Link> and <Link to="/privacy-terms" style={{ color: 'var(--gold-bright)', textDecoration: 'underline' }}>Privacy Policy</Link>
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-gold btn-lg"
            style={{
              width: '100%',
              borderRadius: '9999px',
              padding: '0.9rem',
              fontSize: '1.05rem',
              marginBottom: '2rem',
              gap: '0.65rem'
            }}
          >
            {submitting && <span className="spinner" />}
            <span>{submitting ? 'Submitting Booking...' : 'Submit Booking Inquiry'}</span>
          </button>

          {/* Bottom 3 Trust Badges */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1.5rem',
            color: 'var(--text-muted)',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={16} style={{ color: 'var(--gold-bright)' }} />
              <span>Your details are safe with us</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} style={{ color: 'var(--gold-bright)' }} />
              <span>We'll confirm availability</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={16} style={{ color: 'var(--gold-bright)' }} />
              <span>No payment online required</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
