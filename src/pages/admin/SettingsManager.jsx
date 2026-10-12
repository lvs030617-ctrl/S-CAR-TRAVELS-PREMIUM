import { useState, useEffect } from 'react';
import {
  Settings, Save, CheckCircle2, Lock, ShieldAlert, KeyRound, AlertCircle, Mail, Send,
  Users, UserPlus, Shield, Trash2, RefreshCw, History
} from 'lucide-react';
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

  // Multi-Admin Management state
  const isSuperAdmin = admin?.role === 'superadmin';
  const [adminAccounts, setAdminAccounts] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState('');
  const [accountsSuccess, setAccountsSuccess] = useState('');

  // Add Admin form modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Audit logs state
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

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

  const fetchAdminAccounts = async () => {
    if (!isSuperAdmin) return;
    setAccountsLoading(true);
    setAccountsError('');
    try {
      const res = await adminFetch('/api/admin/accounts');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch admin accounts');
      }
      setAdminAccounts(data.admins || []);
      setPendingInvites(data.pendingInvites || []);
    } catch (err) {
      setAccountsError(err.message || 'Failed to load administrator accounts');
    } finally {
      setAccountsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    if (!isSuperAdmin) return;
    setAuditLoading(true);
    try {
      const res = await adminFetch('/api/admin/accounts/audit-logs');
      const data = await res.json();
      if (res.ok) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    adminFetch('/api/admin/email-status')
      .then(res => res.json())
      .then(data => setEmailStatus(data))
      .catch(() => {});

    if (isSuperAdmin) {
      fetchAdminAccounts();
    }
  }, [token, adminFetch, isSuperAdmin]);

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteLoading(true);

    try {
      const res = await adminFetch('/api/admin/accounts/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: inviteName,
          email: inviteEmail,
          role: inviteRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to invite administrator');
      }

      setAccountsSuccess(data.message || `Invitation successfully sent to ${inviteEmail}!`);
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('admin');
      fetchAdminAccounts();
      setTimeout(() => setAccountsSuccess(''), 7000);
    } catch (err) {
      setInviteError(err.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleToggleStatus = async (targetAdmin) => {
    const isCurrentlyActive = targetAdmin.is_active === 1 && targetAdmin.status === 'active';
    const actionLabel = isCurrentlyActive ? 'disable' : 'enable';

    if (!window.confirm(`Are you sure you want to ${actionLabel} administrator "${targetAdmin.username}"?`)) {
      return;
    }

    try {
      const res = await adminFetch(`/api/admin/accounts/${targetAdmin.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: isCurrentlyActive ? 'disabled' : 'active' })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${actionLabel} administrator`);
      }
      setAccountsSuccess(data.message);
      fetchAdminAccounts();
      setTimeout(() => setAccountsSuccess(''), 5000);
    } catch (err) {
      alert(err.message || `Failed to ${actionLabel} account`);
    }
  };

  const handleRoleToggle = async (targetAdmin) => {
    const newRole = targetAdmin.role === 'superadmin' ? 'admin' : 'superadmin';
    const roleLabel = newRole === 'superadmin' ? 'Super Administrator' : 'Standard Administrator';

    if (!window.confirm(`Change role for "${targetAdmin.username}" to ${roleLabel}?`)) {
      return;
    }

    try {
      const res = await adminFetch(`/api/admin/accounts/${targetAdmin.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update role');
      }
      setAccountsSuccess(data.message);
      fetchAdminAccounts();
      setTimeout(() => setAccountsSuccess(''), 5000);
    } catch (err) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleDeleteAdmin = async (targetAdmin) => {
    if (!window.confirm(`Are you sure you want to permanently delete administrator "${targetAdmin.username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await adminFetch(`/api/admin/accounts/${targetAdmin.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete administrator');
      }
      setAccountsSuccess(data.message || 'Administrator removed.');
      fetchAdminAccounts();
      setTimeout(() => setAccountsSuccess(''), 5000);
    } catch (err) {
      alert(err.message || 'Failed to delete account');
    }
  };

  const handleResendInvite = async (targetAdmin) => {
    try {
      const res = await adminFetch(`/api/admin/accounts/${targetAdmin.id}/resend-invite`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend invitation');
      }
      setAccountsSuccess(data.message || `Invitation resent to ${targetAdmin.email}!`);
      fetchAdminAccounts();
      setTimeout(() => setAccountsSuccess(''), 6000);
    } catch (err) {
      alert(err.message || 'Failed to resend invitation');
    }
  };

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
            <code style={{ color: 'var(--gold-bright)' }}>{emailStatus?.recipient || 'srinucartravelspremium@gmail.com'}</code>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>Sender:</span>
            <span style={{ color: 'var(--text-muted)' }}>{emailStatus?.fromEmail || 'S CAR TRAVELS PREMIUM <onboarding@resend.dev>'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>Engine:</span>
            <span style={{ color: 'var(--text-muted)' }}>Official Resend Node.js SDK (Zero secrets exposed)</span>
          </div>
          {emailStatus?.isSandbox && (
            <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '6px', color: '#facc15', fontSize: '0.8rem', lineHeight: '1.4' }}>
              <strong>Sandbox Sender Active:</strong> Resend testing domain (<code>onboarding@resend.dev</code>) can only deliver emails to the account owner. To invite other administrators, verify a domain at <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-bright)', textDecoration: 'underline' }}>resend.com/domains</a> and configure <code>RESEND_FROM_EMAIL</code> in Render.
            </div>
          )}
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

      {/* 4. Administrator Accounts & Privileges */}
      <div className="gold-card" style={{ padding: '2.5rem', marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--gold-300)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} />
              <span>4. Administrator Accounts & Access Control</span>
            </h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
              Manage team accounts, invitations, active roles, and security authorization.
            </p>
          </div>

          {isSuperAdmin && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setShowAuditLogs(!showAuditLogs); if (!showAuditLogs) fetchAuditLogs(); }}
                className="btn btn-outline-gold"
                style={{ padding: '0.55rem 0.95rem', fontSize: '0.82rem', gap: '0.4rem' }}
              >
                <History size={15} />
                <span>{showAuditLogs ? 'Hide Audit Log' : 'Activity Audit Log'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="btn btn-gold"
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', gap: '0.4rem' }}
              >
                <UserPlus size={15} />
                <span>+ Invite Admin</span>
              </button>
            </div>
          )}
        </div>

        {!isSuperAdmin ? (
          <div style={{
            background: 'rgba(212, 175, 55, 0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center',
            color: 'var(--text-dim)'
          }}>
            <Shield size={28} style={{ color: 'var(--gold-400)', margin: '0 auto 0.5rem', display: 'block' }} />
            <h4 style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
              Super Administrator Access Required
            </h4>
            <p style={{ fontSize: '0.85rem', margin: 0 }}>
              You are signed in as an <strong>Administrator</strong>. Account creation, role elevation, and admin status modifications are restricted strictly to Super Administrators.
            </p>
          </div>
        ) : (
          <div>
            {accountsSuccess && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#4ade80',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem'
              }}>
                <CheckCircle2 size={16} />
                <span>{accountsSuccess}</span>
              </div>
            )}

            {accountsError && (
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
                <span>{accountsError}</span>
              </div>
            )}

            {/* Audit Logs Accordion View */}
            {showAuditLogs && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1.25rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ color: 'var(--gold-300)', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <History size={16} />
                    <span>Recent Administrative Audit Events</span>
                  </h4>
                  <button
                    type="button"
                    onClick={fetchAuditLogs}
                    className="btn btn-outline-gold"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', gap: '0.3rem' }}
                  >
                    <RefreshCw size={12} />
                    <span>Refresh</span>
                  </button>
                </div>

                {auditLoading ? (
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', padding: '1rem 0' }}>Loading logs...</div>
                ) : auditLogs.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No recorded audit events yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto', maxHeight: '250px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                          <th style={{ padding: '0.5rem' }}>Time</th>
                          <th style={{ padding: '0.5rem' }}>Action</th>
                          <th style={{ padding: '0.5rem' }}>Actor</th>
                          <th style={{ padding: '0.5rem' }}>Target</th>
                          <th style={{ padding: '0.5rem' }}>IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '0.5rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td style={{ padding: '0.5rem', fontWeight: '600', color: 'var(--gold-300)' }}>
                              {log.action}
                            </td>
                            <td style={{ padding: '0.5rem', color: 'var(--text-main)' }}>
                              {log.actor_username}
                            </td>
                            <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                              {log.target_username || log.target_email || '-'}
                            </td>
                            <td style={{ padding: '0.5rem', color: 'var(--text-dim)' }}>
                              {log.ip_address || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Administrators Table */}
            {accountsLoading ? (
              <div style={{ color: 'var(--text-dim)', padding: '1.5rem 0', textAlign: 'center' }}>
                <span className="spinner" style={{ marginRight: '0.5rem' }} />
                <span>Loading administrator directory...</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Administrator</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Registered Email</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Role</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Created</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminAccounts.map((acc) => {
                      const isSelf = Number(acc.id) === Number(admin?.id);
                      return (
                        <tr key={acc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '0.85rem 0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: acc.role === 'superadmin' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                                border: `1px solid ${acc.role === 'superadmin' ? 'var(--gold-400)' : '#38bdf8'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: acc.role === 'superadmin' ? 'var(--gold-300)' : '#38bdf8',
                                fontSize: '0.8rem',
                                fontWeight: '700'
                              }}>
                                {acc.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <strong style={{ color: 'var(--text-main)', display: 'block' }}>
                                  {acc.username}
                                  {isSelf && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--gold-400)', fontWeight: 'normal' }}>(You)</span>}
                                </strong>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', color: 'var(--text-muted)' }}>
                            {acc.email}
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              background: acc.role === 'superadmin' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                              color: acc.role === 'superadmin' ? '#fbbf24' : '#38bdf8',
                              border: `1px solid ${acc.role === 'superadmin' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`
                            }}>
                              {acc.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem' }}>
                            {acc.status === 'invited' ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                background: 'rgba(234, 179, 8, 0.15)',
                                color: '#facc15',
                                border: '1px solid rgba(234, 179, 8, 0.3)'
                              }}>
                                Pending Invite
                              </span>
                            ) : acc.is_active === 1 && acc.status === 'active' ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                background: 'rgba(34, 197, 94, 0.15)',
                                color: '#4ade80',
                                border: '1px solid rgba(34, 197, 94, 0.3)'
                              }}>
                                Active
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)'
                              }}>
                                Disabled
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', color: 'var(--text-dim)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {new Date(acc.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                              {acc.status === 'invited' && (
                                <button
                                  type="button"
                                  onClick={() => handleResendInvite(acc)}
                                  className="btn btn-outline-gold"
                                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', gap: '0.3rem' }}
                                  title="Resend invitation email"
                                >
                                  <RefreshCw size={12} />
                                  <span>Resend</span>
                                </button>
                              )}

                              {!isSelf && acc.status !== 'invited' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleRoleToggle(acc)}
                                    className="btn btn-outline-gold"
                                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                                    title={`Switch role to ${acc.role === 'superadmin' ? 'Admin' : 'Super Admin'}`}
                                  >
                                    {acc.role === 'superadmin' ? 'Demote' : 'Promote'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(acc)}
                                    style={{
                                      padding: '0.35rem 0.6rem',
                                      fontSize: '0.75rem',
                                      background: 'transparent',
                                      border: `1px solid ${acc.is_active === 1 ? '#ef4444' : '#22c55e'}`,
                                      color: acc.is_active === 1 ? '#ef4444' : '#22c55e',
                                      borderRadius: '4px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {acc.is_active === 1 ? 'Disable' : 'Enable'}
                                  </button>
                                </>
                              )}

                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAdmin(acc)}
                                  style={{
                                    padding: '0.35rem 0.5rem',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--text-dim)',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                  title="Remove administrator account"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Administrator Modal */}
      {showInviteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="gold-card" style={{ maxWidth: '480px', width: '100%', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--gold-300)', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={18} />
                <span>Invite New Administrator</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Send a single-use, 48-hour activation link to the recipient's email. They will verify their email and set their password.
            </p>

            {inviteError && (
              <div style={{
                background: 'var(--color-error-bg)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: 'var(--color-error)',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleInviteSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Full Name / Username</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. srinivas_admin"
                  className="form-input"
                  minLength={3}
                  maxLength={30}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Registered Admin Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. colleague@example.com"
                  className="form-input"
                />
                <small style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                  Verification OTP codes will always be sent to this email upon login.
                </small>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Administrative Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.35rem' }}>
                  <label style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: `1px solid ${inviteRole === 'admin' ? 'var(--gold-400)' : 'var(--border-subtle)'}`,
                    background: inviteRole === 'admin' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    display: 'block'
                  }}>
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={inviteRole === 'admin'}
                      onChange={() => setInviteRole('admin')}
                      style={{ marginRight: '0.4rem' }}
                    />
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>Admin</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Manage bookings, pricing, vehicles & settings.
                    </p>
                  </label>

                  <label style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: `1px solid ${inviteRole === 'superadmin' ? 'var(--gold-400)' : 'var(--border-subtle)'}`,
                    background: inviteRole === 'superadmin' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    display: 'block'
                  }}>
                    <input
                      type="radio"
                      name="role"
                      value="superadmin"
                      checked={inviteRole === 'superadmin'}
                      onChange={() => setInviteRole('superadmin')}
                      style={{ marginRight: '0.4rem' }}
                    />
                    <strong style={{ color: '#fbbf24', fontSize: '0.88rem' }}>Super Admin</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Full access to invite, promote & disable admins.
                    </p>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-outline-gold"
                  style={{ padding: '0.65rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="btn btn-gold"
                  style={{ padding: '0.65rem 1.25rem', gap: '0.5rem' }}
                >
                  {inviteLoading ? <span className="spinner" /> : <Send size={15} />}
                  <span>{inviteLoading ? 'Sending Invitation...' : 'Send Invitation Email'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
