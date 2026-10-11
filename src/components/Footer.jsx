import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, MessageCircle, MapPin, Clock, ShieldCheck, Lock } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { useAuth } from '../context/AuthContext';
import AdminLoginModal from './AdminLoginModal';

export default function Footer() {
  const { isAuthenticated } = useAuth();
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/services', label: 'Services' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/destinations', label: 'Destinations' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <>
      <footer style={{
        background: 'var(--footer-bg)',
        borderTop: '1px solid var(--footer-border)',
        paddingTop: '3.5rem',
        paddingBottom: '2.5rem',
        color: 'rgba(255,255,255,0.65)',
        fontSize: '0.9rem',
        transition: 'background-color var(--dur-theme) var(--ease-out)'
      }}>
        <div className="container">
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'inline-block', marginBottom: '0.65rem' }}>
              <BrandLogo size="lg" />
            </div>
            <div style={{
              color: 'var(--gold-bright)',
              fontStyle: 'italic',
              fontWeight: '600',
              fontSize: '1.05rem',
              letterSpacing: '0.02em'
            }}>
              "Mee Prayanam… Maa Badhyata!"
            </div>
          </div>

          {/* 3 Column Grid */}
          <div className="grid-3" style={{ gap: '2.5rem', marginBottom: '3rem' }}>
            {/* Col 1: Quick Links */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: '700', letterSpacing: '0.04em' }}>
                Quick Links
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {navLinks.map(link => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      style={{
                        color: 'rgba(255,255,255,0.65)',
                        transition: 'color 0.15s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--gold-bright)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 2: Contact Us */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: '700', letterSpacing: '0.04em' }}>
                Contact Us
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <a
                  href="tel:+919550641408"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'rgba(255,255,255,0.75)', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
                >
                  <Phone size={15} style={{ color: 'var(--gold-bright)', flexShrink: 0 }} />
                  <span>+91 9550641408</span>
                </a>

                <a
                  href="https://wa.me/919550641408"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#25d366', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#4ade80'}
                  onMouseLeave={e => e.currentTarget.style.color = '#25d366'}
                >
                  <MessageCircle size={15} style={{ flexShrink: 0 }} />
                  <span>WhatsApp</span>
                </a>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: 'rgba(255,255,255,0.65)' }}>
                  <MapPin size={15} style={{ color: 'var(--gold-bright)', flexShrink: 0, marginTop: '2px' }} />
                  <span>Kotananduru, Andhra Pradesh</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: 'rgba(255,255,255,0.65)' }}>
                  <Clock size={15} style={{ color: 'var(--gold-bright)', flexShrink: 0, marginTop: '2px' }} />
                  <span>Mon – Sun: 6:00 AM – 10:00 PM</span>
                </div>
              </div>
            </div>

            {/* Col 3: Social & Trust */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: '700', letterSpacing: '0.04em' }}>
                Follow Us
              </h4>

              <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.75rem' }}>
                {[
                  { href: 'https://facebook.com', bg: '#1877F2', label: 'f', title: 'Facebook' },
                  { href: 'https://instagram.com', bg: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', label: 'ig', title: 'Instagram' },
                  { href: 'https://youtube.com', bg: '#FF0000', label: '▶', title: 'YouTube' },
                ].map(social => (
                  <a
                    key={social.title}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: social.bg,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      flexShrink: 0
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    title={social.title}
                  >
                    {social.label}
                  </a>
                ))}
              </div>

              {/* Trust Badge */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-gold)',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'background 0.2s, border-color 0.2s'
              }}>
                <div style={{
                  color: 'var(--gold-bright)',
                  background: 'rgba(224, 184, 90, 0.12)',
                  padding: '0.4rem',
                  borderRadius: '8px',
                  flexShrink: 0
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.88rem' }}>
                    Secure & Trusted
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                    Your safety is our priority
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Strip */}
          <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.07)',
            paddingTop: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.4)'
          }}>
            <div>© 2026 S CAR TRAVELS PREMIUM. All rights reserved.</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <Link
                to="/privacy-terms"
                style={{ color: 'rgba(255,255,255,0.4)', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              >
                Privacy Policy
              </Link>
              <span>|</span>
              <Link
                to="/privacy-terms"
                style={{ color: 'rgba(255,255,255,0.4)', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              >
                Terms & Conditions
              </Link>
              <span>|</span>
              {!isAuthenticated ? (
                <button
                  onClick={() => setAdminModalOpen(true)}
                  style={{ color: 'var(--gold-bright)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--gold-hover)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--gold-bright)'}
                >
                  <Lock size={11} />
                  <span>Admin Login</span>
                </button>
              ) : (
                <Link to="/admin/dashboard" style={{ color: 'var(--gold-bright)', fontWeight: '700' }}>
                  Admin Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </footer>

      <AdminLoginModal isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} />
    </>
  );
}
