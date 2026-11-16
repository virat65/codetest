
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity, ClipboardList, LayoutDashboard,
  LogOut, Repeat2, ShieldCheck, PlusCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const links = isAdmin
    ? [
        { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/admin/requests', label: 'Swap Requests', icon: ClipboardList }
      ]
    : [
        { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/staff/create-request', label: 'Create Swap Request', icon: PlusCircle },
        { to: '/staff/requests', label: 'My Requests', icon: Repeat2 }
      ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Activity size={23} /></div>
          <div><strong>SwapDesk</strong><small>Hospital Workforce</small></div>
        </div>

        <div className="nav-caption">WORKSPACE</div>

        <nav className="side-nav">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="user-meta">
              <strong>{user?.name || 'User'}</strong>
              <small>{user?.role || 'Staff'}</small>
            </div>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <span>{isAdmin ? 'Administration' : 'Staff workspace'}</span>
          </div>

          <div className="topbar-user">
            <span className="status-dot" />
            {user?.name}
            {isAdmin && <ShieldCheck size={17} />}
          </div>
        </header>

        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
