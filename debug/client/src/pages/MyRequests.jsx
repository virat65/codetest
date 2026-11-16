import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, RefreshCw } from 'lucide-react';

import api from '../../../../swapdesk/client/src/api/client';
import StatusBadge from '../../../../swapdesk/client/src/components/StatusBadge';

const getCurrentUserId = () => {
  try {
    const token = localStorage.getItem('swapdesk_access_token');

    if (!token) return null;

    const payload = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const decoded = JSON.parse(
      atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))
    );

    return decoded.id || decoded._id || null;
  } catch {
    return null;
  }
};

export default function MyRequests() {
  const [tab, setTab] = useState('received');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  const visibleRequests = useMemo(() => {
    if (!currentUserId) return [];

    return requests.filter((request) => {
      const requesterId = request.requester?._id || request.requester;
      const colleagueId = request.colleague?._id || request.colleague;

      return tab === 'received'
        ? String(colleagueId) === String(currentUserId)
        : String(requesterId) === String(currentUserId);
    });
  }, [requests, tab, currentUserId]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/swap-requests/mine', {
        params: { page: 1, limit: 100 }
      });

      setRequests(
        Array.isArray(data.requests)
          ? data.requests
          : Array.isArray(data.swapRequests)
            ? data.swapRequests
            : []
      );
    } catch (err) {
      setError(
        err.response?.data?.message || 'Could not load swap requests.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { loadRequests(); }, 0);
    return () => clearTimeout(timer);
  }, [loadRequests]);

  const respond = async (id, action) => {
    setBusyId(id);
    setError('');

    try {
      await api.patch(`/swap-requests/${id}/respond`, { action });
      await loadRequests();
    } catch (err) {
      setError(
        err.response?.data?.message || 'Could not update this request.'
      );
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
      setError(
        err.response?.data?.message || 'Could not cancel this request.'
      );
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>My swap requests</h1>
          <p>Review requests you've sent or received.</p>
        </div>

        <button
          className="secondary-button"
          onClick={loadRequests}
          disabled={loading}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="error-message page-error">{error}</div>}

      <section className="panel">
        <div className="tabs">
          <button
            type="button"
            className={tab === 'received' ? 'active' : ''}
            onClick={() => setTab('received')}
          >
            Received
          </button>

          <button
            type="button"
            className={tab === 'sent' ? 'active' : ''}
            onClick={() => setTab('sent')}
          >
            Sent
          </button>
        </div>

        <div className="panel-heading">
          <div>
            <h2>{tab === 'received' ? 'Received requests' : 'Sent requests'}</h2>
            <p>{visibleRequests.length} request(s) found</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading requests...</div>
        ) : !currentUserId ? (
          <div className="empty-state">
            <strong>Unable to identify your account</strong>
            <p>Please sign in again and refresh this page.</p>
          </div>
        ) : visibleRequests.length === 0 ? (
          <div className="empty-state">
            <strong>No requests found</strong>
            <p>
              {tab === 'received'
                ? 'Requests sent to you will appear here.'
                : 'Requests you create will appear here.'}
            </p>
          </div>
        ) : (
          <div className="request-list">
            {visibleRequests.map((request) => {
              const shift = request.shift || {};
              const requester = request.requester || {};
              const colleague = request.colleague || {};

              const canRespond =
                tab === 'received' &&
                request.status === 'pending_colleague';

              const canCancel =
                tab === 'sent' &&
                ['pending_colleague', 'pending_admin'].includes(request.status);

              return (
                <article className="request-card" key={request._id}>
                  <div className="request-main">
                    <div className="request-date-icon">
                      <span className="calendar-mini">▦</span>
                    </div>

                    <div className="request-info">
                      <strong>
                        {shift.department || 'Shift'} ·{' '}
                        {shift.requiredClinicalRole || 'Staff'}
                      </strong>

                      <span>
                        {shift.start
                          ? new Date(shift.start).toLocaleString()
                          : 'Shift date unavailable'}
                      </span>

                      <small>
                        {tab === 'received' ? 'From: ' : 'To: '}
                        {tab === 'received'
                          ? requester.name || '—'
                          : colleague.name || '—'}
                      </small>
                    </div>
                  </div>

                  <div className="request-actions">
                    <StatusBadge status={request.status} />

                    {canRespond && (
                      <>
                        <button
                          type="button"
                          className="icon-action approve"
                          title="Accept request"
                          disabled={busyId === request._id}
                          onClick={() => respond(request._id, 'accept')}
                        >
                          <Check size={17} />
                        </button>

                        <button
                          type="button"
                          className="icon-action reject"
                          title="Decline request"
                          disabled={busyId === request._id}
                          onClick={() => respond(request._id, 'decline')}
                        >
                          <X size={17} />
                        </button>
                      </>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        className="small-button"
                        disabled={busyId === request._id}
                        onClick={() => cancel(request._id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
