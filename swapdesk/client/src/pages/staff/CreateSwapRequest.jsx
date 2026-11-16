import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock3, Users, Send } from 'lucide-react';
import api from '../../api/client';

export default function CreateSwapRequest() {
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState([]);
  const [selectedShift, setSelectedShift] = useState('');
  const [colleagues, setColleagues] = useState([]);
  const [selectedColleague, setSelectedColleague] = useState('');
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [loadingColleagues, setLoadingColleagues] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadShifts = async () => {
      try {
        const { data } = await api.get('/workflow/my-shifts');
        setAssignments(data.assignments || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load your upcoming shifts.');
      } finally {
        setLoadingShifts(false);
      }
    };

    loadShifts();
  }, []);

  useEffect(() => {
    if (!selectedShift) {
      setColleagues([]);
      setSelectedColleague('');
      return;
    }

    const loadColleagues = async () => {
      setLoadingColleagues(true);
      setError('');
      setSuccess('');
      setSelectedColleague('');

      try {
        const { data } = await api.get('/workflow/eligible', {
          params: { shiftId: selectedShift, limit: 100 }
        });

        setColleagues(data.colleagues || []);
      } catch (err) {
        setColleagues([]);
        setError(err.response?.data?.message || 'Unable to load eligible colleagues.');
      } finally {
        setLoadingColleagues(false);
      }
    };

    loadColleagues();
  }, [selectedShift]);

  const selectedAssignment = assignments.find(
    (assignment) => assignment.shift?._id === selectedShift
  );

  const formatDate = (date) =>
    new Date(date).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedShift || !selectedColleague) {
      setError('Please select both a shift and a colleague.');
      return;
    }

    setSubmitting(true);

    try {
      const { data } = await api.post('/swap-requests', {
        shiftId: selectedShift,
        colleagueId: selectedColleague
      });

      setSuccess(data.message || 'Swap request created successfully.');

      setTimeout(() => {
        navigate('/staff/requests');
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create swap request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">STAFF WORKSPACE</p>
          <h1>Create swap request</h1>
          <p>Choose an upcoming shift and an eligible colleague.</p>
        </div>

        <button
          className="secondary-button"
          onClick={() => navigate('/staff/requests')}
        >
          <ArrowLeft size={17} /> My Requests
        </button>
      </div>

      <section className="panel swap-form-panel">
        <div className="panel-heading">
          <div>
            <h2>Request details</h2>
            <p>Your roster will only change after admin approval.</p>
          </div>
          <CalendarDays size={24} />
        </div>

        {error && <div className="error-message swap-message">{error}</div>}
        {success && <div className="success-message swap-message">{success}</div>}

        {loadingShifts ? (
          <div className="empty-state">Loading your upcoming shifts...</div>
        ) : assignments.length === 0 ? (
          <div className="empty-state">
            <CalendarDays size={30} />
            <strong>No upcoming assigned shifts</strong>
            <p>You need an upcoming assigned shift before creating a swap request.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="swap-form">
            <div className="swap-field">
              <label htmlFor="shift">Select shift</label>
              <select
                id="shift"
                value={selectedShift}
                onChange={(event) => setSelectedShift(event.target.value)}
                required
              >
                <option value="">Choose your shift</option>
                {assignments.map((assignment) => {
                  const shift = assignment.shift;

                  return (
                    <option key={assignment._id} value={shift._id}>
                      {shift.department} — {shift.requiredClinicalRole} — {formatDate(shift.start)}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedAssignment?.shift && (
              <div className="selected-shift-card">
                <div className="selected-shift-icon">
                  <CalendarDays size={22} />
                </div>
                <div>
                  <strong>
                    {selectedAssignment.shift.department} · {selectedAssignment.shift.requiredClinicalRole}
                  </strong>
                  <p>
                    <Clock3 size={14} /> {formatDate(selectedAssignment.shift.start)}
                  </p>
                  <p>
                    <Clock3 size={14} /> Ends: {formatDate(selectedAssignment.shift.end)}
                  </p>
                </div>
              </div>
            )}

            {selectedShift && (
              <div className="swap-field">
                <label htmlFor="colleague">
                  <Users size={16} /> Select eligible colleague
                </label>

                {loadingColleagues ? (
                  <div className="empty-state">Checking colleague eligibility...</div>
                ) : (
                  <>
                    <select
                      id="colleague"
                      value={selectedColleague}
                      onChange={(event) => setSelectedColleague(event.target.value)}
                      required
                      disabled={colleagues.length === 0}
                    >
                      <option value="">Choose a colleague</option>
                      {colleagues.map((colleague) => (
                        <option key={colleague._id} value={colleague._id}>
                          {colleague.name} — {colleague.clinicalRole} ({colleague.department})
                        </option>
                      ))}
                    </select>

                    {colleagues.length === 0 && (
                      <p className="field-hint">
                        No eligible colleagues were found for this shift.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {selectedColleague && (
              <div className="selected-shift-card">
                <div className="selected-shift-icon">
                  <Users size={22} />
                </div>
                <div>
                  <strong>
                    {colleagues.find((person) => person._id === selectedColleague)?.name}
                  </strong>
                  <p>
                    {colleagues.find((person) => person._id === selectedColleague)?.email}
                  </p>
                  <p>Eligibility checks passed.</p>
                </div>
              </div>
            )}

            <div className="swap-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate('/staff/requests')}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={!selectedShift || !selectedColleague || submitting || loadingColleagues}
              >
                <Send size={16} />
                {submitting ? 'Submitting...' : 'Send swap request'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
