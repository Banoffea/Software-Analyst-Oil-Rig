import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import OilDashboard from "./pages/OilDashboard.jsx";
import VesselsList from "./pages/VesselsList.jsx";
import IssuesList from "./pages/IssuesList.jsx";
import "./App.css";

export default function App() {
  return (
    <div>
      <header className="topbar">
        <div className="container bar">
          <NavLink to="/" className="brand">Oil Ops</NavLink>
          <nav className="nav">
            <NavLink to="/dashboard" className={({isActive}) => isActive ? "active" : ""}>Dashboard</NavLink>
            <NavLink to="/vessels"   className={({isActive}) => isActive ? "active" : ""}>Vessels</NavLink>
            <NavLink to="/issues"    className={({isActive}) => isActive ? "active" : ""}>Issues</NavLink>
          </nav>
        </div>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<OilDashboard />} />
          <Route path="/vessels"   element={<VesselsList />} />
          <Route path="/issues"    element={<IssuesList />} />
          <Route path="*"          element={<div>Not found</div>} />
        </Routes>
      </main>
    </div>
  );
}
