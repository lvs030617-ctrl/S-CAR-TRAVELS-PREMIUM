import { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../lib/api';

export default function SettingsManager() {
  const { token } = useAuth();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

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
  }, [token]);

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
    </div>
  );
}
