import { useState } from 'react';
import { ShieldCheck, Wind, Users, Briefcase, Sparkles, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function VehicleShowcase({ vehicleData }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('exterior'); // 'exterior' | 'interior'

  const features = vehicleData?.features || [
    'Dual Air Conditioning with Independent Rear Roof Vents',
    '6+1 Passenger Seating Capacity with Ergonomic Push-back Comfort',
    'Foldable 3rd Row for 4-5 Large Travel Bags',
    'Smart Hybrid Engine for Ultra-Smooth Highway Cruising',
    'Deeply Sanitized and Vacuumed Before Every Single Trip',
    'High Ground Clearance - Smooth on AP Rural Roads & Ghats'
  ];

  return (
    <section className="section-spacing" style={{ background: 'var(--bg-subtle)' }}>
      <div className="container">
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 3rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }} className="badge badge-gold">
            <ShieldCheck size={14} />
            <span>{t.singleVehicleNotice}</span>
          </div>
          <h2 style={{ fontSize: '2.2rem', marginBottom: '1rem' }} className="gold-gradient-text">
            {t.vehicleShowcaseTitle}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.6 }}>
            {t.singleVehicleDesc}
          </p>
        </div>

        {/* Vehicle Showcase Card */}
        <div className="gold-card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button
              onClick={() => setActiveTab('exterior')}
              className={`btn btn-sm ${activeTab === 'exterior' ? 'btn-gold' : 'btn-outline-gold'}`}
            >
              Exterior (Pearl Arctic White)
            </button>
            <button
              onClick={() => setActiveTab('interior')}
              className={`btn btn-sm ${activeTab === 'interior' ? 'btn-gold' : 'btn-outline-gold'}`}
            >
              Cabin Interior & 7-Seater Comfort
            </button>
          </div>

          <div className="grid-2" style={{ alignItems: 'center', gap: '2rem' }}>
            {/* Visual Display */}
            <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
              <img
                src={activeTab === 'exterior' ? '/images/ertiga-hero.jpg' : '/images/ertiga-interior.jpg'}
                alt={activeTab === 'exterior' ? 'White Maruti Suzuki Ertiga on Andhra Highway' : 'Clean Ertiga 7-Seater Interior'}
                style={{
                  width: '100%',
                  height: '380px',
                  objectFit: 'cover',
                  display: 'block',
                  transition: 'transform 0.4s ease'
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(transparent, rgba(7, 11, 20, 0.95))',
                padding: '1.5rem 1rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end'
              }}>
                <div>
                  <span className="badge badge-green" style={{ marginBottom: '0.25rem' }}>
                    <Sparkles size={12} /> Sanitized & Ready
                  </span>
                  <h4 style={{ color: '#fff', fontSize: '1.1rem' }}>
                    {vehicleData?.model_name || 'Maruti Suzuki Ertiga (Smart Hybrid)'}
                  </h4>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Registration:</span>
                  <div style={{
                    color: 'var(--gold-bright)',
                    fontWeight: '800',
                    letterSpacing: '0.08em',
                    fontSize: '0.9rem',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-gold)'
                  }}>
                    {vehicleData?.registration_number || 'AP03 CZ 4567'}
                  </div>
                </div>
              </div>
            </div>

            {/* Spec Highlights */}
            <div>
              <div className="grid-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{
                  background: 'var(--card-subtle)',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ color: 'var(--gold-bright)', marginBottom: '0.35rem' }}>
                    <Users size={22} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Passenger Capacity</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>6+1 Seats</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Push-back ergonomic seats</div>
                </div>

                <div style={{
                  background: 'var(--card-subtle)',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ color: 'var(--gold-bright)', marginBottom: '0.35rem' }}>
                    <Wind size={22} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Air Conditioning</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>Dual AC System</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Independent roof vents for rear</div>
                </div>

                <div style={{
                  background: 'var(--card-subtle)',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ color: 'var(--gold-bright)', marginBottom: '0.35rem' }}>
                    <Briefcase size={22} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Luggage Setup</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>Flexible Boot</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>50:50 fold-down for bags</div>
                </div>

                <div style={{
                  background: 'var(--card-subtle)',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ color: 'var(--gold-bright)', marginBottom: '0.35rem' }}>
                    <ShieldCheck size={22} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fleet Authenticity</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>100% Dedicated</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Direct owner care by Srinu</div>
                </div>
              </div>

              {/* Feature Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {features.slice(0, 4).map((feat, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--gold-400)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-muted)' }}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
