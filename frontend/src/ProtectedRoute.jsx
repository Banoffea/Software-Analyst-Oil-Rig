// frontend/src/routes/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './utils/auth.jsx';


export default function ProtectedRoute({ allow = [], children }) {
  const { me, loading } = useAuth();
  if (loading) return null; // หรือ skeleton
  if (!me) return <Navigate to="/login" replace />;
  if (allow.length && !allow.includes(me.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
