'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');
const { nextNumber, pick } = require('../lib/util');

const router = express.Router();

const COLUMNS = ['number', 'client_id', 'proposal_id', 'project_id', 'value', 'start_date', 'end_date', 'payment_terms', 'owner_id', 'status', 'document_id', 'notes'];

router.get('/', requirePerm('contracts', 'read'), (req, res) => {
  const where = ['ct.deleted_at IS NULL'];
  const params = {};
  if (req.query.q) { where.push('(ct.number LIKE @q OR c.name LIKE @q)'); params.q = '%' + req.query.q + '%'; }
  if (req.query.status) { where.push('ct.status = @status'); params.status = req.query.status; }
  if (req.query.client_id) { where.push('ct.client_id = @client_id'); params.client_id = req.query.client_id; }

  const rows = db.prepare(
    'SELECT ct.*, c.name AS client_name, p.name AS project_name FROM contracts ct ' +
    'LEFT JOIN clients c ON c.id = ct.client_id LEFT JOIN projects p ON p.id = ct.project_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY ct.id DESC'
  ).all(params);
  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.post('/', requirePerm('contracts', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!data.client_id) return res.status(400).json({ error: 'Selecione o cliente' });
  if (!data.number) data.number = nextNumber(db, 'contracts', 'number', 'CT-' + new Date().getFullYear() + '-', 4);
  data.owner_id = data.owner_id || req.user.id;

  const info = db.prepare(
    'INSERT INTO contracts (' + Object.keys(data).join(', ') + ') VALUES (' +
    Object.keys(data).map((k) => '@' + k).join(', ') + ')'
  ).run(data);

  if (data.project_id) {
    db.prepare('UPDATE projects SET contract_id = ? WHERE id = ?').run(info.lastInsertRowid, data.project_id);
  }
  logAudit(db, req, 'create', 'contract', info.lastInsertRowid, { number: data.number });
  res.status(201).json(db.prepare('SELECT * FROM contracts WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requirePerm('contracts', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Nada para atualizar' });
  db.prepare('UPDATE contracts SET ' + Object.keys(data).map((k) => k + ' = @' + k).join(', ') +
    ", updated_at = datetime('now') WHERE id = @id").run(Object.assign({}, data, { id: req.params.id }));
  logAudit(db, req, 'update', 'contract', req.params.id, { fields: Object.keys(data) });
  res.json(db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id));
});

router.post('/:id/generate-receivable', requirePerm('finance', 'write'), (req, res) => {
  const ct = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!ct) return res.status(404).json({ error: 'Contrato não encontrado' });
  if (req.body.confirm !== true) return res.status(400).json({ error: 'Confirmação explícita necessária' });
  const sourceKey = 'contract:' + ct.id;
  if (db.prepare('SELECT id FROM finance_entries WHERE source_key = ?').get(sourceKey)) {
    return res.status(409).json({ error: 'Já existe lançamento para este contrato' });
  }
  const info = db.prepare(
    'INSERT INTO finance_entries (description, type, amount, client_id, project_id, contract_id, competence_date, due_date, status, source_key, created_by) ' +
    "VALUES (?, 'receber', ?, ?, ?, ?, ?, ?, 'em_aberto', ?, ?)"
  ).run('Contrato ' + ct.number, ct.value, ct.client_id, ct.project_id, ct.id,
    ct.start_date || null, ct.end_date || null, sourceKey, req.user.id);
  logAudit(db, req, 'finance_generated', 'contract', ct.id, { entry: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/:id', requirePerm('contracts', 'write'), (req, res) => {
  db.prepare("UPDATE contracts SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'contract', req.params.id, null);
  res.json({ ok: true });
});

module.exports = router;
