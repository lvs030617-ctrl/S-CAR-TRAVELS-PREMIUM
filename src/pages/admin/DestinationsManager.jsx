import { useState, useEffect } from 'react';
import { MapPin, Plus, Save, Trash2, Edit2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../lib/api';

export default function DestinationsManager() {
  const { token } = useAuth();
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDest, setEditingDest] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchDestinations = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/destinations'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDestinations(data.destinations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, [token]);

  const handleCreateNew = () => {
    setEditingDest({
      key_slug: '',
      name_en: '',
      name_te: '',
      distance_km: 100,
      duration_hours: '2 hrs',
      one_way_price_min: 3000,
      round_trip_price_min: 5000,
      round_trip_price_max: 6000,
      popular: 1,
      category: 'outstation',
      description_en: '',
      description_te: '',
      active: 1,
      sort_order: destinations.length + 1
    });
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!editingDest.name_en || !editingDest.name_te) {
      alert('Destination name in English and Telugu are required');
      return;
    }

    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = apiUrl(isNew ? '/api/admin/destinations' : `/api/admin/destinations/${editingDest.id}`);

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editingDest)
      });

      if (res.ok) {
        setSuccessMsg(isNew ? 'Added new destination' : 'Destination updated');
        setEditingDest(null);
        setIsNew(false);
        fetchDestinations();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (e) {
      alert('Error saving destination');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to remove destination "${name}"?`)) return;

    try {
      const res = await fetch(apiUrl(`/api/admin/destinations/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDestinations();
      }
    } catch (e) {}
  };

  return (
    <div className="container">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            Destinations & Route Tariffs
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Configure routes originating from Kotananduru hub, distances, and starting estimates.
          </p>
        </div>

        <button
          onClick={handleCreateNew}
          className="btn btn-gold btn-sm"
        >
          <Plus size={14} />
          <span>Add New Destination</span>
        </button>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Editor Modal / Card */}
      {editingDest && (
        <div className="gold-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1.25rem' }}>
            {isNew ? 'Add New Route Destination' : `Edit Destination: ${editingDest.name_en}`}
          </h3>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Destination Name (English) *</label>
              <input
                type="text"
                value={editingDest.name_en}
                onChange={(e) => setEditingDest({ ...editingDest, name_en: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Destination Name (Telugu script) *</label>
              <input
                type="text"
                value={editingDest.name_te}
                onChange={(e) => setEditingDest({ ...editingDest, name_te: e.target.value })}
                className="form-input"
              />
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Distance from Kotananduru (KM)</label>
              <input
                type="number"
                value={editingDest.distance_km}
                onChange={(e) => setEditingDest({ ...editingDest, distance_km: parseInt(e.target.value, 10) || 0 })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Approx Duration</label>
              <input
                type="text"
                placeholder="e.g. 2.5 hrs"
                value={editingDest.duration_hours}
                onChange={(e) => setEditingDest({ ...editingDest, duration_hours: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                value={editingDest.category}
                onChange={(e) => setEditingDest({ ...editingDest, category: e.target.value })}
                className="form-select"
              >
                <option value="outstation">Outstation Hub</option>
                <option value="temple">Temple Circuit</option>
                <option value="coastal">Coastal / Tourist</option>
              </select>
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">One-Way Starter Price (₹)</label>
              <input
                type="number"
                value={editingDest.one_way_price_min}
                onChange={(e) => setEditingDest({ ...editingDest, one_way_price_min: parseInt(e.target.value, 10) || 0 })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Round Trip Min (₹)</label>
              <input
                type="number"
                value={editingDest.round_trip_price_min}
                onChange={(e) => setEditingDest({ ...editingDest, round_trip_price_min: parseInt(e.target.value, 10) || 0 })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Round Trip Max (₹)</label>
              <input
                type="number"
                value={editingDest.round_trip_price_max}
                onChange={(e) => setEditingDest({ ...editingDest, round_trip_price_max: parseInt(e.target.value, 10) || 0 })}
                className="form-input"
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">English Description / Key Attractions</label>
              <textarea
                rows={2}
                value={editingDest.description_en || ''}
                onChange={(e) => setEditingDest({ ...editingDest, description_en: e.target.value })}
                className="form-textarea"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Telugu Description</label>
              <textarea
                rows={2}
                value={editingDest.description_te || ''}
                onChange={(e) => setEditingDest({ ...editingDest, description_te: e.target.value })}
                className="form-textarea"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={handleSave} className="btn btn-gold btn-sm">
              <Save size={14} />
              <span>Save Destination</span>
            </button>
            <button
              onClick={() => { setEditingDest(null); setIsNew(false); }}
              className="btn btn-outline-gold btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Destinations Table */}
      <div className="gold-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Destination (EN / TE)</th>
                <th>Distance</th>
                <th>Duration</th>
                <th>Category</th>
                <th>One Way (₹)</th>
                <th>Round Trip (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {destinations.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong style={{ color: 'var(--text-main)' }}>{d.name_en}</strong>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>{d.name_te}</div>
                  </td>
                  <td>~{d.distance_km} km</td>
                  <td>{d.duration_hours}</td>
                  <td>
                    <span className={`badge ${d.category === 'temple' ? 'badge-amber' : 'badge-blue'}`}>
                      {d.category}
                    </span>
                  </td>
                  <td>₹{d.one_way_price_min}</td>
                  <td>
                    <strong style={{ color: 'var(--gold-300)' }}>
                      ₹{d.round_trip_price_min} – ₹{d.round_trip_price_max}
                    </strong>
                  </td>
                  <td>
                    <span className={`badge ${d.active ? 'badge-green' : 'badge-red'}`}>
                      {d.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => { setEditingDest({ ...d }); setIsNew(false); }}
                        className="btn btn-outline-gold btn-sm"
                        style={{ padding: '0.35rem 0.6rem' }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(d.id, d.name_en)}
                        className="btn btn-sm"
                        style={{ color: '#f87171', padding: '0.35rem 0.6rem' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
