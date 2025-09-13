import React, { useEffect, useState } from 'react';
import { getVessels } from '../api/vessels';
import { createIssue } from '../api/issues';

export default function VesselDashboard({ user }) {
  const [vessels, setVessels] = useState([]);

  const fetch = async () => {
    const data = await getVessels();
    setVessels(data);
  };

  useEffect(()=>{ fetch(); }, []);

  const report = async (v) => {
    const title = `Vessel anomaly: ${v.vessel_no}`;
    const description = `Speed ${v.speed} at position ${v.lat},${v.lng}`;
    await createIssue({ issue_type: 'vessel', ref_id: v.id, title, description });
    alert('Issue created');
  };

  return (
    <div>
      <h3>Vessels</h3>
      <table>
        <thead><tr><th>No</th><th>Name</th><th>Speed</th><th>Oil Vol</th><th>Action</th></tr></thead>
        <tbody>
          {vessels.map(v => (
            <tr key={v.id}>
              <td>{v.vessel_no}</td>
              <td>{v.name}</td>
              <td>{v.speed}</td>
              <td>{v.oil_volume}</td>
              <td><button onClick={()=>report(v)}>Report</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
