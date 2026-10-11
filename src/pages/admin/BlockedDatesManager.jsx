import { useState, useEffect } from 'react';
import { CalendarOff, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../lib/api';

export default function BlockedDatesManager() {
  const { token } = useAuth();
  const [blockedDates, setBlockedDates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('Routine Vehicle Servicing & Inspection');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchBlockedDates = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/blocked-dates'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setBlockedDates(data.blockedDates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedDates();
  }, [token]);

  const handleAddBlock = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!startDate || !endDate || !reason.trim()) {
      setErrorMsg('Please specify start date, end date, and reason');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('End date must be on or after start date');
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/admin/blocked-dates'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim()
        })
      });

      const data = await res.json();
      if (res.status === 409) {
        setErrorMsg(data.error || 'Cannot block dates: Overlaps with an already confirmed trip!');
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add blocked date');
      }

      setSuccessMsg('Dates successfully blocked on the Ertiga calendar');
      setStartDate('');
      setEndDate('');
      fetchBlockedDates();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/blocked-dates/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchBlockedDates();
      }
    } catch (e) {}
  };

  return (
    <div className="container" style={{ maxWidth: '850px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Vehicle Calendar Date Blocker
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Block dates when the Ertiga is unavailable due to periodic maintenance, oil changes, or personal leave.
        </p>
      </div>

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add Block Form */}
      <form onSubmit={handleAddBlock} className="gold-card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarOff size={18} style={{ color: 'var(--gold-bright)' }} />
          <span>Block Single Vehicle Calendar Window</span>
        </h3>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Start Date *</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">End Date *</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reason *</label>
            <input
              type="text"
              required
              placeholder="e.g. 50,000 km Service / Personal"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <button type="submit" className="btn btn-gold btn-sm" style={{ padding: '0.65rem 1.25rem' }}>
          <Plus size={15} />
          <span>Add Calendar Block</span>
        </button>
      </form>

      {/* Blocked Dates List */}
      <div className="gold-card" style={{ padding: 0, overflow: 'hidden' }}>
        <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
          Active & Upcoming Blocked Intervals
        </h3>

        {blockedDates.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            No dates are currently blocked. The Ertiga is available according to normal booking inquiries.
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {blockedDates.map((b) => (
                  <tr key={b.id}>
                    <td><strong style={{ color: 'var(--gold-300)' }}>{b.start_date}</strong></td>
                    <td><strong style={{ color: 'var(--gold-300)' }}>{b.end_date}</strong></td>
                    <td>{b.reason}</td>
                    <td>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="btn btn-sm"
                        style={{ color: '#f87171' }}
                        title="Remove Block"
                      >
                        <Trash2 size={15} />
                        <span>Remove</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
