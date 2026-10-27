'use strict';
const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');
const { pick, toCsv, today } = require('../lib/util');

const router = express.Router();

const COLUMNS = [
  'description', 'type', 'amount', 'category_id', 'client_id', 'supplier_id', 'project_id',
  'contract_id', 'proposal_id', 'competence_date', 'due_date', 'paid_date', 'status',
  'payment_method_id', 'notes'
];

const STATUSES = ['previsto', 'em_aberto', 'vencido', 'pago', 'recebido', 'cancelado'];

function refreshOverdue() {
  db.prepare(
    "UPDATE finance_entries SET status = 'vencido' WHERE deleted_at IS NULL " +
    "AND status IN ('previsto','em_aberto') AND due_date IS NOT NULL AND due_date < date('now')"
  ).run();
}

router.get('/', requirePerm('finance', 'read'), (req, res) => {
  refreshOverdue();
  const where = ['f.deleted_at IS NULL'];
  const params = {};
  if (req.query.type) { where.push('f.type = @type'); params.type = req.query.type; }
  if (req.query.status) { where.push('f.status = @status'); params.status = req.query.status; }
  if (req.query.project_id) { where.push('f.project_id = @project_id'); params.project_id = req.query.project_id; }
  if (req.query.client_id) { where.push('f.client_id = @client_id'); params.client_id = req.query.client_id; }
  if (req.query.supplier_id) { where.push('f.supplier_id = @supplier_id'); params.supplier_id = req.query.supplier_id; }
  if (req.query.from) { where.push('f.due_date >= @from'); params.from = req.query.from; }
  if (req.query.to) { where.push('f.due_date <= @to'); params.to = req.query.to; }
  if (req.query.q) { where.push('f.description LIKE @q'); params.q = '%' + req.query.q + '%'; }

  const rows = db.prepare(
    'SELECT f.*, fc.name AS category_name, c.name AS client_name, s.name AS supplier_name, ' +
    'p.name AS project_name, pm.name AS payment_method_name FROM finance_entries f ' +
    'LEFT JOIN finance_categories fc ON fc.id = f.category_id ' +
    'LEFT JOIN clients c ON c.id = f.client_id ' +
    'LEFT JOIN suppliers s ON s.id = f.supplier_id ' +
    'LEFT JOIN projects p ON p.id = f.project_id ' +
    'LEFT JOIN payment_methods pm ON pm.id = f.payment_method_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY f.due_date IS NULL, f.due_date ASC'
  ).all(params);

  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.get('/categories', requirePerm('finance', 'read'), (req, res) => {
  res.json({ data: db.prepare('SELECT * FROM finance_categories WHERE deleted_at IS NULL').all() });
});
router.get('/payment-methods', requirePerm('finance', 'read'), (req, res) => {
  res.json({ data: db.prepare('SELECT * FROM payment_methods WHERE deleted_at IS NULL').all() });
});

router.post('/categories', requirePerm('finance', 'write'), (req, res) => {
  const { name, kind } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Informe o nome' });
  const info = db.prepare('INSERT INTO finance_categories (name, kind) VALUES (?, ?)').run(name, kind || 'ambos');
  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/payment-methods', requirePerm('finance', 'write'), (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Informe o nome' });
  const info = db.prepare('INSERT INTO payment_methods (name) VALUES (?)').run(name);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/', requirePerm('finance', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!data.description || !data.type || data.amount === undefined) {
    return res.status(400).json({ error: 'Informe descrição, tipo e valor' });
  }
  if (['receber', 'pagar'].indexOf(data.type) === -1) return res.status(400).json({ error: 'Tipo inválido' });
  data.amount = Number(data.amount);
  data.created_by = req.user.id;

  const tx = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO finance_entries (' + Object.keys(data).join(', ') + ') VALUES (' +
      Object.keys(data).map((k) => '@' + k).join(', ') + ')'
    ).run(data);
    return info.lastInsertRowid;
  });
  const id = tx();
  logAudit(db, req, 'create', 'finance_entry', id, { amount: data.amount, type: data.type });
  res.status(201).json(db.prepare('SELECT * FROM finance_entries WHERE id = ?').get(id));
});

router.put('/:id', requirePerm('finance', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Nada para atualizar' });
  if (data.amount !== undefined) data.amount = Number(data.amount);
  db.prepare('UPDATE finance_entries SET ' + Object.keys(data).map((k) => k + ' = @' + k).join(', ') +
    ", updated_at = datetime('now') WHERE id = @id").run(Object.assign({}, data, { id: req.params.id }));
  logAudit(db, req, 'update', 'finance_entry', req.params.id, { fields: Object.keys(data) });
  res.json(db.prepare('SELECT * FROM finance_entries WHERE id = ?').get(req.params.id));
});

router.post('/:id/settle', requirePerm('finance', 'write'), (req, res) => {
  const entry = db.prepare('SELECT * FROM finance_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Lançamento não encontrado' });
  const paidDate = req.body.paid_date || today();
  const status = entry.type === 'receber' ? 'recebido' : 'pago';
  db.prepare("UPDATE finance_entries SET status = ?, paid_date = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, paidDate, req.params.id);
  logAudit(db, req, 'settle', 'finance_entry', req.params.id, { status });
  res.json({ ok: true });
});

router.delete('/:id', requirePerm('finance', 'write'), (req, res) => {
  db.prepare("UPDATE finance_entries SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'finance_entry', req.params.id, null);
  res.json({ ok: true });
});

router.get('/cashflow', requirePerm('finance', 'read'), (req, res) => {
  refreshOverdue();
  const rows = db.prepare(
    "SELECT substr(COALESCE(due_date, competence_date, created_at), 1, 7) AS month, " +
    "SUM(CASE WHEN type = 'receber' AND status IN ('recebido') THEN amount ELSE 0 END) AS received, " +
    "SUM(CASE WHEN type = 'receber' AND status NOT IN ('recebido','cancelado') THEN amount ELSE 0 END) AS receivable, " +
    "SUM(CASE WHEN type = 'pagar' AND status IN ('pago') THEN amount ELSE 0 END) AS paid, " +
    "SUM(CASE WHEN type = 'pagar' AND status NOT IN ('pago','cancelado') THEN amount ELSE 0 END) AS payable " +
    "FROM finance_entries WHERE deleted_at IS NULL AND status <> 'cancelado' " +
    'GROUP BY month ORDER BY month'
  ).all();
  res.json({ data: rows });
});

router.get('/export', requirePerm('finance', 'read'), (req, res) => {
  const format = req.query.format || 'csv';
  const rows = db.prepare(
    'SELECT f.*, fc.name AS category_name, c.name AS client_name FROM finance_entries f ' +
    'LEFT JOIN finance_categories fc ON fc.id = f.category_id LEFT JOIN clients c ON c.id = f.client_id ' +
    'WHERE f.deleted_at IS NULL ORDER BY f.due_date'
  ).all();

  if (format === 'csv') {
    const csv = toCsv(rows, [
      { key: 'id', label: 'ID' },
      { key: 'description', label: 'Descrição' },
      { key: 'type', label: 'Tipo' },
      { key: 'amount', label: 'Valor' },
      { key: 'status', label: 'Status' },
      { key: 'due_date', label: 'Vencimento' },
      { key: 'paid_date', label: 'Pagamento' },
      { key: 'category_name', label: 'Categoria' },
      { key: 'client_name', label: 'Cliente' }
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="financeiro.csv"');
    return res.send(csv);
  }

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="financeiro.pdf"');
  doc.pipe(res);
  doc.fontSize(16).text('VETEC Engenharia — Relatório financeiro');
  doc.moveDown();
  doc.fontSize(9);
  for (const r of rows) {
    doc.text((r.due_date || '-') + '  |  ' + r.description + '  |  ' + r.type + '  |  R$ ' +
      Number(r.amount).toFixed(2) + '  |  ' + r.status);
  }
  doc.end();
});

module.exports = router;
