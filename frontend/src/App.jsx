import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Header from './components/Header';
import Login from './pages/Login';
import OilDashboard from './pages/OilDashboard';
import VesselDashboard from './pages/VesselDashboard';
import IssuesList from './pages/IssuesList';
import UsersAdminPage from './pages/UsersAdminPage';
import RigsAdminPage from './pages/RigsAdminPage';
import ProtectedRoute from './ProtectedRoute';

import { useAuth } from './utils/auth.jsx';

export default function App() {
  const { me, loading, login, logout } = useAuth();

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <>
      {me && <Header onLogout={logout} />}

      <div className="max-w-6xl mx-auto p-4">
        <Routes>
          {/* Login */}
          <Route
            path="/login"
            element={
              me ? (
                <Navigate to="/" replace />
              ) : (
                <Login
                  onLogin={async (username, password) => {
                    await login(username, password);
                  }}
                />
              )
            }
          />

          {/* Authenticated pages */}
          <Route path="/"        element={me ? <OilDashboard />    : <Navigate to="/login" replace />} />
          <Route path="/vessels" element={me ? <VesselDashboard /> : <Navigate to="/login" replace />} />
          <Route path="/issues"  element={me ? <IssuesList />      : <Navigate to="/login" replace />} />

          {/* Admin/Manager only */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allow={['admin','manager']}>
                <UsersAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/rigs"
            element={
              <ProtectedRoute allow={['admin','manager']}>
                <RigsAdminPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback → ส่งไปหน้า Login เสมอหากเส้นทางไม่ตรง */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </>
  );
}
