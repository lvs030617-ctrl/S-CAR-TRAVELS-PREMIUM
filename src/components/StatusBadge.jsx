import { Clock, CheckCircle2, CheckSquare, XCircle } from 'lucide-react';

export default function StatusBadge({ status }) {
  const normStatus = (status || 'pending').toLowerCase();

  switch (normStatus) {
    case 'confirmed':
      return (
        <span className="badge badge-green">
          <CheckCircle2 size={13} />
          <span>CONFIRMED</span>
        </span>
      );
    case 'completed':
      return (
        <span className="badge badge-blue">
          <CheckSquare size={13} />
          <span>COMPLETED</span>
        </span>
      );
    case 'cancelled':
      return (
        <span className="badge badge-red">
          <XCircle size={13} />
          <span>CANCELLED</span>
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="badge badge-amber">
          <Clock size={13} />
          <span>PENDING REVIEW</span>
        </span>
      );
  }
}
