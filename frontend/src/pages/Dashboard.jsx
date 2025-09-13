import React, { useState } from 'react';
import OilDashboard from './OilDashboard';
import VesselDashboard from './VesselDashboard';
import Header from '../components/Header';
import IssuesList from './IssuesList';

export default function Dashboard({ user, setUser }) {
  const [tab, setTab] = useState('oil');

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <div>
      <Header user={user} onLogout={logout} />
      <div className="tabs">
        <button onClick={()=>setTab('oil')}>Oil</button>
        <button onClick={()=>setTab('vessels')}>Vessels</button>
        <button onClick={()=>setTab('issues')}>Issues</button>
      </div>
      <div className="tab-content">
        {tab === 'oil' && <OilDashboard user={user} />}
        {tab === 'vessels' && <VesselDashboard user={user} />}
        {tab === 'issues' && <IssuesList user={user} />}
      </div>
    </div>
  );
}
