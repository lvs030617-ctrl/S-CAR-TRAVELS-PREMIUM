import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, ArrowRight, ShieldAlert, UserCheck } from 'lucide-react';
import { apiUrl } from '../../lib/api';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [tokenError, setTokenError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [activatedSuccess, setActivatedSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenError('No invitation token provided. Please use the link sent to your email.');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(apiUrl(`/api/public/admin/verify-invite-token?token=${encodeURIComponent(token)}`));
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Invalid or expired invitation link.');
        }
        setInviteData(data);
      } catch (err) {
        setTokenError(err.message || 'Failed to verify invitation link.');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/public/admin/accept-invite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to activate account.');
      }

      setActivatedSuccess(true);
      setTimeout(() => {
        navigate('/admin/login', { replace: true });
      }, 3000);
    } catch (err) {
      setSubmitError(err.message || 'Failed to activate administrator account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #1a1608 0%, #0a0a0c 60%, #050507 100%)',
        padding: '2rem 1rem'
      }}
    >
      <div
        className="gold-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '2.5rem',
          boxShadow: '0 20px 45px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.1)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.05) 100%)',
              border: '1px solid var(--gold-400)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              color: 'var(--gold-400)'
            }}
          >
            <UserCheck size={32} />
          </div>

          <h1 style={{ fontSize: '1.45rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            Activate Administrator Account
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            S CAR TRAVELS PREMIUM Console
          </p>
        </div>

        {verifying && (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--gold-400)' }}>
            <span className="spinner" style={{ marginRight: '0.5rem' }} />
            <span>Verifying invitation token...</span>
          </div>
        )}

        {!verifying && tokenError && (
          <div>
            <div
              style={{
                background: 'var(--color-error-bg)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '1rem',
                color: 'var(--color-error)',
                fontSize: '0.9rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}
            >
              <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Invalid or Expired Invitation</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {tokenError}
                </p>
              </div>
            </div>

            <Link
              to="/admin/login"
              className="btn btn-outline-gold"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Go to Admin Login
            </Link>
          </div>
        )}

        {!verifying && !tokenError && activatedSuccess && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '8px',
                padding: '1.25rem',
                color: '#4ade80',
                marginBottom: '1.5rem'
              }}
            >
              <CheckCircle2 size={36} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                Account Activated Successfully!
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: 0 }}>
                Redirecting to admin login screen in 3 seconds...
              </p>
            </div>

            <Link
              to="/admin/login"
              className="btn btn-gold"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span>Sign In Now</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {!verifying && !tokenError && !activatedSuccess && inviteData && (
          <div>
            <div
              style={{
                background: 'rgba(212, 175, 55, 0.08)',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
                fontSize: '0.85rem'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-dim)' }}>Username:</span>
                <strong style={{ color: 'var(--gold-300)' }}>{inviteData.username}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-dim)' }}>Email:</span>
                <strong style={{ color: 'var(--text-main)' }}>{inviteData.email}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-dim)' }}>Role:</span>
                <span style={{
                  textTransform: 'uppercase',
                  fontWeight: '700',
                  color: inviteData.role === 'superadmin' ? '#f59e0b' : '#38bdf8',
                  fontSize: '0.78rem'
                }}>
                  {inviteData.role === 'superadmin' ? 'Super Administrator' : 'Administrator'}
                </span>
              </div>
            </div>

            {submitError && (
              <div
                style={{
                  background: 'var(--color-error-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  color: 'var(--color-error)',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AlertCircle size={16} />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Create Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="form-input"
                    style={{ paddingLeft: '2.75rem' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="form-input"
                    style={{ paddingLeft: '2.75rem' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-gold"
                style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', gap: '0.5rem' }}
              >
                {submitting ? (
                  <>
                    <span className="spinner" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Activate Account & Proceed</span>
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/admin/login" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', textDecoration: 'none' }}>
                Already have an active account? Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
