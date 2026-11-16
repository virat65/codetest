import { useCallback, useEffect, useState } from 'react';
import { Check, X, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

export default function StaffRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/swap-requests/mine');
      setRequests(data.requests || data.swapRequests || data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const respond = async (id, action) => {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/swap-requests/${id}/respond`, { action });
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update this request.');
    } finally {
      setBusyId('');
    }
  };

  const cancel = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/swap-requests/${id}/cancel`);
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel this request.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">WORKSPACE</p><h1>My swap requests</h1><p>Review requests you've sent or received.</p></div>
        <button className="secondary-button" onClick={loadRequests}><RefreshCw size={16} /> Refresh</button>
      </div>

      {error && <div className="error-message page-error">{error}</div>}

      <section className="panel">
        <div className="panel-heading"><div><h2>All requests</h2><p>{requests.length} request(s) found</p></div></div>
        {loading ? <div className="empty-state">Loading requests...</div> :
          requests.length === 0 ? <div className="empty-state"><strong>No requests found</strong><p>Requests you send or receive will show up here.</p></div> :
          <div className="request-list">
            {requests.map((request) => {
              const shift = request.shift || {};
              const colleague = request.colleague || {};
              const canRespond = request.status === 'pending_colleague';
              const canCancel = ['pending_colleague', 'pending_admin'].includes(request.status);

              return (
                <article className="request-card" key={request._id}>
                  <div className="request-main">
                    <div className="request-date-icon"><CalendarDaysIcon /></div>
                    <div className="request-info">
                      <strong>{shift.department || 'Shift'} · {shift.requiredClinicalRole || 'Staff'}</strong>
                      <span>{shift.start ? new Date(shift.start).toLocaleString() : 'Shift date unavailable'}</span>
                      <small>Colleague: {colleague.name || '—'}</small>
                    </div>
                  </div>
                  <div className="request-actions">
                    <StatusBadge status={request.status} />
                    {canRespond && <>
                      <button className="icon-action approve" title="Accept request" disabled={busyId === request._id} onClick={() => respond(request._id, 'accept')}><Check size={17} /></button>
                      <button className="icon-action reject" title="Decline request" disabled={busyId === request._id} onClick={() => respond(request._id, 'decline')}><X size={17} /></button>
                    </>}
                    {canCancel && <button className="small-button" disabled={busyId === request._id} onClick={() => cancel(request._id)}>Cancel</button>}
                  </div>
                </article>
              );
            })}
          </div>
        }
      </section>
    </>
  );
}

function CalendarDaysIcon() {
  return <span className="calendar-mini">▦</span>;
}
