import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Lock, Settings, Sun, Moon, Monitor } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BrandLogo from './BrandLogo';
import AdminLoginModal from './AdminLoginModal';

export default function Navbar() {
  const { lang, toggleLanguage, setLang, t } = useLanguage();
  const { isAuthenticated, admin, logout } = useAuth();
  const { preference, setTheme } = useTheme();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const navLinks = [
    { to: '/', label: lang === 'te' ? 'హోమ్' : 'Home' },
    { to: '/services', label: lang === 'te' ? 'సేవలు' : 'Services' },
    { to: '/pricing', label: lang === 'te' ? 'ధరలు' : 'Pricing' },
    { to: '/destinations', label: lang === 'te' ? 'గమ్యస్థానాలు' : 'Destinations' },
    { to: '/about', label: lang === 'te' ? 'మా గురించి' : 'About' },
    { to: '/contact', label: lang === 'te' ? 'కాంటాక్ట్' : 'Contact' },
  ];

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Scroll detection for navbar shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const themeOptions = [
    { key: 'light', icon: Sun, label: 'Light mode' },
    { key: 'dark', icon: Moon, label: 'Dark mode' },
    { key: 'system', icon: Monitor, label: 'System preference' },
  ];

  return (
    <>
      <header className={`navbar${scrolled ? ' scrolled' : ''}`}>
        {/* Admin Bar Notification if logged in */}
        {isAuthenticated && (
          <div style={{
            background: 'linear-gradient(90deg, #101c38, #18284d)',
            borderBottom: '1px solid var(--border-gold)',
            padding: '0.4rem 1.25rem',
            fontSize: '0.82rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#ffffff',
            animation: 'fadeDown 0.3s ease both'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }} />
              <span>Owner Mode Active: <strong>{admin?.username || 'Srinu'}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Link
                to="/admin/dashboard"
                style={{
                  color: 'var(--gold-bright)',
                  fontWeight: '700',
                  textDecoration: 'underline',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.82rem'
                }}
              >
                <Settings size={13} />
                <span>Open Admin Dashboard</span>
              </Link>
              <span>•</span>
              <button
                onClick={logout}
                style={{ color: 'var(--color-error)', fontSize: '0.8rem', fontWeight: '600' }}
              >
                Logout
              </button>
            </div>
          </div>
        )}

        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '4.8rem'
        }}>
          {/* Left Brand Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
            <BrandLogo size="md" />
          </Link>

          {/* Desktop Nav Items */}
          <nav className="desktop-nav" style={{ display: 'none', alignItems: 'center', gap: '1.75rem' }}>
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link${isActive(link.to) ? ' active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Right Actions */}
          <div className="desktop-actions" style={{ display: 'none', alignItems: 'center', gap: '1rem' }}>
            {/* Theme Toggle */}
            <div className="theme-toggle" role="group" aria-label="Select color theme">
              {themeOptions.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  className={`theme-toggle-btn${preference === key ? ' active' : ''}`}
                  onClick={() => setTheme(key)}
                  title={label}
                  aria-label={label}
                  aria-pressed={preference === key}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>

            {/* Language Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.88rem',
              fontWeight: '600',
              color: 'rgba(255,255,255,0.6)'
            }}>
              <button
                onClick={() => setLang('en')}
                style={{
                  color: lang === 'en' ? 'var(--gold-bright)' : 'rgba(255,255,255,0.6)',
                  fontWeight: lang === 'en' ? '800' : '500',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease'
                }}
              >
                EN
              </button>
              <span style={{ opacity: 0.4 }}>|</span>
              <button
                onClick={() => setLang('te')}
                style={{
                  color: lang === 'te' ? 'var(--gold-bright)' : 'rgba(255,255,255,0.6)',
                  fontWeight: lang === 'te' ? '800' : '500',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease'
                }}
              >
                తెలుగు
              </button>
            </div>

            {/* Admin Login Button */}
            {!isAuthenticated ? (
              <button
                onClick={() => setAdminModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.84rem',
                  fontWeight: '600',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  transition: 'color 0.15s, border-color 0.15s, background 0.15s'
                }}
                title="Admin Login for Srinu"
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                }}
              >
                <Lock size={13} />
                <span>Admin</span>
              </button>
            ) : (
              <Link
                to="/admin/dashboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: 'var(--gold-bright)',
                  fontSize: '0.84rem',
                  fontWeight: '700',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-gold)',
                  background: 'rgba(224, 184, 90, 0.1)',
                  transition: 'background 0.15s, box-shadow 0.15s'
                }}
              >
                <Settings size={13} />
                <span>Dashboard</span>
              </Link>
            )}

            {/* Book Now Button */}
            <Link
              to="/book"
              className="btn btn-gold btn-sm"
              style={{ borderRadius: '9999px', padding: '0.55rem 1.4rem', fontSize: '0.9rem', fontWeight: '700' }}
            >
              {lang === 'te' ? 'బుక్ చేయండి' : 'Book Now'}
            </Link>
          </div>

          {/* Mobile Right Controls */}
          <div className="mobile-menu-trigger" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {/* Quick theme cycle on mobile */}
            <button
              onClick={() => {
                const cycle = { light: 'dark', dark: 'system', system: 'light' };
                setTheme(cycle[preference] || 'system');
              }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold-bright)'
              }}
              aria-label="Toggle theme"
            >
              {preference === 'light' ? <Sun size={15} /> : preference === 'dark' ? <Moon size={15} /> : <Monitor size={15} />}
            </button>

            {/* Quick Lang */}
            <button
              onClick={toggleLanguage}
              style={{
                fontSize: '0.8rem',
                fontWeight: '700',
                color: 'var(--gold-bright)',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid var(--border-gold)'
              }}
            >
              {lang === 'en' ? 'తె' : 'EN'}
            </button>

            {/* Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                color: 'rgba(255,255,255,0.9)',
                padding: '0.4rem',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s'
              }}
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
            >
              <span style={{ display: 'block', transition: 'transform 0.2s', transform: mobileMenuOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <div className={`mobile-nav-drawer${mobileMenuOpen ? ' open' : ''}`}
          style={{
            background: 'var(--bg-nav)',
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div style={{ padding: '1.25rem 1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
            {navLinks.map((link, idx) => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  fontSize: '1rem',
                  fontWeight: isActive(link.to) ? '700' : '500',
                  color: isActive(link.to) ? 'var(--gold-bright)' : 'rgba(255,255,255,0.85)',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'color 0.15s'
                }}
              >
                {link.label}
                {isActive(link.to) && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold-bright)' }} />
                )}
              </Link>
            ))}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <Link
                to="/book"
                className="btn btn-gold btn-sm"
                style={{ flex: 1, textAlign: 'center' }}
              >
                {lang === 'te' ? 'బుక్ చేయండి' : 'Book Now'}
              </Link>

              {!isAuthenticated ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAdminModalOpen(true);
                  }}
                  className="btn btn-outline-gold btn-sm"
                  style={{ flex: 1 }}
                >
                  <Lock size={14} />
                  <span>Admin Login</span>
                </button>
              ) : (
                <Link
                  to="/admin/dashboard"
                  className="btn btn-outline-gold btn-sm"
                  style={{ flex: 1 }}
                >
                  <Settings size={14} />
                  <span>Dashboard</span>
                </Link>
              )}
            </div>

            {/* Mobile theme selector */}
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>THEME:</span>
              <div className="theme-toggle" role="group" aria-label="Select color theme">
                {themeOptions.map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    className={`theme-toggle-btn${preference === key ? ' active' : ''}`}
                    onClick={() => setTheme(key)}
                    title={label}
                    aria-label={label}
                    aria-pressed={preference === key}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @media (min-width: 900px) {
            .desktop-nav { display: flex !important; }
            .desktop-actions { display: flex !important; }
            .mobile-menu-trigger { display: none !important; }
          }
        `}</style>
      </header>

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />
    </>
  );
}
