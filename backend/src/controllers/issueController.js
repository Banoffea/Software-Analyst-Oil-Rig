// src/controllers/issueController.js
const pool = require('../db');

const list = async (req, res) => {
  try {
    // support filter by type/status via query
    const { type, status } = req.query;
    let sql = 'SELECT i.*, u.display_name AS created_by_name, a.display_name AS assignee_name FROM issues i LEFT JOIN users u ON i.created_by = u.id LEFT JOIN users a ON i.assignee = a.id';
    const where = [], vals = [];
    if (type) { where.push('i.issue_type = ?'); vals.push(type); }
    if (status) { where.push('i.status = ?'); vals.push(status); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY i.created_at DESC';
    const [rows] = await pool.query(sql, vals);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const create = async (req, res) => {
  try {
    const { issue_type, ref_id, title, description, assignee } = req.body;
    const created_by = req.user.id;
    const [r] = await pool.query('INSERT INTO issues (issue_type, ref_id, title, description, status, created_by, assignee) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [issue_type, ref_id || null, title, description || null, 'open', created_by, assignee || null]);
    res.json({ id: r.insertId });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const updateStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    await pool.query('UPDATE issues SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'status updated' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

module.exports = { list, create, updateStatus };
