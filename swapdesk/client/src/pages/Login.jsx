import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/staff'} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedInUser = await login(email.trim(), password);
      navigate(loggedInUser?.role === 'admin' ? '/admin' : '/staff');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-decoration decoration-one" />
      <div className="login-decoration decoration-two" />
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon large"><Activity size={27} /></div>
          <div><strong>SwapDesk</strong><span>Hospital Workforce Management</span></div>
        </div>

        <div className="login-heading">
          <p className="eyebrow">WELCOME BACK</p>
          <h1>Sign in to your workspace</h1>
          <p>Manage shifts and coordinate your team with ease.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>Email address</label>
          <div className="input-wrap">
            <Mail size={18} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.com" required />
          </div>

          <label>Password</label>
          <div className="input-wrap">
            <LockKeyhole size={18} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>

          {error && <div className="error-message">{error}</div>}
          <button className="primary-button login-submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="login-footer">Secure access for authorised hospital staff</div>
      </div>
    </div>
  );
}
