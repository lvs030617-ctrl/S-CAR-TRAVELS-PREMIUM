import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, MessageCircle, MapPin, UserCheck, Key,
  Navigation, RefreshCw, ArrowRight, ShieldCheck,
  Star, CalendarCheck, Clock, Award
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import BrandLogo from '../components/BrandLogo';
import QuickEstimator from '../components/QuickEstimator';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { apiUrl } from '../lib/api';

export default function Home() {
  const { lang } = useLanguage();
  const [config, setConfig] = useState(null);

  const destinationsRef = useScrollReveal({}, true);
  const ctaRef = useScrollReveal();
  const trustRef = useScrollReveal({}, true);

  useEffect(() => {
    fetch(apiUrl('/api/public/config'))
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(() => {});
  }, []);

  const featurePills = [
    {
      title: lang === 'te' ? 'డ్రైవర్ రెంటల్' : 'Driver Rental',
      subtitle: lang === 'te' ? 'ప్రొఫెషనల్ & సురక్షితం' : 'Professional & Safe',
      icon: UserCheck,
      to: '/services'
    },
    {
      title: lang === 'te' ? 'సెల్ఫ్ డ్రైవ్' : 'Self Drive',
      subtitle: lang === 'te' ? 'సౌకర్యవంతమైన ప్రయాణం' : 'Flexible & Convenient',
      icon: Key,
      to: '/services'
    },
    {
      title: lang === 'te' ? 'వన్-వే ట్రిప్స్' : 'One-Way Trips',
      subtitle: lang === 'te' ? 'మీ మార్గం, మా సపోర్ట్' : 'Your Way, Our Support',
      icon: Navigation,
      to: '/services'
    },
    {
      title: lang === 'te' ? 'రౌండ్ ట్రిప్స్' : 'Round Trips',
      subtitle: lang === 'te' ? 'అన్ని గమ్యస్థానాలకు' : 'For All Destinations',
      icon: RefreshCw,
      to: '/services'
    }
  ];

  const trustPoints = [
    { icon: ShieldCheck, label: lang === 'te' ? 'సురక్షిత ప్రయాణం' : 'Safe Travel', sub: lang === 'te' ? 'అనుభవంతో' : 'Experienced Driver' },
    { icon: Star, label: lang === 'te' ? 'ఒకే వాహనం' : 'Single Vehicle', sub: lang === 'te' ? 'శుభ్రమైన ఎర్టిగా' : 'Clean White Ertiga' },
    { icon: Clock, label: lang === 'te' ? '6AM – 10PM' : '6AM – 10PM', sub: lang === 'te' ? 'అందుబాటు' : 'Available Daily' },
    { icon: Award, label: lang === 'te' ? '₹1,000+' : '₹1,000+', sub: lang === 'te' ? 'ప్రారంభ ధర' : 'Starting Price' },
  ];

  return (
    <div>
      {/* 1. HERO SECTION */}
      <section className="hero-section">
        {/* Atmospheric glow */}
        <div className="hero-glow" />

        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="grid-2" style={{ alignItems: 'center', gap: '3rem', marginBottom: '3rem' }}>
            {/* Left Content */}
            <div>
              <div style={{ marginBottom: '1.5rem' }} className="anim-fade-up delay-0">
                <BrandLogo size="lg" />
              </div>

              <div style={{ marginBottom: '1.25rem' }} className="anim-fade-up delay-1">
                <h1 style={{
                  fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
                  fontWeight: '900',
                  lineHeight: 1.1,
                  color: '#ffffff'
                }}>
                  Mee Prayanam…<br />
                  <span style={{ color: 'var(--gold-bright)' }}>Maa Badhyata!</span>
                </h1>
                {lang === 'te' && (
                  <div style={{ fontSize: '1.2rem', color: '#fde68a', marginTop: '0.4rem', fontWeight: '700' }}>
                    మీ ప్రయాణం… మా బాధ్యత!
                  </div>
                )}
              </div>

              <div className="anim-fade-up delay-2" style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: '1.1rem',
                lineHeight: 1.65,
                marginBottom: '2rem',
                maxWidth: '480px'
              }}>
                <div style={{ color: '#e2e8f0', fontWeight: '600', marginBottom: '0.25rem' }}>
                  Comfortable • Safe • Reliable
                </div>
                <div>Car Rental Services from</div>
                <div style={{ color: '#ffffff', fontWeight: '700' }}>
                  Kotananduru, Andhra Pradesh
                </div>
              </div>

              <div className="anim-fade-up delay-3" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                <a
                  href="tel:+919550641408"
                  className="btn btn-gold btn-lg"
                  style={{ borderRadius: '9999px', padding: '0.85rem 2rem', fontSize: '1rem' }}
                >
                  <Phone size={18} />
                  <span>Call Now</span>
                </a>

                <a
                  href="https://wa.me/919550641408?text=Hello%20Srinu%20Garu%2C%20I%20want%20to%20book%20the%20white%20Suzuki%20Ertiga%20from%20Kotananduru."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-whatsapp btn-lg"
                  style={{ borderRadius: '9999px', padding: '0.85rem 2rem', fontSize: '1rem' }}
                >
                  <MessageCircle size={18} />
                  <span>WhatsApp Booking</span>
                </a>
              </div>
            </div>

            {/* Right Side: Ertiga Hero Image */}
            <div className="anim-fade-up delay-2" style={{ position: 'relative' }}>
              <div className="hero-image-wrapper">
                <img
                  src="/images/ertiga-hero.jpg"
                  alt="S CAR TRAVELS White Suzuki Ertiga on Andhra Road"
                  loading="eager"
                />

                <div className="hero-badge" style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  background: 'rgba(8, 15, 30, 0.88)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid var(--border-gold)',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.78rem',
                  color: 'var(--gold-bright)',
                  fontWeight: '700'
                }}>
                  <ShieldCheck size={14} />
                  <span>Single Dedicated Vehicle • AP03 CZ 4567</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Pills Strip */}
          <div className="anim-fade-up delay-4" style={{
            background: 'rgba(17, 29, 56, 0.85)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '1.25rem',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            marginBottom: '1rem'
          }}>
            <div className="grid-4" style={{ gap: '1rem' }}>
              {featurePills.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <Link
                    key={idx}
                    to={p.to}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--gold-primary)';
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(224, 184, 90, 0.15)',
                      color: 'var(--gold-bright)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.95rem' }}>
                        {p.title}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>
                        {p.subtitle}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Starting Point Badge */}
          <div className="anim-fade-up delay-5" style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--gold-bright)',
              fontSize: '0.9rem',
              fontWeight: '700'
            }}>
              <MapPin size={16} />
              <span>Starting Point: Kotananduru, Andhra Pradesh</span>
            </span>
          </div>
        </div>
      </section>

      {/* 2. TRUST POINTS STRIP */}
      <section style={{ background: 'var(--bg-subtle)', padding: '1.5rem 0', borderBottom: '1px solid var(--border-subtle)', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div ref={trustRef} className="grid-4" style={{ gap: '1rem' }}>
            {trustPoints.map((point, idx) => {
              const Icon = point.icon;
              return (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(224, 184, 90, 0.12)',
                    border: '1px solid var(--border-gold)',
                    color: 'var(--gold-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>{point.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{point.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. QUICK FARE ESTIMATOR */}
      <section className="section-spacing">
        <div className="container" style={{ maxWidth: '880px' }}>
          <QuickEstimator destinations={config?.destinations || []} />
        </div>
      </section>

      {/* 4. POPULAR DESTINATIONS */}
      <section className="section-spacing section-alt">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div className="section-label">
                <MapPin size={12} />
                {lang === 'te' ? 'గమ్యస్థానాలు' : 'Destinations'}
              </div>
              <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                {lang === 'te' ? 'ప్రముఖ గమ్యస్థానాలు' : 'Popular Destinations'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                Direct trips from Kotananduru in our comfortable White Suzuki Ertiga
              </p>
            </div>
            <Link to="/destinations" className="btn btn-outline-gold btn-sm">
              <span>View All Routes</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div ref={destinationsRef} className="grid-3" style={{ gap: '1.5rem' }}>
            {(config?.destinations || []).slice(0, 3).map((d) => (
              <div key={d.id} className="gold-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>{lang === 'te' ? d.name_te : d.name_en}</h3>
                  <span className="badge badge-blue">~{d.distance_km} km</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flex: 1, marginBottom: '1.25rem', lineHeight: 1.6 }}>
                  {lang === 'te' ? d.description_te : d.description_en}
                </p>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.15rem' }}>Round Trip</div>
                    <div style={{ fontWeight: '800', color: 'var(--gold-primary)', fontSize: '1rem' }}>₹{d.round_trip_price_min} – ₹{d.round_trip_price_max}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.15rem' }}>One Way</div>
                    <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>₹{d.one_way_price_min}+</div>
                  </div>
                </div>
                <Link to={`/book?dest=${encodeURIComponent(lang === 'te' ? d.name_te : d.name_en)}`} className="btn btn-gold btn-sm" style={{ width: '100%' }}>
                  <span>Book for this Route</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CTA BANNER */}
      <section className="section-spacing">
        <div className="container">
          <div ref={ctaRef} className="reveal" style={{
            background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
            border: '1px solid var(--border-gold)',
            borderRadius: '20px',
            padding: '3rem 2.5rem',
            textAlign: 'center',
            maxWidth: '920px',
            margin: '0 auto',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Subtle gold glow decoration */}
            <div style={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(224,184,90,0.08) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />

            <div className="section-label" style={{ justifyContent: 'center' }}>
              <CalendarCheck size={12} />
              Plan Your Journey
            </div>
            <h2 style={{ fontSize: '2rem', color: 'var(--text-main)', marginBottom: '0.75rem', position: 'relative' }}>
              Planning a Journey from Kotananduru?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '620px', margin: '0 auto 2rem', lineHeight: 1.65, position: 'relative' }}>
              Whether it is a sacred temple darshan at Annavaram or Tirupati, an airport drop to Vizag,
              or a family function, our single clean white Suzuki Ertiga is at your service.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', position: 'relative' }}>
              <Link to="/book" className="btn btn-gold btn-lg">
                <CalendarCheck size={18} />
                <span>Book Your Trip</span>
              </Link>
              <a href="tel:+919550641408" className="btn btn-outline-gold btn-lg">
                <Phone size={18} />
                <span>Call Srinu: 9550641408</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
