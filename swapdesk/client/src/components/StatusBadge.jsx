const labels = {
  pending_colleague: 'Awaiting colleague',
  pending_admin: 'Awaiting admin',
  approved: 'Approved',
  declined: 'Declined',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired'
};

export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status || 'unknown'}`}>
      {(labels[status] || status || 'Unknown').replaceAll('_', ' ')}
    </span>
  );
}
