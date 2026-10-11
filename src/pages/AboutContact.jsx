import { Link } from 'react-router-dom';
import { Phone, MessageCircle, MapPin, Clock, ShieldCheck, Car, Heart, ExternalLink } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import PageBanner from '../components/PageBanner';

export default function AboutContact() {
  const { lang } = useLanguage();

  return (
    <div>
      {/* Top Banner (Matching Mockup Panel 6) */}
      <PageBanner
        title={lang === 'te' ? 'ఎస్ కార్ ట్రావెల్స్ ప్రీమియం గురించి' : 'About S CAR TRAVELS PREMIUM'}
        subtitle={lang === 'te' ? 'మీ నమ్మకమైన ప్రయాణ భాగస్వామి' : 'Your Trusted Travel Partner'}
      />

      <div className="container" style={{ paddingBottom: '4rem' }}>
        <div className="grid-2" style={{ gap: '2.5rem', alignItems: 'flex-start' }}>
          {/* Left Column: Our Story & Get In Touch */}
          <div>
            {/* Our Story Card */}
            <div className="gold-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                Our Story
              </h2>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.95rem', marginBottom: '1rem' }}>
                <strong>S CAR TRAVELS PREMIUM</strong> is a reliable car rental service based in <strong>Kotananduru, Andhra Pradesh</strong>. We are committed to providing safe, comfortable and affordable travel solutions for your every journey.
              </p>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.95rem', marginBottom: '1.25rem' }}>
                With a single well-maintained white Suzuki Ertiga, we ensure a personalized and hassle-free travel experience.
              </p>
              <div style={{ color: 'var(--gold-bright)', fontStyle: 'italic', fontWeight: '700', fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                Mee Prayanam… Maa Badhyata!
              </div>

              {/* 3 Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9999px',
                  padding: '0.4rem 1rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <ShieldCheck size={14} style={{ color: 'var(--gold-bright)' }} />
                  <span>Safe Travel</span>
                </span>

                <span style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9999px',
                  padding: '0.4rem 1rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <Car size={14} style={{ color: 'var(--gold-bright)' }} />
                  <span>Comfortable Rides</span>
                </span>

                <span style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9999px',
                  padding: '0.4rem 1rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <Heart size={14} style={{ color: 'var(--gold-bright)' }} />
                  <span>Customer Value</span>
                </span>
              </div>
            </div>

            {/* Get In Touch Card */}
            <div className="gold-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                Get In Touch
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.92rem' }}>
                <a
                  href="tel:+919550641408"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}
                >
                  <Phone size={18} style={{ color: 'var(--gold-bright)' }} />
                  <span>9550641408</span>
                </a>

                <a
                  href="https://wa.me/919550641408"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#25d366' }}
                >
                  <MessageCircle size={18} />
                  <span>Chat on WhatsApp</span>
                </a>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
                  <MapPin size={18} style={{ color: 'var(--gold-bright)' }} />
                  <span>Kotananduru, Andhra Pradesh</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
                  <Clock size={18} style={{ color: 'var(--gold-bright)' }} />
                  <span>Mon - Sun : 6:00 AM - 10:00 PM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Business Details & Map */}
          <div>
            {/* Business Details Card */}
            <div className="gold-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                Business Details
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Business Name</span>
                  <strong style={{ color: 'var(--text-main)' }}>S CAR TRAVELS PREMIUM</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Proprietor</span>
                  <strong style={{ color: 'var(--text-main)' }}>SRINU</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Phone / WhatsApp</span>
                  <strong style={{ color: 'var(--gold-bright)' }}>9550641408</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Starting Point</span>
                  <strong style={{ color: 'var(--text-main)' }}>Kotananduru, Andhra Pradesh</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Vehicle</span>
                  <strong style={{ color: 'var(--text-main)' }}>White Suzuki Ertiga (AP03 CZ 4567)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Services</span>
                  <strong style={{ color: 'var(--text-main)', textAlign: 'right' }}>
                    Driver rental / Self-drive / One-way / Round trip
                  </strong>
                </div>
              </div>
            </div>

            {/* Interactive Styled Map Card */}
            <div className="gold-card" style={{ overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: '220px', background: '#1e293b' }}>
                <iframe
                  title="Kotananduru Map"
                  src="https://maps.google.com/maps?q=Kotananduru,Andhra+Pradesh&t=&z=13&ie=UTF8&iwloc=&output=embed"
                  style={{ width: '100%', height: '100%', border: 0 }}
                  loading="lazy"
                />
              </div>

              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <a
                  href="https://maps.google.com/?q=Kotananduru,Andhra+Pradesh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-gold btn-sm"
                  style={{ width: '100%', borderRadius: '9999px' }}
                >
                  <MapPin size={14} />
                  <span>View on Google Maps</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
