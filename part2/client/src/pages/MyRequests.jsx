// client/src/pages/MyRequests.jsx
import { useEffect, useState } from 'react';
import { api } from '../api';

export default function MyRequests() {
  const [tab, setTab] = useState('received');
  const [requests, setRequests] = useState([]);
  const [count, setCount] = useState(requests.length);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/me/swap-requests?box=${tab}`).then((res) => {
      setRequests(res.data.items);
    });
  }, []);

  const respond = async (id, action) => {
    setError('');
    try {
      const res = await fetch(`/api/swap-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      const target = requests.find((r) => r._id === id);
      target.status = data.status;
      setRequests(requests);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="tabs">
        <button onClick={() => setTab('received')}>Received</button>
        <button onClick={() => setTab('sent')}>Sent</button>
      </div>
      <p>{count} requests</p>
      {error && <p className="error">{error}</p>}
      <ul>
        {requests.map((r) => (
          <li>
            {r.shift.department} {new Date(r.shift.start).toLocaleString()} — {r.status}
            {tab === 'received' && r.status === 'pending_colleague' && (
              <>
                <button onClick={respond(r._id, 'accept')}>Accept</button>
                <button onClick={() => respond(r._id, 'decline')}>Decline</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
