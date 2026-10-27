'use strict';
const express = require('express');
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');

const router = createCrudRouter(db, {
  table: 'incidents',
  columns: ['project_id', 'date', 'type', 'severity', 'responsible_id', 'description', 'resolution', 'resolved_by', 'status'],
  searchColumns: ['description', 'type'],
  filterColumns: ['status', 'severity', 'project_id'],
  dateColumn: 'date',
  readPerm: ['incidents', 'read'],
  writePerm: ['incidents', 'write'],
  entity: 'incident',
  required: ['description', 'date']
});

router.get('/:id/events', requirePerm('incidents', 'read'), (req, res) => {
  res.json({
    data: db.prepare(
      'SELECT e.*, u.name AS user_name FROM incident_events e LEFT JOIN users u ON u.id = e.user_id ' +
      'WHERE e.incident_id = ? ORDER BY e.id DESC'
    ).all(req.params.id)
  });
});

router.post('/:id/resolve', requirePerm('incidents', 'write'), (req, res) => {
  const { resolution } = req.body || {};
  db.prepare("UPDATE incidents SET status = 'resolvida', resolution = ?, resolved_by = ?, updated_at = datetime('now') WHERE id = ?")
    .run(resolution || null, req.user.id, req.params.id);
  db.prepare('INSERT INTO incident_events (incident_id, user_id, note, status) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.user.id, resolution || 'Ocorrência resolvida', 'resolvida');
  logAudit(db, req, 'resolve', 'incident', req.params.id, null);
  res.json({ ok: true });
});

module.exports = router;
