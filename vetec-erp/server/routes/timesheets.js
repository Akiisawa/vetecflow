'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');

const router = express.Router();

router.get('/', requirePerm('timesheets', 'read'), (req, res) => {
  const where = ['ts.deleted_at IS NULL'];
  const params = {};
  if (req.query.project_id) { where.push('ts.project_id = @project_id'); params.project_id = req.query.project_id; }
  if (req.query.user_id) { where.push('ts.user_id = @user_id'); params.user_id = req.query.user_id; }
  if (req.query.status) { where.push('ts.status = @status'); params.status = req.query.status; }
  if (req.query.from) { where.push('ts.date >= @from'); params.from = req.query.from; }
  if (req.query.to) { where.push('ts.date <= @to'); params.to = req.query.to; }

  const rows = db.prepare(
    'SELECT ts.*, u.name AS user_name, p.name AS project_name FROM timesheets ts ' +
    'LEFT JOIN users u ON u.id = ts.user_id LEFT JOIN projects p ON p.id = ts.project_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY ts.date DESC'
  ).all(params);
  const total = rows.reduce((s, r) => s + r.hours, 0);
  res.json({ data: rows, total, page: 1, limit: rows.length, pages: 1 });
});

router.post('/', requirePerm('timesheets', 'write'), (req, res) => {
  const { project_id, task_id, date, hours, description } = req.body || {};
  if (!date || !hours) return res.status(400).json({ error: 'Informe data e horas' });
  const info = db.prepare(
    'INSERT INTO timesheets (user_id, project_id, task_id, date, hours, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, project_id || null, task_id || null, date, Number(hours), description || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/:id/approve', requirePerm('timesheets', 'write'), (req, res) => {
  if (['admin', 'gestor', 'engenharia'].indexOf(req.user.role) === -1) {
    return res.status(403).json({ error: 'Apenas gestores e engenharia podem aprovar horas' });
  }
  db.prepare("UPDATE timesheets SET status = 'aprovado', approved_by = ?, approved_at = datetime('now') WHERE id = ?")
    .run(req.user.id, req.params.id);
  logAudit(db, req, 'approve', 'timesheet', req.params.id, null);
  res.json({ ok: true });
});

router.delete('/:id', requirePerm('timesheets', 'write'), (req, res) => {
  const row = db.prepare('SELECT * FROM timesheets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Registro não encontrado' });
  if (row.user_id !== req.user.id && ['admin', 'gestor'].indexOf(req.user.role) === -1) {
    return res.status(403).json({ error: 'Você só pode excluir seus próprios lançamentos' });
  }
  db.prepare("UPDATE timesheets SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
