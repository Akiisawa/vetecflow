'use strict';
const express = require('express');
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');
const { requirePerm } = require('../lib/perm');

const COLUMNS = [
  'type', 'name', 'trade_name', 'doc', 'phone', 'whatsapp', 'email', 'website',
  'zip', 'address', 'city', 'state', 'segment', 'owner_id', 'notes', 'status'
];

const router = createCrudRouter(db, {
  table: 'clients',
  columns: COLUMNS,
  searchColumns: ['name', 'trade_name', 'doc', 'email', 'city'],
  filterColumns: ['status', 'type', 'state', 'owner_id'],
  readPerm: ['clients', 'read'],
  writePerm: ['clients', 'write'],
  entity: 'client',
  required: ['name']
});

// Visão 360 do cliente
router.get('/:id/full', requirePerm('clients', 'read'), (req, res) => {
  const id = req.params.id;
  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  const contacts = db.prepare('SELECT * FROM contacts WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const leads = db.prepare('SELECT * FROM leads WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const opportunities = db.prepare('SELECT * FROM opportunities WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const proposals = db.prepare('SELECT * FROM proposals WHERE client_id = ? AND deleted_at IS NULL ORDER BY id DESC').all(id);
  const contracts = db.prepare('SELECT * FROM contracts WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const projects = db.prepare('SELECT * FROM projects WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const documents = db.prepare('SELECT * FROM documents WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const finance = db.prepare('SELECT * FROM finance_entries WHERE client_id = ? AND deleted_at IS NULL ORDER BY due_date DESC LIMIT 50').all(id);
  const audit = db.prepare(
    "SELECT * FROM audit_log WHERE entity IN ('client','proposal','contract','project') AND entity_id = ? ORDER BY id DESC LIMIT 30"
  ).all(String(id));

  const totals = db.prepare(
    "SELECT type, SUM(amount) AS total FROM finance_entries WHERE client_id = ? AND deleted_at IS NULL AND status NOT IN ('cancelado') GROUP BY type"
  ).all(id);

  res.json({ client, contacts, leads, opportunities, proposals, contracts, projects, documents, finance, audit, totals });
});

module.exports = router;
