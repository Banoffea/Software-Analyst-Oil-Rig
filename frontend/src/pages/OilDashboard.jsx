import React, { useEffect, useState } from 'react';
import { getDaily } from '../api/oil';
import { createIssue } from '../api/issues';
import dayjs from 'dayjs';

export default function OilDashboard({ user }) {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [items,setItems] = useState([]);
  const [loading,setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getDaily(date);
      setItems(res.items);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(()=>{ fetch(); }, [date]);

  const reportIssue = async (component) => {
    const title = `Anomaly: ${component.component_name}`;
    const description = `Value ${component.value} ${component.unit} on ${component.record_date}`;
    await createIssue({ issue_type: 'oil', ref_id: component.id, title, description });
    alert('Issue created');
  };

  return (
    <div>
      <h3>Oil Components - {date}</h3>
      <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
      {loading ? <div>Loading...</div> : (
        <table>
          <thead><tr><th>Component</th><th>Value</th><th>Unit</th><th>Action</th></tr></thead>
          <tbody>
            {items.map(it=>(
              <tr key={it.id}>
                <td>{it.component_name}</td>
                <td>{it.value}</td>
                <td>{it.unit}</td>
                <td><button onClick={()=>reportIssue(it)}>Report</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
