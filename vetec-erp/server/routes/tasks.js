'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');
const { pick } = require('../lib/util');

const router = express.Router();

const COLUMNS = ['title', 'description', 'project_id', 'assignee_id', 'priority', 'status', 'start_date', 'due_date', 'progress'];

router.get('/', requirePerm('tasks', 'read'), (req, res) => {
  const where = ['t.deleted_at IS NULL'];
  const params = {};
  if (req.query.q) { where.push('t.title LIKE @q'); params.q = '%' + req.query.q + '%'; }
  if (req.query.project_id) { where.push('t.project_id = @project_id'); params.project_id = req.query.project_id; }
  if (req.query.status) { where.push('t.status = @status'); params.status = req.query.status; }
  if (req.query.assignee_id) { where.push('t.assignee_id = @assignee_id'); params.assignee_id = req.query.assignee_id; }

  const rows = db.prepare(
    'SELECT t.*, p.name AS project_name, u.name AS assignee_name FROM tasks t ' +
    'LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN users u ON u.id = t.assignee_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY t.due_date IS NULL, t.due_date ASC'
  ).all(params);
  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.post('/', requirePerm('tasks', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!data.title) return res.status(400).json({ error: 'Informe o título da tarefa' });
  data.created_by = req.user.id;
  const info = db.prepare(
    'INSERT INTO tasks (' + Object.keys(data).join(', ') + ') VALUES (' +
    Object.keys(data).map((k) => '@' + k).join(', ') + ')'
  ).run(data);
  logAudit(db, req, 'create', 'task', info.lastInsertRowid, { title: data.title });
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requirePerm('tasks', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Nada para atualizar' });
  db.prepare('UPDATE tasks SET ' + Object.keys(data).map((k) => k + ' = @' + k).join(', ') +
    ", updated_at = datetime('now') WHERE id = @id").run(Object.assign({}, data, { id: req.params.id }));
  logAudit(db, req, 'update', 'task', req.params.id, { fields: Object.keys(data) });
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requirePerm('tasks', 'write'), (req, res) => {
  db.prepare("UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'task', req.params.id, null);
  res.json({ ok: true });
});

router.get('/:id/comments', requirePerm('tasks', 'read'), (req, res) => {
  const rows = db.prepare(
    'SELECT c.*, u.name AS user_name FROM task_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.task_id = ? ORDER BY c.id DESC'
  ).all(req.params.id);
  res.json({ data: rows });
});

router.post('/:id/comments', requirePerm('tasks', 'write'), (req, res) => {
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'Comentário vazio' });
  const info = db.prepare('INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)')
    .run(req.params.id, req.user.id, body);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/:id/dependencies', requirePerm('tasks', 'write'), (req, res) => {
  const { depends_on_id } = req.body || {};
  if (!depends_on_id) return res.status(400).json({ error: 'Informe a tarefa predecessora' });
  if (String(depends_on_id) === String(req.params.id)) return res.status(400).json({ error: 'Uma tarefa não pode depender de si mesma' });
  db.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)')
    .run(req.params.id, depends_on_id);
  res.status(201).json({ ok: true });
});

module.exports = router;
