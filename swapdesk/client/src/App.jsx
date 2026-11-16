
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import StaffDashboard from './pages/staff/StaffDashboard';
import StaffRequests from './pages/staff/StaffRequests';
import CreateSwapRequest from './pages/staff/CreateSwapRequest';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRequests from './pages/admin/AdminRequests';
import './index.css';

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loader">Loading SwapDesk...</div>;

  return (
    <Navigate
      to={user ? (user.role === 'admin' ? '/admin' : '/staff') : '/login'}
      replace
    />
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute allowedRoles={['staff']} />}>
        <Route element={<AppLayout />}>
          <Route path="/staff" element={<StaffDashboard />} />
          <Route path="/staff/requests" element={<StaffRequests />} />
          <Route path="/staff/create-request" element={<CreateSwapRequest />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/requests" element={<AdminRequests />} />
        </Route>
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
