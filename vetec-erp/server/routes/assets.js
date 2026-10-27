'use strict';
const express = require('express');
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');
const { requirePerm } = require('../lib/perm');

const router = createCrudRouter(db, {
  table: 'assets',
  columns: ['code', 'patrimony', 'name', 'category', 'state', 'location', 'responsible_id', 'project_id', 'acquisition_value', 'notes'],
  searchColumns: ['code', 'patrimony', 'name', 'location'],
  filterColumns: ['state', 'category', 'project_id'],
  readPerm: ['assets', 'read'],
  writePerm: ['assets', 'write'],
  entity: 'asset',
  required: ['name', 'code']
});

router.get('/:id/maintenance', requirePerm('assets', 'read'), (req, res) => {
  res.json({ data: db.prepare('SELECT * FROM asset_maintenance WHERE asset_id = ? ORDER BY date DESC').all(req.params.id) });
});

router.post('/:id/maintenance', requirePerm('assets', 'write'), (req, res) => {
  const { date, type, description, cost, status } = req.body || {};
  if (!date) return res.status(400).json({ error: 'Informe a data' });
  const info = db.prepare(
    'INSERT INTO asset_maintenance (asset_id, date, type, description, cost, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, date, type || null, description || null, Number(cost) || 0, status || 'aberta');
  if (status === 'concluida') {
    db.prepare("UPDATE assets SET state = 'disponivel' WHERE id = ?").run(req.params.id);
  } else {
    db.prepare("UPDATE assets SET state = 'manutencao' WHERE id = ?").run(req.params.id);
  }
  res.status(201).json({ id: info.lastInsertRowid });
});

module.exports = router;
