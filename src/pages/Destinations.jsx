import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import PageBanner from '../components/PageBanner';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function Destinations() {
  const { lang } = useLanguage();

  const destinations = [
    {
      name: 'Kakinada',
      distance: '~150 km | 3.5 hrs',
      image: '/images/kakinada-beach.jpg',
      desc: 'Smart City, Coringa Sanctuary, Kakinada Beach & Port transit.'
    },
    {
      name: 'Rajahmundry',
      distance: '~180 km | 4 hrs',
      image: '/images/rajahmundry-bridge.jpg',
      desc: 'Godavari Ghats, historic rail bridges, Airport connectivity & temples.'
    },
    {
      name: 'Visakhapatnam (Vizag)',
      distance: '~330 km | 7 hrs',
      image: '/images/vizag-beach.jpg',
      desc: 'City of Destiny, RK Beach, Submarine Museum, Vizag International Airport.'
    },
    {
      name: 'Vijayawada',
      distance: '~400 km | 9 hrs',
      image: '/images/andhra-temple.jpg',
      desc: 'Sri Kanaka Durga Temple, Prakasam Barrage & Commercial transit.'
    },
    {
      name: 'Tirupati',
      distance: '~900 km | 18 hrs',
      image: '/images/temple-tour.jpg',
      desc: 'Sacred Tirumala Balaji Darshan, Alipiri & Padmavathi Temple.'
    },
    {
      name: 'Araku Valley',
      distance: '~300 km | 8 hrs',
      image: '/images/araku-valley.jpg',
      desc: 'Coffee plantations, Borra Caves, Chaparai waterfalls & misty ghats.'
    }
  ];

  const cardsRef = useScrollReveal({}, true);
  const otherRef = useScrollReveal();
  const otherDestinations = ['Srisailam', 'Hyderabad', 'Bengaluru', 'Chennai', 'and more...'];

  return (
    <div>
      {/* Top Banner (Matching Mockup Panel 4) */}
      <PageBanner
        title={lang === 'te' ? 'ప్రముఖ గమ్యస్థానాలు' : 'Popular Destinations'}
        subtitle={lang === 'te' ? 'కొత్త ప్రదేశాలను అన్వేషించండి, మధుర జ్ఞాపకాలను సృష్టించండి' : 'Explore New Places, Create Lasting Memories'}
      />

      <div className="container" style={{ paddingBottom: '4rem' }}>
        {/* 6 Destination Cards Grid */}
        <div ref={cardsRef} className="grid-3" style={{ gap: '2rem', marginBottom: '3.5rem' }}>
          {destinations.map((d, idx) => (
            <div
              key={idx}
              className="gold-card"
              style={{
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px'
              }}
            >
              <div style={{ height: '210px', overflow: 'hidden' }}>
                <img
                  src={d.image}
                  alt={d.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transition: 'transform 0.5s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  onError={(e) => { e.target.src = '/images/ertiga-hero.jpg'; }}
                />
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>
                    {d.name}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--gold-bright)', fontWeight: '600' }}>
                    {d.distance}
                  </span>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, flex: 1, marginBottom: '1.25rem' }}>
                  {d.desc}
                </p>

                <Link
                  to={`/book?dest=${encodeURIComponent(d.name)}`}
                  className="btn btn-outline-gold btn-sm"
                  style={{ width: '100%' }}
                >
                  <span>Book for {d.name}</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Other Destinations Strip */}
        <div ref={otherRef} className="reveal" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '1.5rem 2rem'
        }}>
          <h4 style={{ color: 'var(--text-main)', fontSize: '1.05rem', marginBottom: '1rem' }}>
            Other Destinations
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {otherDestinations.map((dest, idx) => (
              <Link
                key={idx}
                to={`/book?dest=${encodeURIComponent(dest === 'and more...' ? '' : dest)}`}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9999px',
                  padding: '0.45rem 1.25rem',
                  color: dest === 'and more...' ? 'var(--gold-bright)' : '#cbd5e1',
                  fontSize: '0.88rem',
                  fontWeight: '500',
                  transition: 'border-color 0.2s, color 0.2s'
                }}
              >
                {dest}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
