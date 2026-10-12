import { useState, useEffect } from 'react';
import { Save, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../lib/api';

export default function VehicleManager() {
  const { token } = useAuth();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [featureInput, setFeatureInput] = useState('');

  const fetchVehicle = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/vehicle'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setVehicle(data.vehicle);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch(apiUrl('/api/admin/vehicle'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (active) setVehicle(data.vehicle);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [token]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(apiUrl('/api/admin/vehicle'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(vehicle)
      });
      if (res.ok) {
        setSuccessMsg('White Suzuki Ertiga details updated successfully');
        fetchVehicle();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (_err) {
      alert('Failed to update vehicle');
    }
  };

  const addFeature = () => {
    if (!featureInput.trim()) return;
    const currentFeatures = vehicle.features || [];
    setVehicle({ ...vehicle, features: [...currentFeatures, featureInput.trim()] });
    setFeatureInput('');
  };

  const removeFeature = (idx) => {
    const currentFeatures = [...(vehicle.features || [])];
    currentFeatures.splice(idx, 1);
    setVehicle({ ...vehicle, features: currentFeatures });
  };

  if (loading || !vehicle) {
    return <div className="container" style={{ color: 'var(--gold-400)' }}>Loading vehicle specifications...</div>;
  }

  return (
    <div className="container" style={{ maxWidth: '850px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div className="badge badge-gold" style={{ marginBottom: '0.5rem' }}>
          <ShieldCheck size={14} />
          <span>SOLE FLEET VEHICLE SPECIFICATIONS</span>
        </div>
        <h1 style={{ fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Manage White Suzuki Ertiga
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Update registration number, documentation dates, hygiene timestamps, and comfort features.
        </p>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="gold-card" style={{ padding: '2.5rem' }}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Model Name</label>
            <input
              type="text"
              required
              value={vehicle.model_name}
              onChange={(e) => setVehicle({ ...vehicle, model_name: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Vehicle Color</label>
            <input
              type="text"
              required
              value={vehicle.color}
              onChange={(e) => setVehicle({ ...vehicle, color: e.target.value })}
              className="form-input"
            />
          </div>
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Registration Number</label>
            <input
              type="text"
              required
              value={vehicle.registration_number}
              onChange={(e) => setVehicle({ ...vehicle, registration_number: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Seating Capacity</label>
            <input
              type="number"
              value={vehicle.seating_capacity}
              onChange={(e) => setVehicle({ ...vehicle, seating_capacity: parseInt(e.target.value, 10) || 7 })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fleet Operational Status</label>
            <select
              value={vehicle.status}
              onChange={(e) => setVehicle({ ...vehicle, status: e.target.value })}
              className="form-select"
            >
              <option value="available">Available for Bookings</option>
              <option value="under_maintenance">Under Scheduled Maintenance</option>
              <option value="on_trip">Currently On Trip</option>
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Fuel Type & Engine</label>
            <input
              type="text"
              value={vehicle.fuel_type}
              onChange={(e) => setVehicle({ ...vehicle, fuel_type: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Transmission</label>
            <input
              type="text"
              value={vehicle.transmission}
              onChange={(e) => setVehicle({ ...vehicle, transmission: e.target.value })}
              className="form-input"
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Air Conditioning Specs</label>
            <input
              type="text"
              value={vehicle.air_conditioning}
              onChange={(e) => setVehicle({ ...vehicle, air_conditioning: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Luggage Accommodation Description</label>
            <input
              type="text"
              value={vehicle.luggage_capacity}
              onChange={(e) => setVehicle({ ...vehicle, luggage_capacity: e.target.value })}
              className="form-input"
            />
          </div>
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Insurance Valid Until</label>
            <input
              type="date"
              value={vehicle.insurance_valid_until || ''}
              onChange={(e) => setVehicle({ ...vehicle, insurance_valid_until: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fitness Certificate Until</label>
            <input
              type="date"
              value={vehicle.fitness_valid_until || ''}
              onChange={(e) => setVehicle({ ...vehicle, fitness_valid_until: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Last Sanitized Date</label>
            <input
              type="text"
              value={vehicle.last_sanitized_at || ''}
              onChange={(e) => setVehicle({ ...vehicle, last_sanitized_at: e.target.value })}
              className="form-input"
            />
          </div>
        </div>

        {/* Features Manager */}
        <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
          <label className="form-label" style={{ marginBottom: '0.5rem' }}>Comfort & Safety Features</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="Add feature (e.g. Roof AC vents, Fast USB chargers...)"
              value={featureInput}
              onChange={(e) => setFeatureInput(e.target.value)}
              className="form-input"
            />
            <button type="button" onClick={addFeature} className="btn btn-outline-gold btn-sm">
              Add
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {(vehicle.features || []).map((feat, idx) => (
              <span
                key={idx}
                className="badge badge-gold"
                style={{ padding: '0.4rem 0.75rem', cursor: 'pointer' }}
                onClick={() => removeFeature(idx)}
                title="Click to remove feature"
              >
                {feat} ✕
              </span>
            ))}
          </div>
        </div>

        <button type="submit" className="btn btn-gold btn-lg" style={{ width: '100%' }}>
          <Save size={18} />
          <span>Save Ertiga Specifications</span>
        </button>
      </form>
    </div>
  );
}
