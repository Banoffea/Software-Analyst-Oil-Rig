import React from 'react';

export default function Table({ columns = [], data = [], rowKey = 'id' }) {
  return (
    <table className="custom-table">
      <thead>
        <tr>
          {columns.map(col => <th key={col.key}>{col.title}</th>)}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="no-data">ไม่มีข้อมูล</td>
          </tr>
        )}
        {data.map(row => (
          <tr key={row[rowKey]}>
            {columns.map(col => (
              <td key={col.key}>
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
