import { useEffect, useState } from 'react';
import {
  CalendarDays, Clock3, Repeat2, ArrowUpRight, BriefcaseBusiness
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

export default function StaffDashboard() {
  const { user } = useAuth();

  const [requests, setRequests] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [requestResponse, shiftResponse] = await Promise.all([
          api.get('/swap-requests/mine'),
          api.get('/workflow/my-shifts')
        ]);

        const requestData = requestResponse.data;
        const shiftData = shiftResponse.data;

        setRequests(
          requestData.requests ||
          requestData.swapRequests ||
          requestData.data ||
          []
        );

        setAssignments(shiftData.assignments || []);
        setWeeklyHours(shiftData.weeklyHours || 0);
      } catch (err) {
        setError(
          err.response?.data?.message ||
          'Could not load your dashboard.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const pending = requests.filter((r) =>
    ['pending_colleague', 'pending_admin'].includes(r.status)
  ).length;

  const approved = requests.filter((r) =>
    r.status === 'approved'
  ).length;

  const formatDate = (date) =>
    new Date(date).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">STAFF OVERVIEW</p>
          <h1>Good day, {user?.name?.split(' ')[0] || 'there'} 👋</h1>
          <p>Here's an overview of your shifts and swap activity.</p>
        </div>

        <Link className="primary-button" to="/staff/create-request">
          Create swap request <ArrowUpRight size={17} />
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="stats-grid">
        <StatCard
          label="Upcoming shifts"
          value={assignments.length}
          hint="Your assigned future shifts"
          icon={CalendarDays}
        />
        <StatCard
          label="Weekly working hours"
          value={`${weeklyHours} hrs`}
          hint="Monday to Sunday (UTC)"
          icon={Clock3}
        />
        <StatCard
          label="Awaiting action"
          value={pending}
          hint="Requests still in progress"
          icon={Repeat2}
        />
        <StatCard
          label="Approved swaps"
          value={approved}
          hint="Successfully approved"
          icon={BriefcaseBusiness}
        />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Upcoming shifts</h2>
            <p>Your current assigned roster.</p>
          </div>
          <CalendarDays size={21} />
        </div>

        {loading ? (
          <div className="empty-state">Loading your shifts...</div>
        ) : assignments.length === 0 ? (
          <div className="empty-state">
            <CalendarDays size={25} />
            <strong>No upcoming shifts</strong>
            <p>Your assigned upcoming shifts will appear here.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Clinical role</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment._id}>
                    <td>{assignment.shift.department}</td>
                    <td>{assignment.shift.requiredClinicalRole}</td>
                    <td>{formatDate(assignment.shift.start)}</td>
                    <td>{formatDate(assignment.shift.end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent swap requests</h2>
            <p>Track the latest updates on your requests.</p>
          </div>
          <Link to="/staff/requests" className="text-link">
            View all <ArrowUpRight size={15} />
          </Link>
        </div>

        {loading ? (
          <div className="empty-state">Loading your requests...</div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Repeat2 size={24} /></div>
            <strong>No swap requests yet</strong>
            <p>Your swap requests will appear here.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Shift</th>
                  <th>Colleague</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.slice(0, 6).map((request) => (
                  <tr key={request._id}>
                    <td>
                      {request.shift?.start
                        ? formatDate(request.shift.start)
                        : 'Shift details'}
                    </td>
                    <td>{request.colleague?.name || '—'}</td>
                    <td>{request.shift?.department || '—'}</td>
                    <td><StatusBadge status={request.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="info-banner">
        <div className="info-banner-icon"><CalendarDays size={22} /></div>
        <div>
          <strong>Remember to plan ahead</strong>
          <p>
            Swap requests are only available for shifts that have not started.
            Admin approval is required before a roster is changed.
          </p>
        </div>
      </section>
    </>
  );
}
