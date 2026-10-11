import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  LayoutDashboard, Calendar, DollarSign, Car, CalendarOff, Settings,
  LogOut, ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';

export default function AdminLayout() {
  const { admin, logout, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/admin/login', { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        color: 'var(--gold-bright)',
        background: 'var(--admin-bg)'
      }}>
        <span className="spinner" />
        Loading Admin Dashboard...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const sidebarLinks = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/bookings', label: 'Bookings', icon: Calendar },
    { to: '/admin/pricing', label: 'Pricing & Destinations', icon: DollarSign },
    { to: '/admin/vehicle', label: 'Vehicle', icon: Car },
    { to: '/admin/blocked-dates', label: 'Blocked Dates', icon: CalendarOff },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--admin-bg)',
      transition: 'background-color var(--dur-theme) var(--ease-out)'
    }}>
      {/* Left Sidebar */}
      <aside className="admin-sidebar" style={{
        width: '250px',
        background: 'var(--admin-sidebar)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'background-color var(--dur-theme) var(--ease-out)'
      }}>
        {/* Brand Header */}
        <div style={{
          padding: '1.5rem 1.25rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <Link to="/">
            <BrandLogo size="sm" />
          </Link>
          <div style={{
            marginTop: '0.5rem',
            fontSize: '0.72rem',
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: '600'
          }}>
            Admin Console
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={{ padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
          {sidebarLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.7rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#080f1e' : 'rgba(255,255,255,0.7)',
                  background: isActive ? 'var(--gold-bright)' : 'transparent',
                  transition: 'background 0.15s, color 0.15s, transform 0.15s',
                  textDecoration: 'none'
                })}
                onMouseEnter={e => {
                  if (!e.currentTarget.classList.contains('active') && e.currentTarget.style.background === 'transparent') {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  }
                }}
                onMouseLeave={e => {
                  if (!e.currentTarget.style.background.includes('var(--gold')) {
                    // let NavLink handle it via style prop
                  }
                }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom: Links */}
        <div style={{
          padding: '1.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--gold-bright)',
              fontSize: '0.86rem',
              fontWeight: '600',
              transition: 'color 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--gold-hover)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--gold-bright)'}
          >
            <ExternalLink size={15} />
            <span>Customer View</span>
          </Link>

          <button
            onClick={() => { logout(); navigate('/'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-error)',
              fontSize: '0.86rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'color 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header className="admin-header" style={{
          background: 'var(--admin-sidebar)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'background-color var(--dur-theme) var(--ease-out)'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: '#ffffff', margin: 0, fontWeight: '700' }}>
              Admin Dashboard
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <Link
              to="/"
              className="btn btn-outline-gold btn-sm"
              style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem' }}
            >
              <ExternalLink size={13} />
              <span>Back to Website</span>
            </Link>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '0.4rem 0.85rem'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: '600' }}>
                {admin?.username || 'Srinu'}
              </span>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="admin-body" style={{
          padding: '2rem',
          flex: 1,
          overflowY: 'auto',
          background: 'var(--admin-bg)',
          animation: 'fadeUp 0.3s ease both',
          transition: 'background-color var(--dur-theme) var(--ease-out)'
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
