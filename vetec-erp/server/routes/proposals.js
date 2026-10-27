'use strict';
const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');
const { nextNumber, pick, today, addDays } = require('../lib/util');

const router = express.Router();

const COLUMNS = [
  'client_id', 'opportunity_id', 'service', 'scope', 'items', 'discount', 'taxes',
  'total', 'execution_days', 'valid_until', 'payment_terms', 'notes', 'owner_id', 'status'
];

function parseItems(raw) {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch (e) { return []; }
}

function computeTotal(items, discount, taxes) {
  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit) || 0), 0);
  const total = subtotal - (Number(discount) || 0) + (Number(taxes) || 0);
  return Math.round(total * 100) / 100;
}

router.get('/', requirePerm('proposals', 'read'), (req, res) => {
  const where = ['p.deleted_at IS NULL'];
  const params = {};
  if (req.query.q) { where.push('(p.number LIKE @q OR p.service LIKE @q OR c.name LIKE @q)'); params.q = '%' + req.query.q + '%'; }
  if (req.query.status) { where.push('p.status = @status'); params.status = req.query.status; }
  if (req.query.client_id) { where.push('p.client_id = @client_id'); params.client_id = req.query.client_id; }

  const rows = db.prepare(
    'SELECT p.*, c.name AS client_name, u.name AS owner_name FROM proposals p ' +
    'LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.owner_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY p.id DESC'
  ).all(params);
  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.get('/:id', requirePerm('proposals', 'read'), (req, res) => {
  const row = db.prepare(
    'SELECT p.*, c.name AS client_name FROM proposals p LEFT JOIN clients c ON c.id = p.client_id WHERE p.id = ?'
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Proposta não encontrada' });
  row.items = parseItems(row.items);
  res.json(row);
});

router.post('/', requirePerm('proposals', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!data.client_id) return res.status(400).json({ error: 'Selecione o cliente' });

  const items = parseItems(data.items);
  data.items = JSON.stringify(items);
  data.total = computeTotal(items, data.discount, data.taxes);
  data.number = nextNumber(db, 'proposals', 'number', 'PROP-' + new Date().getFullYear() + '-', 4);
  if (!data.valid_until) data.valid_until = addDays(today(), 30);
  data.owner_id = data.owner_id || req.user.id;

  const info = db.prepare(
    'INSERT INTO proposals (' + Object.keys(data).join(', ') + ') VALUES (' +
    Object.keys(data).map((k) => '@' + k).join(', ') + ')'
  ).run(data);
  logAudit(db, req, 'create', 'proposal', info.lastInsertRowid, { number: data.number });
  const created = db.prepare('SELECT * FROM proposals WHERE id = ?').get(info.lastInsertRowid);
  created.items = parseItems(created.items);
  res.status(201).json(created);
});

router.put('/:id', requirePerm('proposals', 'write'), (req, res) => {
  const existing = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Proposta não encontrada' });
  const data = pick(req.body, COLUMNS);
  if (data.items !== undefined) {
    const items = parseItems(data.items);
    data.items = JSON.stringify(items);
    data.total = computeTotal(items, data.discount !== undefined ? data.discount : existing.discount,
      data.taxes !== undefined ? data.taxes : existing.taxes);
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Nada para atualizar' });
  db.prepare('UPDATE proposals SET ' + Object.keys(data).map((k) => k + ' = @' + k).join(', ') +
    ", updated_at = datetime('now') WHERE id = @id").run(Object.assign({}, data, { id: req.params.id }));
  logAudit(db, req, 'update', 'proposal', req.params.id, { fields: Object.keys(data) });
  const updated = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
  updated.items = parseItems(updated.items);
  res.json(updated);
});

router.post('/:id/duplicate', requirePerm('proposals', 'write'), (req, res) => {
  const src = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
  if (!src) return res.status(404).json({ error: 'Proposta não encontrada' });
  const copy = Object.assign({}, src);
  delete copy.id; delete copy.created_at; delete copy.updated_at;
  copy.number = nextNumber(db, 'proposals', 'number', 'PROP-' + new Date().getFullYear() + '-', 4);
  copy.status = 'rascunho';
  const info = db.prepare(
    'INSERT INTO proposals (' + Object.keys(copy).join(', ') + ') VALUES (' +
    Object.keys(copy).map((k) => '@' + k).join(', ') + ')'
  ).run(copy);
  logAudit(db, req, 'duplicate', 'proposal', info.lastInsertRowid, { from: src.id });
  res.status(201).json({ id: info.lastInsertRowid, number: copy.number });
});

router.post('/:id/approve', requirePerm('proposals', 'write'), (req, res) => {
  const p = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Proposta não encontrada' });
  db.prepare("UPDATE proposals SET status = 'aprovada', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'status_change', 'proposal', req.params.id, { to: 'aprovada' });
  res.json({ ok: true, proposal: db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id) });
});

// Gera uma obrigação financeira a partir da proposta (com confirmação explícita do usuário)
router.post('/:id/generate-receivable', requirePerm('finance', 'write'), (req, res) => {
  const p = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Proposta não encontrada' });
  if (req.body.confirm !== true) {
    return res.status(400).json({ error: 'Confirmação explícita necessária (confirm: true)' });
  }
  const sourceKey = 'proposal:' + p.id;
  const dup = db.prepare('SELECT id FROM finance_entries WHERE source_key = ?').get(sourceKey);
  if (dup) return res.status(409).json({ error: 'Já existe um lançamento gerado para esta proposta' });

  const info = db.prepare(
    'INSERT INTO finance_entries (description, type, amount, client_id, project_id, proposal_id, competence_date, due_date, status, source_key, created_by) ' +
    "VALUES (?, 'receber', ?, ?, NULL, ?, ?, ?, 'em_aberto', ?, ?)"
  ).run('Proposta ' + p.number + ' — ' + (p.service || 'Serviço'), p.total, p.client_id, p.id,
    today(), p.valid_until || addDays(today(), 30), sourceKey, req.user.id);

  logAudit(db, req, 'finance_generated', 'proposal', p.id, { entry: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/:id/pdf', requirePerm('proposals', 'read'), (req, res) => {
  const p = db.prepare(
    'SELECT p.*, c.name AS client_name, c.doc AS client_doc, c.email AS client_email, c.phone AS client_phone, ' +
    'u.name AS owner_name FROM proposals p LEFT JOIN clients c ON c.id = p.client_id ' +
    'LEFT JOIN users u ON u.id = p.owner_id WHERE p.id = ?'
  ).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Proposta não encontrada' });

  const items = parseItems(p.items);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="proposta-' + p.number + '.pdf"');
  doc.pipe(res);

  doc.fontSize(18).fillColor('#12324a').text('VETEC ENGENHARIA', { continued: false });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#555').text('Proposta Comercial');
  doc.moveDown(1);

  doc.fontSize(14).fillColor('#12324a').text('Proposta ' + p.number);
  doc.fontSize(10).fillColor('#333');
  doc.text('Cliente: ' + (p.client_name || '-'));
  if (p.client_doc) doc.text('Documento: ' + p.client_doc);
  doc.text('Emissão: ' + (p.created_at || '').slice(0, 10));
  doc.text('Validade: ' + (p.valid_until || '-'));
  doc.text('Responsável: ' + (p.owner_name || '-'));
  doc.moveDown(1);

  doc.fontSize(12).fillColor('#12324a').text('Escopo');
  doc.fontSize(10).fillColor('#333').text(p.scope || p.service || '-', { align: 'justify' });
  doc.moveDown(1);

  doc.fontSize(12).fillColor('#12324a').text('Itens');
  doc.moveDown(0.3);
  let y = doc.y;
  doc.fontSize(9).fillColor('#12324a');
  doc.text('Descrição', 50, y, { width: 250 });
  doc.text('Qtd', 310, y, { width: 50 });
  doc.text('Un.', 360, y, { width: 50 });
  doc.text('Valor unit.', 410, y, { width: 70 });
  doc.text('Total', 480, y, { width: 60 });
  y += 16;
  doc.moveTo(50, y - 4).lineTo(545, y - 4).strokeColor('#ddd').stroke();

  let subtotal = 0;
  doc.fillColor('#333');
  for (const it of items) {
    const qty = Number(it.qty) || 0;
    const unit = Number(it.unit) || 0;
    const line = qty * unit;
    subtotal += line;
    doc.fontSize(9);
    doc.text(String(it.desc || ''), 50, y, { width: 250 });
    doc.text(String(qty), 310, y, { width: 50 });
    doc.text(String(it.unit_label || 'un'), 360, y, { width: 50 });
    doc.text('R$ ' + unit.toFixed(2), 410, y, { width: 70 });
    doc.text('R$ ' + line.toFixed(2), 480, y, { width: 60 });
    y += 18;
    if (y > 700) { doc.addPage(); y = 60; }
  }

  y += 10;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
  y += 8;
  doc.fontSize(10).fillColor('#333');
  doc.text('Subtotal: R$ ' + subtotal.toFixed(2), 380, y, { width: 165, align: 'right' });
  y += 16;
  doc.text('Desconto: R$ ' + Number(p.discount || 0).toFixed(2), 380, y, { width: 165, align: 'right' });
  y += 16;
  doc.text('Tributos: R$ ' + Number(p.taxes || 0).toFixed(2), 380, y, { width: 165, align: 'right' });
  y += 18;
  doc.fontSize(12).fillColor('#12324a');
  doc.text('Total: R$ ' + Number(p.total || 0).toFixed(2), 380, y, { width: 165, align: 'right' });

  if (p.payment_terms || p.notes) {
    y += 40;
    doc.fontSize(12).fillColor('#12324a').text('Condições e observações', 50, y);
    doc.fontSize(9).fillColor('#333').text((p.payment_terms || '') + '\n' + (p.notes || ''), 50, y + 16, { width: 495 });
  }

  doc.end();
});

router.delete('/:id', requirePerm('proposals', 'write'), (req, res) => {
  db.prepare("UPDATE proposals SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'proposal', req.params.id, null);
  res.json({ ok: true });
});

module.exports = router;
