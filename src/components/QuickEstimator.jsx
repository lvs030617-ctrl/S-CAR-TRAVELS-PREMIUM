import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, ArrowRight, Info } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function QuickEstimator({ destinations = [] }) {
  const { lang, t } = useLanguage();
  const navigate = useNavigate();

  const [tripType, setTripType] = useState('round_trip');
  const [selectedDestId, setSelectedDestId] = useState(destinations[0]?.id || 1);

  const currentDest = destinations.find(d => d.id === Number(selectedDestId)) || destinations[0];

  let estMin = 0;
  let estMax = 0;

  if (tripType === 'local_8h') {
    estMin = 2500;
    estMax = 3000;
  } else if (tripType === 'full_day') {
    estMin = 3000;
    estMax = 3500;
  } else if (tripType === 'self_drive') {
    estMin = 3000;
    estMax = 3500;
  } else if (currentDest) {
    if (tripType === 'one_way') {
      estMin = currentDest.one_way_price_min;
      estMax = Math.round(currentDest.one_way_price_min * 1.25);
    } else {
      estMin = currentDest.round_trip_price_min;
      estMax = currentDest.round_trip_price_max;
    }
  }

  const handleBookNow = () => {
    const destName = currentDest ? (lang === 'te' ? currentDest.name_te : currentDest.name_en) : '';
    navigate(`/book?dest=${encodeURIComponent(destName)}&trip=${tripType}`);
  };

  return (
    <div className="gold-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
        <div style={{ color: 'var(--gold-bright)', background: 'rgba(224, 184, 90, 0.15)', padding: '0.5rem', borderRadius: '8px' }}>
          <Calculator size={22} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>{t.estimatorTitle}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.estimatorSubtitle}</p>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '1.25rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">{t.selectTripType}</label>
          <select
            className="form-select"
            value={tripType}
            onChange={(e) => setTripType(e.target.value)}
          >
            <option value="round_trip">{t.tripRoundTrip}</option>
            <option value="one_way">{t.tripOneWay}</option>
            <option value="local_8h">{t.tripLocal8h}</option>
            <option value="full_day">{t.tripFullDay}</option>
            <option value="self_drive">{t.tripSelfDrive24}</option>
          </select>
        </div>

        {tripType !== 'local_8h' && tripType !== 'full_day' && tripType !== 'self_drive' ? (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t.selectDestination}</label>
            <select
              className="form-select"
              value={selectedDestId}
              onChange={(e) => setSelectedDestId(e.target.value)}
            >
              {destinations.map(d => (
                <option key={d.id} value={d.id}>
                  {lang === 'te' ? d.name_te : d.name_en} (~{d.distance_km} km • {d.duration_hours})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Service Area</label>
            <input
              type="text"
              readOnly
              className="form-input"
              value="Kotananduru & Surrounding 80–150 KM Radius"
              style={{ opacity: 0.8 }}
            />
          </div>
        )}
      </div>

      {/* Fare Display Box */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(224, 184, 90, 0.1) 0%, var(--bg-subtle) 100%)',
        border: '1px solid var(--border-gold)',
        borderRadius: 'var(--radius-sm)',
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t.calcEstimate}
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--gold-bright)' }}>
            ₹{estMin?.toLocaleString('en-IN')} – ₹{estMax?.toLocaleString('en-IN')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
            <Info size={12} />
            <span>{t.calcNote}</span>
          </div>
        </div>

        <button
          onClick={handleBookNow}
          className="btn btn-gold"
          style={{ padding: '0.75rem 1.25rem' }}
        >
          <span>{t.navBook}</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
