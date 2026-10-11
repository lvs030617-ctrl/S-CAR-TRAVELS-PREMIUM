import { Link } from 'react-router-dom';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import PageBanner from '../components/PageBanner';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function Services() {
  const { lang } = useLanguage();

  const services = [
    {
      id: 'driver_rental',
      title: lang === 'te' ? 'డ్రైవర్ రెంటల్' : 'Driver Rental',
      desc: lang === 'te' ? 'మీ సౌకర్యం కోసం ప్రొఫెషనల్ మరియు అనుభవజ్ఞులైన డ్రైవర్లు.' : 'Professional and experienced drivers for your comfort.',
      image: '/images/driver-rental.jpg',
      badge: 'Chauffeur Driven',
      to: '/book?service=with_driver'
    },
    {
      id: 'self_drive',
      title: lang === 'te' ? 'సెల్ఫ్ డ్రైవ్ రెంటల్' : 'Self Drive Rental',
      desc: lang === 'te' ? 'మా సురక్షితమైన వాహనంతో మీ స్వంత దారిలో ప్రయాణించండి.' : 'Drive your own way with our well-maintained vehicle.',
      legalNotice: lang === 'te' ? 'ఒరిజినల్ డ్రైవింగ్ లైసెన్స్, ఆధార్ & రూ. 3,000 సెక్యూరిటీ డిపాజిట్ తప్పనిసరి.' : 'Requires valid original Driving Licence (min 2 yrs), Aadhaar verification, and refundable deposit of ₹3,000.',
      image: '/images/self-drive.jpg',
      badge: 'Self Drive',
      to: '/book?service=self_drive'
    },
    {
      id: 'one_way',
      title: lang === 'te' ? 'వన్-వే ట్రిప్స్' : 'One Way Trips',
      desc: lang === 'te' ? 'తిరిగి వచ్చే ఇబ్బంది లేకుండా మీ గమ్యస్థానానికి వెళ్ళండి.' : 'Travel to your destination without return hassle.',
      image: '/images/ertiga-banner.jpg',
      badge: 'Single Drop',
      to: '/book?trip=one_way'
    },
    {
      id: 'round_trip',
      title: lang === 'te' ? 'రౌండ్ ట్రిప్స్' : 'Round Trips',
      desc: lang === 'te' ? 'అవుట్‌స్టేషన్ మరియు వీకెండ్ ట్రిప్పుల కోసం అత్యుత్తమం.' : 'Perfect for outstation and weekend getaways.',
      image: '/images/araku-valley.jpg',
      badge: 'Outstation',
      to: '/book?trip=round_trip'
    },
    {
      id: 'local_sightseeing',
      title: lang === 'te' ? 'స్థానిక సందర్శన' : 'Local Sightseeing',
      desc: lang === 'te' ? 'సౌకర్యంగా మరియు సులభంగా సమీప ప్రదేశాలను సందర్శించండి.' : 'Explore nearby places with comfort and ease.',
      image: '/images/rajahmundry-bridge.jpg',
      badge: 'Local 8h/80km',
      to: '/book?trip=local_8h'
    },
    {
      id: 'temple_trips',
      title: lang === 'te' ? 'ఆలయ యాత్రలు' : 'Temple Trips',
      desc: lang === 'te' ? 'ప్రశాంతమైన మనస్సుతో పుణ్యక్షేత్రాలను దర్శించండి.' : 'Visit sacred destinations with peace of mind.',
      image: '/images/temple-tour.jpg',
      badge: 'Pilgrimage Circuit',
      to: '/book?trip=temple_tour'
    }
  ];

  const cardsRef = useScrollReveal({}, true);

  return (
    <div>
      {/* Top Banner */}
      <PageBanner
        title={lang === 'te' ? 'మా సేవలు' : 'Our Services'}
        subtitle={lang === 'te' ? 'ప్రతి ప్రయాణానికి సరళమైన పరిష్కారాలు' : 'Flexible travel solutions for every journey'}
      />

      <div className="container" style={{ paddingBottom: '4rem' }}>
        <div ref={cardsRef} className="grid-3" style={{ gap: '2rem' }}>
          {services.map((s) => (
            <div
              key={s.id}
              className="gold-card"
              style={{
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px'
              }}
            >
              {/* Image Thumbnail */}
              <div style={{ height: '200px', overflow: 'hidden', position: 'relative' }}>
                <img
                  src={s.image}
                  alt={s.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transition: 'transform 0.5s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                />
                <span style={{
                  position: 'absolute',
                  top: '0.85rem',
                  right: '0.85rem',
                  background: 'rgba(8, 15, 30, 0.85)',
                  backdropFilter: 'blur(6px)',
                  color: 'var(--gold-bright)',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-gold)'
                }}>
                  {s.badge}
                </span>
              </div>

              {/* Card Body */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3 style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  {s.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55, flex: 1, marginBottom: '1.25rem' }}>
                  {s.desc}
                </p>

                {s.legalNotice && (
                  <div style={{
                    background: 'var(--color-error-bg)',
                    border: '1px solid rgba(248, 113, 113, 0.25)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.75rem',
                    color: 'var(--color-error)',
                    fontSize: '0.78rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.4rem'
                  }}>
                    <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{s.legalNotice}</span>
                  </div>
                )}

                <Link
                  to={s.to}
                  className="btn btn-outline-gold btn-sm"
                  style={{ width: '100%' }}
                >
                  <span>{lang === 'te' ? 'బుకింగ్ చేయండి' : 'Book Now'}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
