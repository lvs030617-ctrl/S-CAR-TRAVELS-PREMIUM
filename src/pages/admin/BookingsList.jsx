import { useState, useEffect } from 'react';
import { Search, Filter, Download, Phone, MessageCircle, Eye, CheckCircle2, XCircle, CheckSquare, Clock, AlertCircle, Trash2, Edit3, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import { apiUrl } from '../../lib/api';

export default function BookingsList() {
  const { token, admin } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tripFilter, setTripFilter] = useState('all');

  // Modal / Detail state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [conflictError, setConflictError] = useState('');

  // Editable fields in modal
  const [editPrice, setEditPrice] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');

  const fetchBookings = async () => {
    setLoading(true);
    try {
      let endpoint = `/api/admin/bookings?status=${statusFilter}&trip_type=${tripFilter}`;
      if (search.trim()) endpoint += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(apiUrl(endpoint), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (err) {
      setErrorMsg('Failed to fetch bookings list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter, tripFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBookings();
  };

  const openBookingDetails = async (booking) => {
    setSelectedBooking(booking);
    setEditPrice(booking.final_agreed_price || booking.estimated_min_price || '');
    setEditAdminNotes(booking.admin_notes || '');
    setStatusRemarks('');
    setConflictError('');

    try {
      const res = await fetch(apiUrl(`/api/admin/bookings/${booking.id}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.auditLogs) {
        setAuditLogs(data.auditLogs);
      }
    } catch (e) {}
  };

  const updateStatus = async (newStatus) => {
    if (!selectedBooking) return;
    setUpdating(true);
    setConflictError('');
    setActionSuccess('');

    try {
      const res = await fetch(apiUrl(`/api/admin/bookings/${selectedBooking.id}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          remarks: statusRemarks.trim() || `Status updated to ${newStatus}`,
          final_agreed_price: editPrice ? parseInt(editPrice, 10) : null
        })
      });

      const data = await res.json();

      if (res.status === 409) {
        // OVERLAP CONFLICT DETECTED FOR SINGLE ERTIGA
        setConflictError(data.error || 'Double booking conflict detected on this date!');
        setUpdating(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      setActionSuccess(`Booking ${selectedBooking.reference_no} status changed to ${newStatus.toUpperCase()}`);
      setSelectedBooking(data.booking);
      fetchBookings();
    } catch (err) {
      setConflictError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const saveDetails = async () => {
    if (!selectedBooking) return;
    setUpdating(true);

    try {
      const res = await fetch(apiUrl(`/api/admin/bookings/${selectedBooking.id}/details`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          final_agreed_price: editPrice ? parseInt(editPrice, 10) : null,
          admin_notes: editAdminNotes.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedBooking(data.booking);
        setActionSuccess('Booking notes & agreed price updated successfully');
        fetchBookings();
      }
    } catch (err) {
      setConflictError('Failed to save details');
    } finally {
      setUpdating(false);
    }
  };

  const deleteBooking = async (id, ref) => {
    if (!confirm(`Are you sure you want to delete inquiry ${ref}? This follows your data retention policy and cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/admin/bookings/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedBooking(null);
        fetchBookings();
      }
    } catch (e) {}
  };

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
    <div className="container">
      {/* Top Header */}
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
            Bookings & Schedule Management
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Single Vehicle Scheduling • Total records: {bookings.length}
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="btn btn-outline-gold btn-sm"
        >
          <Download size={14} />
          <span>Export Bookings to CSV</span>
        </button>
      </div>

      {actionSuccess && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="gold-card" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 260px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by customer name, phone, ref no, destination..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.4rem' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          </div>

          <div style={{ width: '160px' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div style={{ width: '170px' }}>
            <select
              value={tripFilter}
              onChange={(e) => setTripFilter(e.target.value)}
              className="form-select"
            >
              <option value="all">All Trip Types</option>
              <option value="round_trip">Round Trip</option>
              <option value="one_way">One Way Drop</option>
              <option value="local_8h">Local (8h/80km)</option>
              <option value="full_day">Full Day</option>
              <option value="temple_tour">Temple Tour</option>
              <option value="self_drive">Self Drive</option>
            </select>
          </div>

          <button type="submit" className="btn btn-gold btn-sm">
            <span>Filter</span>
          </button>
        </form>
      </div>

      {/* Bookings Table */}
      <div className="gold-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gold-400)' }}>
            Loading bookings...
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            No bookings found matching current filters.
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ref No</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Route</th>
                  <th>Pickup Datetime</th>
                  <th>Trip Type</th>
                  <th>Status</th>
                  <th>Agreed / Est Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong style={{ color: 'var(--gold-300)' }}>{b.reference_no}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{b.customer_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{b.passengers} pass • {b.service_type}</div>
                    </td>
                    <td>
                      <a href={`tel:+91${b.customer_phone}`} style={{ color: '#60a5fa', fontWeight: '600' }}>
                        {b.customer_phone}
                      </a>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{b.pickup_location} → <strong>{b.destination}</strong></div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{new Date(b.pickup_datetime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      {b.return_datetime && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Ret: {new Date(b.return_datetime).toLocaleString('en-IN', { day: 'numeric', month: 'short' })}</div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>
                        {b.trip_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td>
                      <strong style={{ color: b.final_agreed_price ? '#4ade80' : 'var(--gold-300)' }}>
                        {b.final_agreed_price ? `₹${b.final_agreed_price}` : b.estimated_min_price ? `₹${b.estimated_min_price}–${b.estimated_max_price}` : 'Quote'}
                      </strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => openBookingDetails(b)}
                          className="btn btn-outline-gold btn-sm"
                          style={{ padding: '0.35rem 0.6rem' }}
                          title="View Details & Manage Status"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>

                        <a
                          href={`https://wa.me/91${b.customer_phone}?text=${encodeURIComponent(`Namaste ${b.customer_name} Garu, This is Srinu from S CAR TRAVELS PREMIUM regarding your Ertiga trip Ref: ${b.reference_no} (${b.pickup_location} to ${b.destination}).`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-whatsapp btn-sm"
                          style={{ padding: '0.35rem 0.5rem' }}
                          title="WhatsApp customer"
                        >
                          <MessageCircle size={13} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL / DRAWER */}
      {selectedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div className="gold-card animate-fade-in" style={{
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
            position: 'relative'
          }}>
            <button
              onClick={() => setSelectedBooking(null)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                color: 'var(--text-muted)',
                padding: '0.35rem',
                borderRadius: '6px'
              }}
            >
              <X size={22} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)' }}>
                Booking Details: {selectedBooking.reference_no}
              </h2>
              <StatusBadge status={selectedBooking.status} />
            </div>

            {conflictError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '8px',
                padding: '1rem',
                color: '#f87171',
                fontSize: '0.88rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}>
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>CONFLICT PREVENTED:</strong> {conflictError}
                </div>
              </div>
            )}

            {/* Trip Specs */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              fontSize: '0.88rem'
            }}>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div><span style={{ color: 'var(--text-dim)' }}>Customer:</span> <strong>{selectedBooking.customer_name}</strong></div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Phone:</span>{' '}
                  <a href={`tel:+91${selectedBooking.customer_phone}`} style={{ color: '#60a5fa', fontWeight: '700' }}>
                    +91 {selectedBooking.customer_phone}
                  </a>
                </div>
                <div><span style={{ color: 'var(--text-dim)' }}>Route:</span> <strong style={{ color: 'var(--gold-300)' }}>{selectedBooking.pickup_location} → {selectedBooking.destination}</strong></div>
                <div><span style={{ color: 'var(--text-dim)' }}>Service:</span> <strong>{selectedBooking.service_type === 'self_drive' ? 'Self Drive' : 'Chauffeur Driven'}</strong></div>
                <div><span style={{ color: 'var(--text-dim)' }}>Pickup:</span> <strong>{new Date(selectedBooking.pickup_datetime).toLocaleString('en-IN')}</strong></div>
                <div><span style={{ color: 'var(--text-dim)' }}>Return:</span> <strong>{selectedBooking.return_datetime ? new Date(selectedBooking.return_datetime).toLocaleString('en-IN') : 'Drop / One Way'}</strong></div>
                <div><span style={{ color: 'var(--text-dim)' }}>Pax / Bags:</span> <strong>{selectedBooking.passengers} passengers / {selectedBooking.luggage_count} bags</strong></div>
                <div><span style={{ color: 'var(--text-dim)' }}>Starter Estimate:</span> <strong>₹{selectedBooking.estimated_min_price || '-'} – ₹{selectedBooking.estimated_max_price || '-'}</strong></div>
              </div>

              {selectedBooking.special_notes && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--gold-300)' }}>Customer Notes:</span> {selectedBooking.special_notes}
                </div>
              )}
            </div>

            {/* Quick Customer Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem' }}>
              <a
                href={`tel:+91${selectedBooking.customer_phone}`}
                className="btn btn-phone btn-sm"
                style={{ flex: 1 }}
              >
                <Phone size={14} />
                <span>Call Customer</span>
              </a>

              <a
                href={`https://wa.me/91${selectedBooking.customer_phone}?text=${encodeURIComponent(`Namaste ${selectedBooking.customer_name} Garu, This is Srinu from S CAR TRAVELS PREMIUM regarding your Ertiga trip Ref: ${selectedBooking.reference_no}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp btn-sm"
                style={{ flex: 1 }}
              >
                <MessageCircle size={14} />
                <span>WhatsApp Customer</span>
              </a>
            </div>

            {/* Action 1: Change Status */}
            <div style={{
              background: 'rgba(212, 175, 55, 0.04)',
              border: '1px solid var(--border-gold)',
              borderRadius: '10px',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ color: 'var(--gold-300)', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                Single-Vehicle Action Bar
              </h4>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Audit Remarks / Change Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule verified; customer agreed on fare."
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={updating || selectedBooking.status === 'confirmed'}
                  onClick={() => updateStatus('confirmed')}
                  className="btn btn-sm btn-gold"
                >
                  <CheckCircle2 size={14} />
                  <span>Confirm Booking (Checks Overlap)</span>
                </button>

                <button
                  type="button"
                  disabled={updating || selectedBooking.status === 'completed'}
                  onClick={() => updateStatus('completed')}
                  className="btn btn-sm"
                  style={{ background: '#2563eb', color: '#fff' }}
                >
                  <CheckSquare size={14} />
                  <span>Mark Completed</span>
                </button>

                <button
                  type="button"
                  disabled={updating || selectedBooking.status === 'cancelled'}
                  onClick={() => updateStatus('cancelled')}
                  className="btn btn-sm"
                  style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}
                >
                  <XCircle size={14} />
                  <span>Cancel Booking</span>
                </button>

                <button
                  type="button"
                  disabled={updating || selectedBooking.status === 'pending'}
                  onClick={() => updateStatus('pending')}
                  className="btn btn-sm btn-outline-gold"
                >
                  <Clock size={14} />
                  <span>Reset to Pending</span>
                </button>
              </div>
            </div>

            {/* Action 2: Update Agreed Fare & Notes */}
            <div style={{
              background: 'var(--card-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                Pricing & Internal Admin Notes
              </h4>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Final Agreed Price (INR)</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="e.g. 5500"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Internal / Customer Admin Notes</label>
                  <input
                    type="text"
                    value={editAdminNotes}
                    onChange={(e) => setEditAdminNotes(e.target.value)}
                    placeholder="e.g. Advance ₹1000 received on GPay."
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={saveDetails}
                  disabled={updating}
                  className="btn btn-gold btn-sm"
                >
                  <Edit3 size={14} />
                  <span>Save Notes & Agreed Price</span>
                </button>

                <button
                  type="button"
                  onClick={() => deleteBooking(selectedBooking.id, selectedBooking.reference_no)}
                  className="btn btn-sm"
                  style={{ color: '#f87171', fontSize: '0.8rem' }}
                  title="Remove record as per retention policy"
                >
                  <Trash2 size={14} />
                  <span>Delete Record</span>
                </button>
              </div>
            </div>

            {/* Audit History Logs */}
            {auditLogs.length > 0 && (
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                  Audit History Logs:
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                  {auditLogs.map((log) => (
                    <div key={log.id} style={{ background: 'var(--card-subtle)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--gold-bright)' }}>{new Date(log.created_at).toLocaleString('en-IN')}:</span>{' '}
                      <span style={{ color: 'var(--text-main)' }}>[{log.changed_by}]</span>{' '}
                      <span style={{ color: 'var(--text-dim)' }}>{log.old_status ? `${log.old_status} → ${log.new_status}` : log.new_status}</span> - {log.remarks}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
