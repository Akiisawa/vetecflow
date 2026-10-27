'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');

const router = express.Router();

router.get('/summary', requirePerm('dashboard', 'read'), (req, res) => {
  const from = req.query.from || null;
  const to = req.query.to || null;

  const finFilter = (extra) => {
    const where = ["deleted_at IS NULL", "status <> 'cancelado'"];
    const params = {};
    if (from) { where.push('COALESCE(due_date, competence_date, created_at) >= @from'); params.from = from; }
    if (to) { where.push('COALESCE(due_date, competence_date, created_at) <= @to'); params.to = to; }
    if (extra) where.push(extra);
    return { sql: where.join(' AND '), params };
  };

  const sum = (type, statuses) => {
    const placeholders = statuses.map((s) => "'" + s + "'").join(',');
    const f = finFilter("type = '" + type + "' AND status IN (" + placeholders + ')');
    const row = db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM finance_entries WHERE ' + f.sql).get(f.params);
    return row.total;
  };

  const revenueReceived = sum('receber', ['recebido']);
  const revenueExpected = sum('receber', ['previsto', 'em_aberto', 'vencido']);
  const expensesPaid = sum('pagar', ['pago']);
  const expensesExpected = sum('pagar', ['previsto', 'em_aberto', 'vencido']);

  const activeProjects = db.prepare("SELECT COUNT(*) AS c FROM projects WHERE deleted_at IS NULL AND status IN ('planejamento','em_andamento')").get().c;
  const lateProjects = db.prepare("SELECT COUNT(*) AS c FROM projects WHERE deleted_at IS NULL AND status <> 'concluido' AND status <> 'cancelado' AND due_date IS NOT NULL AND due_date < date('now')").get().c;
  const activeClients = db.prepare("SELECT COUNT(*) AS c FROM clients WHERE deleted_at IS NULL AND status = 'ativo'").get().c;
  const openProposals = db.prepare("SELECT COUNT(*) AS c FROM proposals WHERE deleted_at IS NULL AND status IN ('rascunho','enviada','em_negociacao')").get().c;
  const won = db.prepare("SELECT COUNT(*) AS c FROM opportunities WHERE deleted_at IS NULL AND stage = 'ganho'").get().c;
  const lost = db.prepare("SELECT COUNT(*) AS c FROM opportunities WHERE deleted_at IS NULL AND stage = 'perdido'").get().c;
  const pendingTasks = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE deleted_at IS NULL AND status <> 'concluida'").get().c;

  const monthly = db.prepare(
    "SELECT substr(COALESCE(due_date, competence_date, created_at),1,7) AS month, " +
    "SUM(CASE WHEN type='receber' THEN amount ELSE 0 END) AS revenue, " +
    "SUM(CASE WHEN type='pagar' THEN amount ELSE 0 END) AS expense " +
    "FROM finance_entries WHERE deleted_at IS NULL AND status <> 'cancelado' " +
    'GROUP BY month ORDER BY month DESC LIMIT 12'
  ).all().reverse();

  const projectsByStatus = db.prepare(
    'SELECT status, COUNT(*) AS count FROM projects WHERE deleted_at IS NULL GROUP BY status'
  ).all();

  const proposalsByStage = db.prepare(
    'SELECT status, COUNT(*) AS count FROM proposals WHERE deleted_at IS NULL GROUP BY status'
  ).all();

  const revenueByClient = db.prepare(
    "SELECT c.name AS client, COALESCE(SUM(f.amount),0) AS total FROM finance_entries f " +
    "JOIN clients c ON c.id = f.client_id WHERE f.deleted_at IS NULL AND f.type = 'receber' " +
    "GROUP BY c.id ORDER BY total DESC LIMIT 8"
  ).all();

  const costsByProject = db.prepare(
    "SELECT p.name AS project, COALESCE(SUM(f.amount),0) AS total FROM finance_entries f " +
    "JOIN projects p ON p.id = f.project_id WHERE f.deleted_at IS NULL AND f.type = 'pagar' " +
    'GROUP BY p.id ORDER BY total DESC LIMIT 8'
  ).all();

  const alerts = {
    overdueAccounts: db.prepare("SELECT id, description, amount, due_date FROM finance_entries WHERE deleted_at IS NULL AND status = 'vencido' ORDER BY due_date LIMIT 10").all(),
    lateProjects: db.prepare("SELECT id, code, name, due_date FROM projects WHERE deleted_at IS NULL AND status <> 'concluido' AND status <> 'cancelado' AND due_date IS NOT NULL AND due_date < date('now') LIMIT 10").all(),
    overdueTasks: db.prepare("SELECT id, title, due_date FROM tasks WHERE deleted_at IS NULL AND status <> 'concluida' AND due_date IS NOT NULL AND due_date < date('now') LIMIT 10").all(),
    expiringProposals: db.prepare("SELECT id, number, valid_until FROM proposals WHERE deleted_at IS NULL AND status IN ('enviada','em_negociacao') AND valid_until BETWEEN date('now') AND date('now','+7 day') LIMIT 10").all(),
    expiringContracts: db.prepare("SELECT id, number, end_date FROM contracts WHERE deleted_at IS NULL AND status = 'ativo' AND end_date BETWEEN date('now') AND date('now','+30 day') LIMIT 10").all(),
    overBudgetProjects: db.prepare(
      "SELECT p.id, p.name, p.budget, COALESCE(SUM(CASE WHEN f.type='pagar' THEN f.amount ELSE 0 END),0) AS cost " +
      "FROM projects p LEFT JOIN finance_entries f ON f.project_id = p.id AND f.deleted_at IS NULL " +
      'WHERE p.deleted_at IS NULL AND p.budget > 0 GROUP BY p.id HAVING cost > p.budget LIMIT 10'
    ).all()
  };

  res.json({
    period: { from, to },
    kpis: {
      revenueReceived, revenueExpected, expensesPaid, expensesExpected,
      balance: revenueReceived - expensesPaid,
      activeProjects, lateProjects, activeClients, openProposals, pendingTasks,
      conversionRate: (won + lost) > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : 0
    },
    charts: { monthly, projectsByStatus, proposalsByStage, revenueByClient, costsByProject },
    alerts
  });
});

module.exports = router;
