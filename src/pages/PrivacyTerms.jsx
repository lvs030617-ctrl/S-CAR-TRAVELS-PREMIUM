import { ShieldCheck, FileText, Lock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function PrivacyTerms() {
  const { t } = useLanguage();

  return (
    <div className="section-spacing">
      <div className="container" style={{ maxWidth: '860px' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>
            <FileText size={14} />
            <span>BUSINESS COMPLIANCE & CUSTOMER RIGHTS</span>
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            Terms of Service & Privacy Notice
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            For S CAR TRAVELS PREMIUM • Kotananduru, Andhra Pradesh
          </p>
        </div>

        <div className="gold-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', fontSize: '0.92rem', lineHeight: 1.7, color: 'var(--text-muted)' }}>
          {/* Section 1 */}
          <div>
            <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} style={{ color: 'var(--gold-bright)' }} />
              <span>1. Single Dedicated Vehicle & Booking Policy</span>
            </h3>
            <p>
              S CAR TRAVELS PREMIUM owns and operates exclusively <strong>one white Suzuki Ertiga (AP03 CZ 4567)</strong>. All reservation requests submitted via our website enter an initial <strong>Pending</strong> status. A trip is considered guaranteed only after the business owner (Srinu) confirms availability and communicates directly via phone or WhatsApp.
            </p>
          </div>

          {/* Section 2 */}
          <div>
            <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', marginBottom: '0.75rem' }}>
              2. Indicative Fares & Additional Charges
            </h3>
            <p>
              Tariffs and package estimates shown on this website are preliminary starter estimates for customer reference and do not constitute a fixed legal contract. Final pricing will be mutually agreed prior to journey commencement based on route, current fuel prices, and pickup point. Toll gate (FASTag) charges, parking fees, and interstate permits are payable as per actual receipts unless explicitly included in a customized package.
            </p>
          </div>

          {/* Section 3 */}
          <div>
            <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', marginBottom: '0.75rem' }}>
              3. Self-Drive Rental Terms & Mandatory KYC
            </h3>
            <p>
              Self-drive car rental is strictly subject to the following statutory and verification requirements:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>The hirer must produce an Original Valid Indian Driving Licence with minimum 2 years of driving experience.</li>
              <li>Aadhaar Card or Passport copy must be submitted for identity and address verification.</li>
              <li>A refundable security deposit of ₹3,000 is payable prior to vehicle handover.</li>
              <li>Fuel is to be borne by the customer. The vehicle must be returned with the same fuel level as dispatched.</li>
              <li>Statutory speed limit of 80 km/h must be observed. Any traffic violations or speed challans incurred during the rental period are the sole liability of the hirer.</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div>
            <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={20} style={{ color: 'var(--color-success)' }} />
              <span>4. Privacy Notice & Data Protection</span>
            </h3>
            <p>
              We respect your family's personal privacy. S CAR TRAVELS PREMIUM collects customer name, contact phone number, pickup location, and trip schedule strictly for the operational purpose of executing and coordinating vehicle rentals.
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>We do not store or process payment card details, bank logins, or UPI pins on this website.</li>
              <li>Customer contact information is never sold, leased, or distributed to advertising third parties.</li>
              <li>Customers may request removal or deletion of their historical trip inquiry records from our system at any time by contacting the owner.</li>
            </ul>
          </div>

          {/* Section 5 */}
          <div>
            <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', marginBottom: '0.75rem' }}>
              5. Contact for Inquiries & Disputes
            </h3>
            <p>
              For any clarification regarding terms or service inquiries, please contact:
              <br />
              <strong>SRINU (Proprietor)</strong>
              <br />
              S CAR TRAVELS PREMIUM
              <br />
              Kotananduru, Andhra Pradesh - 533407
              <br />
              Phone / WhatsApp: <a href="tel:+919550641408" style={{ color: 'var(--gold-bright)' }}>+91 9550641408</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
