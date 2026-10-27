'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');
const { pick } = require('../lib/util');

const router = express.Router();

const STAGES = ['novo_lead', 'primeiro_contato', 'qualificacao', 'proposta_enviada', 'negociacao', 'ganho', 'perdido'];
const COLUMNS = ['client_id', 'lead_id', 'title', 'service', 'value', 'probability', 'stage', 'owner_id', 'source', 'expected_close', 'notes'];

router.get('/', requirePerm('crm', 'read'), (req, res) => {
  const where = ['o.deleted_at IS NULL'];
  const params = {};
  if (req.query.q) {
    where.push('(o.title LIKE @q OR o.service LIKE @q)');
    params.q = '%' + req.query.q + '%';
  }
  if (req.query.stage) { where.push('o.stage = @stage'); params.stage = req.query.stage; }
  if (req.query.owner_id) { where.push('o.owner_id = @owner_id'); params.owner_id = req.query.owner_id; }
  if (req.query.client_id) { where.push('o.client_id = @client_id'); params.client_id = req.query.client_id; }

  const rows = db.prepare(
    'SELECT o.*, c.name AS client_name, u.name AS owner_name FROM opportunities o ' +
    'LEFT JOIN clients c ON c.id = o.client_id LEFT JOIN users u ON u.id = o.owner_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY o.id DESC'
  ).all(params);
  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.get('/board', requirePerm('crm', 'read'), (req, res) => {
  const rows = db.prepare(
    'SELECT o.*, c.name AS client_name, u.name AS owner_name FROM opportunities o ' +
    'LEFT JOIN clients c ON c.id = o.client_id LEFT JOIN users u ON u.id = o.owner_id ' +
    'WHERE o.deleted_at IS NULL ORDER BY o.id DESC'
  ).all();
  const board = {};
  for (const s of STAGES) board[s] = [];
  for (const r of rows) {
    if (!board[r.stage]) board[r.stage] = [];
    board[r.stage].push(r);
  }
  res.json({ stages: STAGES, board });
});

router.post('/', requirePerm('crm', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!data.title) return res.status(400).json({ error: 'Informe o título da oportunidade' });
  const info = db.prepare(
    'INSERT INTO opportunities (' + Object.keys(data).join(', ') + ') VALUES (' +
    Object.keys(data).map((k) => '@' + k).join(', ') + ')'
  ).run(data);
  db.prepare('INSERT INTO opportunity_events (opportunity_id, from_stage, to_stage, user_id, note) VALUES (?, NULL, ?, ?, ?)')
    .run(info.lastInsertRowid, data.stage || 'novo_lead', req.user.id, 'Oportunidade criada');
  logAudit(db, req, 'create', 'opportunity', info.lastInsertRowid, { title: data.title });
  res.status(201).json(db.prepare('SELECT * FROM opportunities WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requirePerm('crm', 'write'), (req, res) => {
  const existing = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  const data = pick(req.body, COLUMNS);
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Nada para atualizar' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE opportunities SET ' + Object.keys(data).map((k) => k + ' = @' + k).join(', ') +
      ", updated_at = datetime('now') WHERE id = @id").run(Object.assign({}, data, { id: req.params.id }));
    if (data.stage && data.stage !== existing.stage) {
      db.prepare('INSERT INTO opportunity_events (opportunity_id, from_stage, to_stage, user_id, note) VALUES (?, ?, ?, ?, ?)')
        .run(req.params.id, existing.stage, data.stage, req.user.id, req.body.stage_note || null);
    }
  });
  tx();
  logAudit(db, req, 'update', 'opportunity', req.params.id, { fields: Object.keys(data) });
  res.json(db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id));
});

router.post('/:id/stage', requirePerm('crm', 'write'), (req, res) => {
  const { stage, note } = req.body || {};
  if (STAGES.indexOf(stage) === -1) return res.status(400).json({ error: 'Etapa inválida' });
  const existing = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  db.prepare("UPDATE opportunities SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(stage, req.params.id);
  db.prepare('INSERT INTO opportunity_events (opportunity_id, from_stage, to_stage, user_id, note) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, existing.stage, stage, req.user.id, note || null);
  logAudit(db, req, 'stage_change', 'opportunity', req.params.id, { from: existing.stage, to: stage });
  res.json({ ok: true });
});

router.get('/:id/events', requirePerm('crm', 'read'), (req, res) => {
  const rows = db.prepare(
    'SELECT e.*, u.name AS user_name FROM opportunity_events e LEFT JOIN users u ON u.id = e.user_id ' +
    'WHERE e.opportunity_id = ? ORDER BY e.id DESC'
  ).all(req.params.id);
  res.json({ data: rows });
});

router.delete('/:id', requirePerm('crm', 'write'), (req, res) => {
  db.prepare("UPDATE opportunities SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'opportunity', req.params.id, null);
  res.json({ ok: true });
});

module.exports = router;
