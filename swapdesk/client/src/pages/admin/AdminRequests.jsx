import { useCallback, useEffect, useState } from 'react';
import { Check, X, RefreshCw, Search } from 'lucide-react';
import api from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

export default function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('pending_admin');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 100 };
      if (status) params.status = status;
      if (department) params.department = department;
      const { data } = await api.get('/swap-requests/admin', { params });
      setRequests(data.requests || data.swapRequests || data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load requests.');
    } finally {
      setLoading(false);
    }
  }, [status, department]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const decide = async (id, decision) => {
    const note = window.prompt(`Optional note for ${decision === 'approve' ? 'approval' : 'rejection'}:`, '');
    if (note === null) return;

    setBusyId(id);
    setError('');
    try {
      await api.patch(`/swap-requests/admin/${id}/${decision}`, { note });
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || `Could not ${decision} request.`);
    } finally {
      setBusyId('');
    }
  };

  const visibleRequests = requests.filter((request) => {
    const text = [
      request.requester?.name,
      request.colleague?.name,
      request.shift?.department
    ].join(' ').toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">ADMINISTRATION</p><h1>Swap requests</h1><p>Review colleague-approved requests and make the final decision.</p></div>
        <button className="secondary-button" onClick={loadRequests}><RefreshCw size={16} /> Refresh</button>
      </div>

      <section className="panel">
        <div className="filter-row">
          <div className="filter-control">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending_admin">Awaiting admin</option>
              <option value="pending_colleague">Awaiting colleague</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
              <option value="">All statuses</option>
            </select>
          </div>
          <div className="filter-control">
            <label>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              <option>ICU</option><option>ER</option><option>General Ward</option>
              <option>Paediatrics</option><option>Radiology</option>
            </select>
          </div>
          <div className="filter-control search-control">
            <label>Search</label>
            <div className="search-input"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff or department" /></div>
          </div>
        </div>

        {error && <div className="error-message page-error">{error}</div>}

        {loading ? <div className="empty-state">Loading requests...</div> :
          visibleRequests.length === 0 ? <div className="empty-state"><strong>No matching requests</strong><p>Try changing the filters.</p></div> :
          <div className="table-wrap">
            <table>
              <thead><tr><th>Requester</th><th>Colleague</th><th>Shift date</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {visibleRequests.map((request) => (
                  <tr key={request._id}>
                    <td><strong>{request.requester?.name || '—'}</strong><small className="table-sub">{request.requester?.email || ''}</small></td>
                    <td>{request.colleague?.name || '—'}</td>
                    <td>{request.shift?.start ? new Date(request.shift.start).toLocaleString() : '—'}</td>
                    <td>{request.shift?.department || '—'}</td>
                    <td><StatusBadge status={request.status} /></td>
                    <td>
                      {request.status === 'pending_admin' ? (
                        <div className="table-actions">
                          <button className="icon-action approve" title="Approve" disabled={busyId === request._id} onClick={() => decide(request._id, 'approve')}><Check size={17} /></button>
                          <button className="icon-action reject" title="Reject" disabled={busyId === request._id} onClick={() => decide(request._id, 'reject')}><X size={17} /></button>
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </section>
    </>
  );
}
