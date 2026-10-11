import { Link } from 'react-router-dom';
import { Fuel, Receipt, DollarSign, UserCheck, ShieldCheck, Clock, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import PageBanner from '../components/PageBanner';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function Pricing() {
  const { lang } = useLanguage();

  const tablesRef = useScrollReveal({}, true);
  const chargesRef = useScrollReveal();

  const additionalCharges = [
    { title: 'Fuel', icon: Fuel, desc: 'Included in local packages; at actuals for others' },
    { title: 'Toll Charges', icon: Receipt, desc: 'FASTag electronic toll receipts provided' },
    { title: 'Parking', icon: DollarSign, desc: 'Payable at airport, station, or tourist sites' },
    { title: 'Driver Allowance', icon: UserCheck, desc: '₹400–500 for night halts/long tours' },
    { title: 'Permits', icon: ShieldCheck, desc: 'Required when crossing inter-state borders' },
    { title: 'Extra Kilometres', icon: Clock, desc: '₹18–20/km beyond package limits' },
    { title: 'Extra Hours', icon: Clock, desc: '₹200/hr after package scheduled time' },
    { title: 'Empty Return', icon: RefreshCw, desc: 'Applicable for remote one-way drops' },
    { title: 'Taxes', icon: Receipt, desc: 'Applicable state road tax and GST' }
  ];

  return (
    <div>
      {/* Top Banner (Matching Mockup Panel 3) */}
      <PageBanner
        title={lang === 'te' ? 'అద్దె & ట్రిప్ ధరలు' : 'Rental & Trip Pricing'}
        subtitle={lang === 'te' ? 'పారదర్శకమైన & సరసమైన ధరలు' : 'Transparent & Affordable Rates'}
      />

      <div className="container" style={{ paddingBottom: '4rem' }}>
        {/* Top 2 Tables Grid */}
        <div ref={tablesRef} className="grid-2" style={{ gap: '2rem', marginBottom: '2.5rem' }}>
          {/* Table 1: Daily Rental & Self-Drive */}
          <div className="gold-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--gold-bright)' }}>1.</span>
              <span>Daily Rental & Self-Drive</span>
            </h3>

            <div className="admin-table-wrapper" style={{ flex: 1, marginBottom: '1rem' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th style={{ textAlign: 'right' }}>Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Local Rental (with driver) – 8 hrs / 80 km</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-bright)' }}>2,500 – 3,000</td>
                  </tr>
                  <tr>
                    <td>Full Day (with driver) – 10-12 hrs</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-bright)' }}>3,000 – 3,500</td>
                  </tr>
                  <tr>
                    <td>Self Drive (24 hrs)</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-bright)' }}>3,000 – 3,500</td>
                  </tr>
                  <tr>
                    <td>Extra Kilometres (with driver)</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>18 – 20 / km</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              *Note: Prices are indicative starter estimates and may vary based on seasonal fuel rates, duration, and route. Fuel, toll, parking and driver allowance may be extra as per actuals.
            </p>
          </div>

          {/* Table 2: Round Trip Prices */}
          <div className="gold-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--gold-bright)' }}>2.</span>
              <span>Round Trip Prices</span>
            </h3>

            <div className="admin-table-wrapper" style={{ flex: 1, marginBottom: '1rem' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Destination</th>
                    <th style={{ textAlign: 'right' }}>Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Kakinada</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-bright)' }}>4,000 – 5,000</td>
                  </tr>
                  <tr>
                    <td>Rajahmundry</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-bright)' }}>4,500 – 5,500</td>
                  </tr>
                  <tr>
                    <td>Visakhapatnam (Vizag)</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-bright)' }}>5,500 – 6,500</td>
                  </tr>
                  <tr>
                    <td>Vijayawada</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-bright)' }}>10,000 – 11,500</td>
                  </tr>
                  <tr>
                    <td>Tirupati</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-bright)' }}>24,000 – 27,000</td>
                  </tr>
                  <tr>
                    <td>Araku</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-bright)' }}>9,000 – 11,000</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right' }}>
              <Link to="/book" className="btn btn-gold btn-sm">
                <span>Book a Round Trip</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom 2 Blocks Grid: One-Way Prices & Additional Charges */}
        <div className="grid-2" style={{ gap: '2rem' }}>
          {/* Table 3: One-Way Trip Prices */}
          <div className="gold-card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--gold-bright)' }}>3.</span>
              <span>One-Way Trip Prices</span>
            </h3>

            <div className="admin-table-wrapper" style={{ marginBottom: '1rem' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Destination</th>
                    <th style={{ textAlign: 'right' }}>Starting Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Kakinada</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>2,000+</td>
                  </tr>
                  <tr>
                    <td>Rajahmundry</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>2,500+</td>
                  </tr>
                  <tr>
                    <td>Visakhapatnam</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>3,500+</td>
                  </tr>
                  <tr>
                    <td>Vijayawada</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>5,500+</td>
                  </tr>
                  <tr>
                    <td>Tirupati</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>12,000+</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right' }}>
              <Link to="/book?trip=one_way" className="btn btn-outline-gold btn-sm">
                <span>Book One-Way Drop</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Block 4: Additional Charges Grid */}
          <div className="gold-card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1.25rem' }}>
              Additional Charges <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: '400' }}>(as applicable)</span>
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem'
            }}>
              {additionalCharges.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--card-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '1rem 0.75rem',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'rgba(224, 184, 90, 0.1)',
                      color: 'var(--gold-bright)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={18} />
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)' }}>
                      {item.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
