'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');
const { pick, nextNumber } = require('../lib/util');

const router = express.Router();

const COLUMNS = ['code', 'name', 'client_id', 'contract_id', 'owner_id', 'location', 'start_date', 'due_date', 'expected_end', 'budget', 'contracted_revenue', 'progress', 'status', 'notes'];

router.get('/', requirePerm('projects', 'read'), (req, res) => {
  const where = ['p.deleted_at IS NULL'];
  const params = {};
  if (req.query.q) { where.push('(p.name LIKE @q OR p.code LIKE @q)'); params.q = '%' + req.query.q + '%'; }
  if (req.query.status) { where.push('p.status = @status'); params.status = req.query.status; }
  if (req.query.client_id) { where.push('p.client_id = @client_id'); params.client_id = req.query.client_id; }

  const rows = db.prepare(
    'SELECT p.*, c.name AS client_name, u.name AS owner_name FROM projects p ' +
    'LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.owner_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY p.id DESC'
  ).all(params);
  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.post('/', requirePerm('projects', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!data.name) return res.status(400).json({ error: 'Informe o nome do projeto' });
  if (!data.code) data.code = nextNumber(db, 'projects', 'code', 'PRJ-' + new Date().getFullYear() + '-', 3);
  data.owner_id = data.owner_id || req.user.id;
  const info = db.prepare(
    'INSERT INTO projects (' + Object.keys(data).join(', ') + ') VALUES (' +
    Object.keys(data).map((k) => '@' + k).join(', ') + ')'
  ).run(data);
  logAudit(db, req, 'create', 'project', info.lastInsertRowid, { code: data.code });
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requirePerm('projects', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Nada para atualizar' });
  db.prepare('UPDATE projects SET ' + Object.keys(data).map((k) => k + ' = @' + k).join(', ') +
    ", updated_at = datetime('now') WHERE id = @id").run(Object.assign({}, data, { id: req.params.id }));
  logAudit(db, req, 'update', 'project', req.params.id, { fields: Object.keys(data) });
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requirePerm('projects', 'write'), (req, res) => {
  db.prepare("UPDATE projects SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'project', req.params.id, null);
  res.json({ ok: true });
});

router.get('/:id/full', requirePerm('projects', 'read'), (req, res) => {
  const id = req.params.id;
  const project = db.prepare(
    'SELECT p.*, c.name AS client_name, u.name AS owner_name FROM projects p ' +
    'LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.owner_id WHERE p.id = ?'
  ).get(id);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

  const tasks = db.prepare(
    'SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id ' +
    'WHERE t.project_id = ? AND t.deleted_at IS NULL ORDER BY t.due_date'
  ).all(id);
  const members = db.prepare(
    'SELECT pm.*, u.name AS user_name, u.email FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?'
  ).all(id);
  const documents = db.prepare('SELECT * FROM documents WHERE project_id = ? AND deleted_at IS NULL').all(id);
  const incidents = db.prepare('SELECT * FROM incidents WHERE project_id = ? AND deleted_at IS NULL ORDER BY id DESC').all(id);
  const timesheets = db.prepare(
    'SELECT ts.*, u.name AS user_name FROM timesheets ts JOIN users u ON u.id = ts.user_id ' +
    'WHERE ts.project_id = ? AND ts.deleted_at IS NULL ORDER BY ts.date DESC'
  ).all(id);
  const diary = db.prepare(
    'SELECT d.*, u.name AS user_name FROM project_diary d LEFT JOIN users u ON u.id = d.user_id WHERE d.project_id = ? ORDER BY d.date DESC'
  ).all(id);
  const finance = db.prepare('SELECT * FROM finance_entries WHERE project_id = ? AND deleted_at IS NULL ORDER BY due_date').all(id);

  const revenue = finance.filter((f) => f.type === 'receber' && ['recebido', 'pago'].indexOf(f.status) !== -1)
    .reduce((s, f) => s + f.amount, 0);
  const revenueOpen = finance.filter((f) => f.type === 'receber' && ['recebido', 'pago', 'cancelado'].indexOf(f.status) === -1)
    .reduce((s, f) => s + f.amount, 0);
  const cost = finance.filter((f) => f.type === 'pagar' && ['pago'].indexOf(f.status) !== -1)
    .reduce((s, f) => s + f.amount, 0);
  const costOpen = finance.filter((f) => f.type === 'pagar' && ['pago', 'cancelado'].indexOf(f.status) === -1)
    .reduce((s, f) => s + f.amount, 0);

  const profitability = {
    contracted_revenue: project.contracted_revenue,
    budget: project.budget,
    revenue_realized: revenue,
    revenue_open: revenueOpen,
    cost_realized: cost,
    cost_open: costOpen,
    result_estimated: revenue - cost,
    margin_estimated: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 10000) / 100 : 0,
    budget_deviation: project.budget > 0 ? Math.round(((cost - project.budget) / project.budget) * 10000) / 100 : 0
  };

  res.json({ project, tasks, members, documents, incidents, timesheets, diary, finance, profitability });
});

router.post('/:id/members', requirePerm('projects', 'write'), (req, res) => {
  const { user_id, role } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'Informe o usuário' });
  try {
    db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(req.params.id, user_id, role || null);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id/members/:memberId', requirePerm('projects', 'write'), (req, res) => {
  db.prepare('DELETE FROM project_members WHERE id = ? AND project_id = ?').run(req.params.memberId, req.params.id);
  res.json({ ok: true });
});

router.post('/:id/diary', requirePerm('projects', 'write'), (req, res) => {
  const { date, activities, problems, notes } = req.body || {};
  if (!date) return res.status(400).json({ error: 'Informe a data' });
  const info = db.prepare(
    'INSERT INTO project_diary (project_id, date, user_id, activities, problems, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, date, req.user.id, activities || null, problems || null, notes || null);
  logAudit(db, req, 'create', 'project_diary', info.lastInsertRowid, { project_id: req.params.id });
  res.status(201).json({ id: info.lastInsertRowid });
});

module.exports = router;
