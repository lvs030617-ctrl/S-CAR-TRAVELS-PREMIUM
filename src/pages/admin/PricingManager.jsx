import { useState, useEffect } from 'react';
import { DollarSign, Save, CheckCircle2, AlertCircle, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../lib/api';

export default function PricingManager() {
  const { token } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [editingRule, setEditingRule] = useState(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/pricing'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setRules(data.rules || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [token]);

  const handleSave = async (rule) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/pricing/${rule.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(rule)
      });
      if (res.ok) {
        setSuccessMsg(`Updated pricing rule: ${rule.title_en}`);
        setEditingRule(null);
        fetchRules();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (e) {
      alert('Failed to update pricing rule');
    }
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Rental Packages & Pricing Rules
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Configure starter package rates, inclusions, and extra km pricing. Every rate is displayed as an indicative estimate.
        </p>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {rules.map((rule) => {
          const isEditing = editingRule?.id === rule.id;
          const current = isEditing ? editingRule : rule;

          return (
            <div key={rule.id} className="gold-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <span className="badge badge-gold" style={{ marginBottom: '0.35rem' }}>
                    Code: {rule.rule_code}
                  </span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>
                    {rule.title_en}
                  </h3>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    {rule.title_te}
                  </div>
                </div>

                {!isEditing ? (
                  <button
                    onClick={() => setEditingRule({ ...rule })}
                    className="btn btn-outline-gold btn-sm"
                  >
                    <Edit2 size={13} />
                    <span>Edit Rates</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleSave(editingRule)}
                      className="btn btn-gold btn-sm"
                    >
                      <Save size={13} />
                      <span>Save Changes</span>
                    </button>
                    <button
                      onClick={() => setEditingRule(null)}
                      className="btn btn-sm"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-gold)' }}>
                  <div className="grid-3" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Min Starter Price (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={current.min_price}
                        onChange={(e) => setEditingRule({ ...current, min_price: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Max Starter Price (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={current.max_price}
                        onChange={(e) => setEditingRule({ ...current, max_price: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Duration (Hours)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={current.duration_hours || 0}
                        onChange={(e) => setEditingRule({ ...current, duration_hours: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="grid-3" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={!!current.fuel_included}
                        onChange={(e) => setEditingRule({ ...current, fuel_included: e.target.checked ? 1 : 0 })}
                      />
                      <span>Fuel Included in Package</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={!!current.driver_bata_included}
                        onChange={(e) => setEditingRule({ ...current, driver_bata_included: e.target.checked ? 1 : 0 })}
                      />
                      <span>Driver Bata Included</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={!!current.active}
                        onChange={(e) => setEditingRule({ ...current, active: e.target.checked ? 1 : 0 })}
                      />
                      <span>Active on Website</span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="form-label">English Description</label>
                    <input
                      type="text"
                      className="form-input"
                      value={current.description_en || ''}
                      onChange={(e) => setEditingRule({ ...current, description_en: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Telugu Description</label>
                    <input
                      type="text"
                      className="form-input"
                      value={current.description_te || ''}
                      onChange={(e) => setEditingRule({ ...current, description_te: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Price Range:</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--gold-300)' }}>
                        ₹{rule.min_price?.toLocaleString('en-IN')} – ₹{rule.max_price?.toLocaleString('en-IN')}
                        {rule.rate_type === 'per_km' && <span style={{ fontSize: '0.85rem' }}>/km</span>}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <div>Fuel: {rule.fuel_included ? '✓ Included' : '✗ Excluded'}</div>
                      <div>Driver Bata: {rule.driver_bata_included ? '✓ Included' : '✗ Excluded'}</div>
                    </div>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {rule.description_en}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
