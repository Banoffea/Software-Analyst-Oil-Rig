import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Header from './components/Header';
import Login from './pages/Login';
import OilDashboard from './pages/OilDashboard';       // Product
import VesselDashboard from './pages/VesselDashboard'; // Vessels
import IssuesList from './pages/IssuesList';           // Reports
import UsersAdminPage from './pages/UsersAdminPage';
import RigsAdminPage from './pages/RigsAdminPage';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from './utils/auth.jsx';

function defaultHome(role) {
  if (role === 'admin') return '/admin/users';                 // User Management
  if (role === 'manager') return '/product';                   // Product
  if (role === 'production') return '/product';                // Product
  if (role === 'captain' || role === 'fleet') return '/vessels'; // Vessels
  return '/login';
}

export default function App() {
  const { me, loading, login, logout } = useAuth();

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <>
      {me && <Header onLogout={logout} />}

      <div className="max-w-6xl mx-auto p-4">
        <Routes>
          {/* LOGIN */}
          <Route
            path="/login"
            element={
              me
                ? <Navigate to={defaultHome(me.role)} replace />
                : (
                  <Login onLogin={async (username, password) => {
                    await login(username, password);
                  }} />
                )
            }
          />

          {/* ROOT → ส่งไป home ตาม role */}
          <Route
            path="/"
            element={
              me
                ? <Navigate to={defaultHome(me.role)} replace />
                : <Navigate to="/login" replace />
            }
          />

          {/* EXPLICIT PAGES WITH ROLE GUARD */}
          {/* Product */}
          <Route
            path="/product"
            element={
              <ProtectedRoute allow={['admin','manager','production']}>
                <OilDashboard />
              </ProtectedRoute>
            }
          />

          {/* Vessels */}
          <Route
            path="/vessels"
            element={
              <ProtectedRoute allow={['admin','manager','captain','fleet']}>
                <VesselDashboard />
              </ProtectedRoute>
            }
          />

          {/* Reports */}
          <Route
            path="/issues"
            element={
              <ProtectedRoute allow={['admin','manager','production','captain','fleet']}>
                <IssuesList />
              </ProtectedRoute>
            }
          />

          {/* Rigs */}
          <Route
            path="/admin/rigs"
            element={
              <ProtectedRoute allow={['admin','manager','production']}>
                <RigsAdminPage />
              </ProtectedRoute>
            }
          />

          {/* User Management (admin only) */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allow={['admin']}>
                <UsersAdminPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to={me ? defaultHome(me.role) : '/login'} replace />} />
        </Routes>
      </div>
    </>
  );
}
