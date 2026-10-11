import { useState } from 'react';
import { Lock, X, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AdminLoginModal({ isOpen, onClose }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('srinu');
  const [password, setPassword] = useState('Srinu@2026');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      await login(username, password);
      onClose();
      navigate('/admin/dashboard');
    } catch (err) {
      setErrorMsg(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem'
    }}>
      <div className="gold-card animate-fade-in" style={{
        maxWidth: '440px',
        width: '100%',
        padding: '2.5rem',
        position: 'relative',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-gold)'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            color: 'var(--text-muted)',
            padding: '0.25rem',
            borderRadius: '6px'
          }}
          aria-label="Close"
        >
          <X size={22} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '12px',
            background: 'rgba(229, 184, 59, 0.15)',
            border: '2px solid var(--gold-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gold-bright)',
            margin: '0 auto 1rem'
          }}>
            <Lock size={26} />
          </div>

          <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            Owner Admin Login
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            S CAR TRAVELS PREMIUM • Srinu
          </p>
        </div>

        {errorMsg && (
          <div style={{
            background: 'var(--color-error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: 'var(--color-error)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username / Admin ID</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
              placeholder="srinu"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-gold"
            style={{ width: '100%', padding: '0.85rem' }}
          >
            <span>{loading ? 'Logging In...' : 'Log in as Owner'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: 'var(--card-subtle)',
          border: '1px dashed var(--border-subtle)',
          fontSize: '0.78rem',
          color: 'var(--text-dim)',
          textAlign: 'center'
        }}>
          Default credentials: <code>srinu</code> / <code>Srinu@2026</code>
        </div>
      </div>
    </div>
  );
}
