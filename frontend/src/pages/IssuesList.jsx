import React, { useEffect, useState } from 'react';
import { listIssues, updateIssueStatus } from '../api/issues';

export default function IssuesList({ user }) {
  const [issues,setIssues] = useState([]);

  const fetch = async () => {
    const data = await listIssues();
    setIssues(data);
  };

  useEffect(()=>{ fetch(); }, []);

  const changeStatus = async (id, status) => {
    await updateIssueStatus(id, status);
    fetch();
  };

  return (
    <div>
      <h3>Issues</h3>
      <table>
        <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Created By</th><th>Assignee</th><th>Action</th></tr></thead>
        <tbody>
          {issues.map(i=>(
            <tr key={i.id}>
              <td>{i.title}</td>
              <td>{i.issue_type}</td>
              <td>{i.status}</td>
              <td>{i.created_by_name}</td>
              <td>{i.assignee_name}</td>
              <td>
                {user.role !== 'manager' && <button onClick={()=>changeStatus(i.id, 'in_progress')}>Take</button>}
                <button onClick={()=>changeStatus(i.id, 'resolved')}>Resolve</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
