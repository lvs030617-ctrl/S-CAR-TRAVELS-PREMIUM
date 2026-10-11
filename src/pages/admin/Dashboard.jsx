import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Download, Plus, ArrowRight, Settings, Phone, MessageCircle, Database, ShieldCheck, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import { apiUrl } from '../../lib/api';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [supabaseStatus, setSupabaseStatus] = useState(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/admin/metrics'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setMetrics(data.metrics);
        setRecentBookings(data.upcomingTrips || []);
        if (data.supabaseStatus) {
          setSupabaseStatus(data.supabaseStatus);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const exportCSV = () => {
    fetch(apiUrl('/api/admin/export/csv'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SCAR_Travels_Bookings_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  };

  return (
    <div>
      {/* Supabase Status Banner */}
      <div style={{
        background: supabaseStatus?.connected
          ? 'rgba(16, 185, 129, 0.08)'
          : supabaseStatus?.configured
            ? 'rgba(239, 68, 68, 0.08)'
            : 'rgba(212, 168, 79, 0.08)',
        border: `1px solid ${
          supabaseStatus?.connected
            ? 'rgba(16, 185, 129, 0.35)'
            : supabaseStatus?.configured
              ? 'rgba(239, 68, 68, 0.35)'
              : 'rgba(212, 168, 79, 0.35)'
        }`,
        borderRadius: '12px',
        padding: '0.9rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        animation: 'fadeUp 0.3s ease both'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: supabaseStatus?.connected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(212, 168, 79, 0.2)',
              color: supabaseStatus?.connected ? '#10b981' : 'var(--gold-bright)'
            }}>
              <Database size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <span>Database Engine:</span>
                {supabaseStatus?.connected ? (
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={15} /> Supabase PostgreSQL (Live & Verified)
                  </span>
                ) : supabaseStatus?.configured ? (
                  <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={15} /> Supabase Configured (Connection Issue)
                  </span>
                ) : (
                  <span style={{ color: 'var(--gold-bright)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold-bright)', display: 'inline-block' }} />
                    Local Database Active (Supabase Awaiting Keys in .env)
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {supabaseStatus?.connected
                  ? 'All 7 tables (bookings, pricing_rules, destinations, vehicles, blocked_dates, booking_status_history, site_settings) connected with Row Level Security.'
                  : supabaseStatus?.configured
                    ? supabaseStatus?.message
                    : 'System is running smoothly with local persistence. Add your Supabase project keys to activate dual cloud syncing & RLS.'}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-gold)',
              borderRadius: '8px',
              color: 'var(--gold-bright)',
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>{showSetupGuide ? 'Hide Setup Steps' : 'Supabase Setup Guide'}</span>
            {showSetupGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Expandable Setup Instructions */}
        {showSetupGuide && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '1.25rem',
            marginTop: '0.5rem',
            fontSize: '0.84rem',
            lineHeight: '1.6',
            color: 'var(--text-main)',
            animation: 'slideDown 0.25s ease both'
          }}>
            <h4 style={{ margin: '0 0 0.75rem', color: 'var(--gold-bright)', fontSize: '0.95rem' }}>
              ⚡ 3-Step Supabase Connection Walkthrough
            </h4>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <li>
                <strong>Run Database Migration:</strong> Open your Supabase Dashboard &rarr; <em>SQL Editor</em> &rarr; <em>New Query</em>. Paste the entire content of <code>supabase/schema.sql</code> and click <strong>Run</strong>. This creates all 7 tables, single-vehicle overlap constraints, triggers, and default-deny RLS policies.
              </li>
              <li>
                <strong>Copy Credentials to <code>.env</code>:</strong> From Supabase Dashboard &rarr; <em>Project Settings</em> &rarr; <em>API</em>:
                <pre style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '0.6rem 0.85rem',
                  margin: '0.4rem 0 0',
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  color: 'var(--gold-bright)',
                  overflowX: 'auto'
                }}>
{`VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi... (Anon/Public key)
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (Secret Service Role key - never in browser)`}
                </pre>
              </li>
              <li>
                <strong>Live Verification:</strong> The server automatically reloads. Once configured, this badge will instantly switch to <strong>🟢 Supabase PostgreSQL (Live & Verified)</strong>.
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* 4 Metric Cards (Matching Mockup Panel 7) */}
      <div className="grid-4" style={{ gap: '1.25rem', marginBottom: '2rem' }}>

        {/* Pending Bookings */}
        <div style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '1.25rem',
          animation: 'fadeUp 0.4s ease both',
          animationDelay: '0ms'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-warning)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Pending Bookings</span>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {metrics?.pending || 0}
          </div>
        </div>

        {/* Confirmed Bookings */}
        <div style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '1.25rem',
          animation: 'fadeUp 0.4s ease both',
          animationDelay: '80ms'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-success)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Confirmed Bookings</span>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {metrics?.confirmed || 0}
          </div>
        </div>

        {/* Completed */}
        <div style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '1.25rem',
          animation: 'fadeUp 0.4s ease both',
          animationDelay: '160ms'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-info)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Completed</span>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {metrics?.completed || 0}
          </div>
        </div>

        {/* Canceled */}
        <div style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '1.25rem',
          animation: 'fadeUp 0.4s ease both',
          animationDelay: '240ms'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-error)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Canceled</span>
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {metrics?.cancelled || 0}
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Bookings (Left) & Quick Actions (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '2rem' }}>
        {/* Recent Bookings Table */}
        <div style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '1.5rem',
          overflow: 'hidden',
          animation: 'fadeUp 0.4s ease 0.2s both'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', margin: 0 }}>
              Recent Bookings
            </h3>
            <Link to="/admin/bookings" style={{ color: 'var(--gold-bright)', fontSize: '0.82rem', fontWeight: '600' }}>
              View All →
            </Link>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ref #</th>
                  <th>Customer</th>
                  <th>Destination</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                      No recent bookings.
                    </td>
                  </tr>
                ) : (
                  recentBookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong style={{ color: 'var(--gold-bright)' }}>{b.reference_no}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{b.customer_name}</div>
                      </td>
                      <td>{b.destination}</td>
                      <td>{b.pickup_datetime?.slice(0, 10)}</td>
                      <td>
                        <StatusBadge status={b.status} />
                      </td>
                      <td>
                        <Link
                          to="/admin/bookings"
                          style={{
                            color: 'var(--gold-bright)',
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            textDecoration: 'underline'
                          }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions Card (Matching Mockup Panel 7 right column) */}
        <div style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '1.5rem',
          height: 'fit-content',
          animation: 'fadeUp 0.4s ease 0.3s both'
        }}>
          <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '1.25rem' }}>
            Quick Actions
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link
              to="/book"
              className="btn btn-gold btn-sm"
              style={{ width: '100%', borderRadius: '8px', padding: '0.75rem' }}
            >
              <Plus size={15} />
              <span>Add New Booking</span>
            </Link>

            <Link
              to="/admin/pricing"
              className="btn btn-outline-gold btn-sm"
              style={{ width: '100%', borderRadius: '8px', padding: '0.75rem', background: 'var(--bg-elevated)' }}
            >
              <span>Manage Rates</span>
            </Link>

            <Link
              to="/admin/pricing"
              className="btn btn-outline-gold btn-sm"
              style={{ width: '100%', borderRadius: '8px', padding: '0.75rem', background: 'var(--bg-elevated)' }}
            >
              <span>Manage Destinations</span>
            </Link>

            <Link
              to="/admin/bookings"
              className="btn btn-outline-gold btn-sm"
              style={{ width: '100%', borderRadius: '8px', padding: '0.75rem', background: 'var(--bg-elevated)' }}
            >
              <span>View All Bookings</span>
            </Link>

            <button
              onClick={exportCSV}
              className="btn btn-outline-gold btn-sm"
              style={{ width: '100%', borderRadius: '8px', padding: '0.75rem', background: 'var(--bg-elevated)' }}
            >
              <Download size={14} />
              <span>Export to CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
