'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');

const router = express.Router();

function syncNotifications() {
  const push = (key, title, body, kind, entity, entityId) => {
    db.prepare(
      'INSERT OR IGNORE INTO notifications (title, body, kind, entity, entity_id, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, body, kind, entity, String(entityId), key);
  };

  const overdueTasks = db.prepare(
    "SELECT id, title, due_date FROM tasks WHERE deleted_at IS NULL AND status <> 'concluida' " +
    "AND due_date IS NOT NULL AND due_date < date('now') LIMIT 50"
  ).all();
  for (const t of overdueTasks) {
    push('task-overdue-' + t.id, 'Tarefa atrasada', t.title + ' (prazo ' + t.due_date + ')', 'warning', 'task', t.id);
  }

  const overdueFinance = db.prepare(
    "SELECT id, description, due_date, amount FROM finance_entries WHERE deleted_at IS NULL " +
    "AND status IN ('vencido','em_aberto') AND due_date IS NOT NULL AND due_date < date('now') LIMIT 50"
  ).all();
  for (const f of overdueFinance) {
    push('fin-overdue-' + f.id, 'Conta vencida', f.description + ' — R$ ' + Number(f.amount).toFixed(2), 'danger', 'finance_entry', f.id);
  }

  const expiringProposals = db.prepare(
    "SELECT id, number, valid_until FROM proposals WHERE deleted_at IS NULL AND status IN ('enviada','em_negociacao') " +
    "AND valid_until IS NOT NULL AND valid_until BETWEEN date('now') AND date('now', '+7 day') LIMIT 50"
  ).all();
  for (const p of expiringProposals) {
    push('prop-exp-' + p.id, 'Proposta próxima do vencimento', p.number + ' vence em ' + p.valid_until, 'warning', 'proposal', p.id);
  }

  const expiringContracts = db.prepare(
    "SELECT id, number, end_date FROM contracts WHERE deleted_at IS NULL AND status = 'ativo' " +
    "AND end_date IS NOT NULL AND end_date BETWEEN date('now') AND date('now', '+30 day') LIMIT 50"
  ).all();
  for (const c of expiringContracts) {
    push('ct-exp-' + c.id, 'Contrato próximo do término', c.number + ' termina em ' + c.end_date, 'warning', 'contract', c.id);
  }

  const openIncidents = db.prepare("SELECT id, description FROM incidents WHERE deleted_at IS NULL AND status = 'aberta' LIMIT 50").all();
  for (const i of openIncidents) {
    push('inc-open-' + i.id, 'Ocorrência em aberto', (i.description || '').slice(0, 90), 'danger', 'incident', i.id);
  }
}

router.get('/', requirePerm('notifications', 'read'), (req, res) => {
  syncNotifications();
  const rows = db.prepare(
    'SELECT * FROM notifications WHERE read_at IS NULL ORDER BY id DESC LIMIT 100'
  ).all();
  res.json({ data: rows, unread: rows.length });
});

router.post('/:id/read', requirePerm('notifications', 'read'), (req, res) => {
  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.post('/read-all', requirePerm('notifications', 'read'), (req, res) => {
  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE read_at IS NULL").run();
  res.json({ ok: true });
});

module.exports = router;
