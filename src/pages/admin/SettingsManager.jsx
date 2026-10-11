import { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, Lock, ShieldAlert, KeyRound, AlertCircle, Mail, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../lib/api';

export default function SettingsManager() {
  const { token, admin, adminFetch } = useAuth();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  // Email notifications state
  const [emailStatus, setEmailStatus] = useState(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState('');
  const [testEmailError, setTestEmailError] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/settings'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSettings(data.settings || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    adminFetch('/api/admin/email-status')
      .then(res => res.json())
      .then(data => setEmailStatus(data))
      .catch(() => {});
  }, [token, adminFetch]);

  const handleTestEmail = async () => {
    setTestEmailLoading(true);
    setTestEmailMsg('');
    setTestEmailError('');
    try {
      const res = await adminFetch('/api/admin/test-email', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send test email');
      }
      setTestEmailMsg(data.message || 'Test email dispatched successfully! Check your inbox.');
      setTimeout(() => setTestEmailMsg(''), 8000);
    } catch (err) {
      setTestEmailError(err.message || 'Failed to send test email');
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleChange = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(apiUrl('/api/admin/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        setSuccessMsg('Business settings updated successfully');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (e) {
      alert('Failed to update settings');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New password and confirmation do not match');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await adminFetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password');
      }
      setPwdSuccess('Owner password successfully updated! Keep your new credentials safe.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwdSuccess(''), 6000);
    } catch (err) {
      setPwdError(err.message || 'Failed to change password');
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ color: 'var(--gold-400)' }}>Loading settings...</div>;
  }

  return (
    <div className="container" style={{ maxWidth: '850px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Business & Contact Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Configure phone numbers, WhatsApp links, Google Maps URL, bilingual taglines, and terms.
        </p>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="gold-card" style={{ padding: '2.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--gold-300)', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          1. Brand & Direct Communication
        </h3>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input
              type="text"
              value={settings.business_name || ''}
              onChange={(e) => handleChange('business_name', e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Proprietor Name</label>
            <input
              type="text"
              value={settings.owner_name || ''}
              onChange={(e) => handleChange('owner_name', e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Phone Calling Number</label>
            <input
              type="text"
              value={settings.owner_phone || ''}
              onChange={(e) => handleChange('owner_phone', e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">WhatsApp Number (e.g. 919550641408)</label>
            <input
              type="text"
              value={settings.whatsapp_number || ''}
              onChange={(e) => handleChange('whatsapp_number', e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">English Tagline</label>
            <input
              type="text"
              value={settings.tagline_en || ''}
              onChange={(e) => handleChange('tagline_en', e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Telugu Tagline</label>
            <input
              type="text"
              value={settings.tagline_te || ''}
              onChange={(e) => handleChange('tagline_te', e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <h3 style={{ fontSize: '1.2rem', color: 'var(--gold-300)', marginTop: '1.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          2. Base Location & Maps
        </h3>

        <div className="form-group">
          <label className="form-label">Full Address</label>
          <input
            type="text"
            value={settings.full_address || ''}
            onChange={(e) => handleChange('full_address', e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Google Maps URL</label>
          <input
            type="text"
            value={settings.google_maps_url || ''}
            onChange={(e) => handleChange('google_maps_url', e.target.value)}
            className="form-input"
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Service Hours (English)</label>
            <input
              type="text"
              value={settings.service_hours_en || ''}
              onChange={(e) => handleChange('service_hours_en', e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Service Hours (Telugu)</label>
            <input
              type="text"
              value={settings.service_hours_te || ''}
              onChange={(e) => handleChange('service_hours_te', e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <h3 style={{ fontSize: '1.2rem', color: 'var(--gold-300)', marginTop: '1.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          3. Terms & Policies Text
        </h3>

        <div className="form-group">
          <label className="form-label">Self Drive Terms (English)</label>
          <textarea
            rows={2}
            value={settings.self_drive_terms_en || ''}
            onChange={(e) => handleChange('self_drive_terms_en', e.target.value)}
            className="form-textarea"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Privacy Notice (English)</label>
          <textarea
            rows={2}
            value={settings.privacy_notice_en || ''}
            onChange={(e) => handleChange('privacy_notice_en', e.target.value)}
            className="form-textarea"
          />
        </div>

        <button type="submit" className="btn btn-gold btn-lg" style={{ width: '100%', marginTop: '1rem' }}>
          <Save size={18} />
          <span>Save All Settings</span>
        </button>
      </form>

      {/* Admin Password & Account Security Card */}
      <div className="gold-card" style={{ padding: '2.5rem', marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(212, 168, 79, 0.15)',
            border: '1px solid var(--border-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gold-bright)'
          }}>
            <Lock size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0 }}>
              Owner Admin Security & Password
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              Update your administrative login credentials to maintain maximum protection.
            </p>
          </div>
        </div>

        {admin?.usingDefaultPassword && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem'
          }}>
            <ShieldAlert size={18} />
            <span>
              <strong>Immediate Action Required:</strong> Your account is currently using the initial default setup credentials. Please change your password below immediately.
            </span>
          </div>
        )}

        {pwdSuccess && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: '#4ade80',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle2 size={16} />
            <span>{pwdSuccess}</span>
          </div>
        )}

        {pwdError && (
          <div style={{
            background: 'var(--color-error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            color: 'var(--color-error)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} />
            <span>{pwdError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="form-input"
              placeholder="Enter current owner password"
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">New Password (Min 8 Characters)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                placeholder="Enter new strong password"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                placeholder="Re-type new password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pwdLoading}
            className="btn btn-gold"
            style={{ width: '100%', marginTop: '0.75rem', padding: '0.85rem' }}
          >
            {pwdLoading ? <span className="spinner" /> : <KeyRound size={16} />}
            <span>{pwdLoading ? 'Updating Password...' : 'Update Owner Password'}</span>
          </button>
        </form>
      </div>

      {/* Admin Email Notifications (Resend) Card */}
      <div className="gold-card" style={{ padding: '2.5rem', marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(229, 184, 59, 0.15)',
              border: '1px solid var(--border-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--gold-bright)'
            }}>
              <Mail size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0 }}>
                Instant Booking Email Notifications
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                Automatic alerts via Resend when a customer submits a new booking.
              </p>
            </div>
          </div>

          <div>
            {emailStatus?.configured ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80' }} />
                Resend Active
              </span>
            ) : (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(234, 179, 8, 0.15)',
                color: '#facc15',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#facc15' }} />
                Awaiting RESEND_API_KEY
              </span>
            )}
          </div>
        </div>

        <div style={{ background: 'var(--card-subtle)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>Recipient:</span>
            <code style={{ color: 'var(--gold-bright)' }}>{emailStatus?.recipient || 'srinucartravelsremium@gmail.com'}</code>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>Sender:</span>
            <span style={{ color: 'var(--text-muted)' }}>{emailStatus?.fromEmail || 'S CAR TRAVELS PREMIUM <onboarding@resend.dev>'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>Engine:</span>
            <span style={{ color: 'var(--text-muted)' }}>Official Resend Node.js SDK (Zero secrets exposed)</span>
          </div>
        </div>

        {testEmailMsg && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: '#4ade80',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem'
          }}>
            <CheckCircle2 size={16} />
            <span>{testEmailMsg}</span>
          </div>
        )}

        {testEmailError && (
          <div style={{
            background: 'var(--color-error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            color: 'var(--color-error)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} />
            <span>{testEmailError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleTestEmail}
          disabled={testEmailLoading}
          className="btn btn-outline-gold"
          style={{ padding: '0.75rem 1.25rem', fontSize: '0.88rem', gap: '0.5rem' }}
        >
          {testEmailLoading ? <span className="spinner" /> : <Send size={15} />}
          <span>{testEmailLoading ? 'Dispatching Test Notification...' : 'Send Test Notification Email'}</span>
        </button>
      </div>
    </div>
  );
}
