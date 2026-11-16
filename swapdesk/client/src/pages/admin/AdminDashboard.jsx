import { useEffect, useState } from 'react';
import {
  ClipboardList,
  Clock3,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  CalendarDays,
  BriefcaseBusiness
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

export default function AdminDashboard() {
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState([]);
  const [weekStart, setWeekStart] = useState(null);
  const [weekEnd, setWeekEnd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    api.get('/swap-requests/admin', { params: { limit: 100 } })
      .then(({ data }) => {
        setRequests(data.requests || data.swapRequests || data.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not load admin requests.');
      })
      .finally(() => setLoading(false));

    api.get('/swap-requests/admin/weekly-summary')
      .then(({ data }) => {
        setSummary(data.summary || []);
        setWeekStart(data.weekStart);
        setWeekEnd(data.weekEnd);
      })
      .catch((err) => {
        setSummaryError(
          err.response?.data?.message || 'Could not load weekly department summary.'
        );
      })
      .finally(() => setSummaryLoading(false));
  }, []);

  const pending = requests.filter((r) => r.status === 'pending_admin').length;
  const approved = requests.filter((r) => r.status === 'approved').length;
  const rejected = requests.filter((r) => r.status === 'rejected').length;
  const pendingRequests = requests.filter((r) => r.status === 'pending_admin');

  const formatDate = (date) => (
    date
      ? new Date(date).toLocaleDateString()
      : '—'
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMIN OVERVIEW</p>
          <h1>Dashboard</h1>
          <p>Monitor and manage hospital shift swap requests.</p>
        </div>

        <Link to="/admin/requests" className="primary-button">
          Review requests <ArrowUpRight size={17} />
        </Link>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total requests"
          value={requests.length}
          hint="Requests in the system"
          icon={ClipboardList}
        />
        <StatCard
          label="Awaiting approval"
          value={pending}
          hint="Require your decision"
          icon={Clock3}
        />
        <StatCard
          label="Approved"
          value={approved}
          hint="Roster changes approved"
          icon={CheckCircle2}
        />
        <StatCard
          label="Rejected"
          value={rejected}
          hint="Requests rejected"
          icon={XCircle}
        />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Weekly department summary</h2>
            <p>
              <CalendarDays size={14} style={{ display: 'inline', marginRight: 5 }} />
              {weekStart && weekEnd
                ? `${formatDate(weekStart)} – ${formatDate(
                    new Date(new Date(weekEnd).getTime() - 1)
                  )}`
                : 'Current UTC week'}
            </p>
          </div>
        </div>

        {summaryLoading ? (
          <div className="empty-state">Loading department summary...</div>
        ) : summaryError ? (
          <div className="error-message">{summaryError}</div>
        ) : summary.length === 0 ? (
          <div className="empty-state">
            No assignments found for this week.
          </div>
        ) : (
          <div className="stats-grid">
            {summary.map((item) => (
              <StatCard
                key={item.department}
                label={item.department}
                value={`${item.totalHours} hrs`}
                hint={`${item.assignmentCount} assigned shift(s)`}
                icon={BriefcaseBusiness}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Requests requiring attention</h2>
            <p>Colleague-approved requests awaiting admin review.</p>
          </div>
          <Link to="/admin/requests" className="text-link">
            View all <ArrowUpRight size={15} />
          </Link>
        </div>

        {loading ? (
          <div className="empty-state">Loading requests...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : pendingRequests.length === 0 ? (
          <div className="empty-state">
            <strong>You're all caught up</strong>
            <p>No requests are waiting for admin approval.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requester</th>
                  <th>Colleague</th>
                  <th>Shift</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.slice(0, 6).map((r) => (
                  <tr key={r._id}>
                    <td>{r.requester?.name || '—'}</td>
                    <td>{r.colleague?.name || '—'}</td>
                    <td>
                      {r.shift?.start
                        ? new Date(r.shift.start).toLocaleString()
                        : '—'}
                    </td>
                    <td>{r.shift?.department || '—'}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
