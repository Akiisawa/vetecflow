'use strict';
const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { toCsv } = require('../lib/util');

const router = express.Router();

const REPORTS = {
  clients: {
    title: 'Clientes',
    sql: "SELECT id, name, type, doc, city, state, status, email FROM clients WHERE deleted_at IS NULL ORDER BY name",
    columns: [
      { key: 'name', label: 'Nome' }, { key: 'type', label: 'Tipo' }, { key: 'doc', label: 'Documento' },
      { key: 'city', label: 'Cidade' }, { key: 'status', label: 'Status' }, { key: 'email', label: 'E-mail' }
    ]
  },
  leads: {
    title: 'Leads',
    sql: "SELECT id, name, company, source, status, phone FROM leads WHERE deleted_at IS NULL ORDER BY id DESC",
    columns: [
      { key: 'name', label: 'Nome' }, { key: 'company', label: 'Empresa' }, { key: 'source', label: 'Origem' },
      { key: 'status', label: 'Status' }, { key: 'phone', label: 'Telefone' }
    ]
  },
  opportunities: {
    title: 'Oportunidades',
    sql: "SELECT o.id, o.title, o.stage, o.value, o.probability, c.name AS client FROM opportunities o LEFT JOIN clients c ON c.id = o.client_id WHERE o.deleted_at IS NULL ORDER BY o.id DESC",
    columns: [
      { key: 'title', label: 'Título' }, { key: 'client', label: 'Cliente' }, { key: 'stage', label: 'Etapa' },
      { key: 'value', label: 'Valor' }, { key: 'probability', label: 'Probabilidade' }
    ]
  },
  proposals: {
    title: 'Propostas',
    sql: "SELECT p.id, p.number, p.status, p.total, p.valid_until, c.name AS client FROM proposals p LEFT JOIN clients c ON c.id = p.client_id WHERE p.deleted_at IS NULL ORDER BY p.id DESC",
    columns: [
      { key: 'number', label: 'Número' }, { key: 'client', label: 'Cliente' }, { key: 'status', label: 'Status' },
      { key: 'total', label: 'Valor' }, { key: 'valid_until', label: 'Validade' }
    ]
  },
  contracts: {
    title: 'Contratos',
    sql: "SELECT ct.id, ct.number, ct.status, ct.value, ct.start_date, ct.end_date, c.name AS client FROM contracts ct LEFT JOIN clients c ON c.id = ct.client_id WHERE ct.deleted_at IS NULL ORDER BY ct.id DESC",
    columns: [
      { key: 'number', label: 'Número' }, { key: 'client', label: 'Cliente' }, { key: 'status', label: 'Status' },
      { key: 'value', label: 'Valor' }, { key: 'start_date', label: 'Início' }, { key: 'end_date', label: 'Término' }
    ]
  },
  projects: {
    title: 'Projetos',
    sql: "SELECT p.id, p.code, p.name, p.status, p.budget, p.progress, c.name AS client FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.deleted_at IS NULL ORDER BY p.id DESC",
    columns: [
      { key: 'code', label: 'Código' }, { key: 'name', label: 'Projeto' }, { key: 'client', label: 'Cliente' },
      { key: 'status', label: 'Status' }, { key: 'budget', label: 'Orçamento' }, { key: 'progress', label: 'Progresso' }
    ]
  },
  finance: {
    title: 'Financeiro',
    sql: "SELECT f.id, f.description, f.type, f.amount, f.status, f.due_date, f.paid_date FROM finance_entries f WHERE f.deleted_at IS NULL ORDER BY f.due_date",
    columns: [
      { key: 'description', label: 'Descrição' }, { key: 'type', label: 'Tipo' }, { key: 'amount', label: 'Valor' },
      { key: 'status', label: 'Status' }, { key: 'due_date', label: 'Vencimento' }, { key: 'paid_date', label: 'Pagamento' }
    ]
  },
  profitability: {
    title: 'Rentabilidade por projeto',
    sql: "SELECT p.id, p.name, p.budget, p.contracted_revenue, " +
      "COALESCE((SELECT SUM(amount) FROM finance_entries f WHERE f.project_id = p.id AND f.type='receber' AND f.status='recebido' AND f.deleted_at IS NULL),0) AS revenue_received, " +
      "COALESCE((SELECT SUM(amount) FROM finance_entries f WHERE f.project_id = p.id AND f.type='pagar' AND f.status='pago' AND f.deleted_at IS NULL),0) AS cost_realized " +
      "FROM projects p WHERE p.deleted_at IS NULL ORDER BY p.id DESC",
    columns: [
      { key: 'name', label: 'Projeto' }, { key: 'budget', label: 'Orçamento' },
      { key: 'contracted_revenue', label: 'Receita contratada' },
      { key: 'revenue_received', label: 'Receita recebida' }, { key: 'cost_realized', label: 'Custo realizado' }
    ]
  },
  timesheets: {
    title: 'Horas trabalhadas',
    sql: "SELECT ts.id, ts.date, ts.hours, ts.status, u.name AS user, p.name AS project FROM timesheets ts LEFT JOIN users u ON u.id = ts.user_id LEFT JOIN projects p ON p.id = ts.project_id WHERE ts.deleted_at IS NULL ORDER BY ts.date DESC",
    columns: [
      { key: 'date', label: 'Data' }, { key: 'user', label: 'Colaborador' }, { key: 'project', label: 'Projeto' },
      { key: 'hours', label: 'Horas' }, { key: 'status', label: 'Status' }
    ]
  },
  suppliers: {
    title: 'Fornecedores',
    sql: "SELECT id, name, doc, email, phone, status FROM suppliers WHERE deleted_at IS NULL ORDER BY name",
    columns: [
      { key: 'name', label: 'Nome' }, { key: 'doc', label: 'Documento' },
      { key: 'email', label: 'E-mail' }, { key: 'phone', label: 'Telefone' }, { key: 'status', label: 'Status' }
    ]
  },
  assets: {
    title: 'Equipamentos',
    sql: "SELECT id, code, name, category, state, location, acquisition_value FROM assets WHERE deleted_at IS NULL ORDER BY code",
    columns: [
      { key: 'code', label: 'Código' }, { key: 'name', label: 'Nome' }, { key: 'category', label: 'Categoria' },
      { key: 'state', label: 'Estado' }, { key: 'location', label: 'Localização' }, { key: 'acquisition_value', label: 'Valor' }
    ]
  }
};

router.get('/', requirePerm('reports', 'read'), (req, res) => {
  res.json({ data: Object.keys(REPORTS).map((k) => ({ key: k, title: REPORTS[k].title })) });
});

router.get('/:type', requirePerm('reports', 'read'), (req, res) => {
  const def = REPORTS[req.params.type];
  if (!def) return res.status(404).json({ error: 'Relatório desconhecido' });

  const rows = db.prepare(def.sql).all();
  const format = req.query.format || 'json';

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + req.params.type + '.csv"');
    return res.send(toCsv(rows, def.columns));
  }

  if (format === 'pdf') {
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + req.params.type + '.pdf"');
    doc.pipe(res);
    doc.fontSize(15).text('VETEC Engenharia — ' + def.title);
    doc.moveDown(0.5);
    doc.fontSize(8);
    for (const r of rows) {
      doc.text(def.columns.map((c) => (r[c.key] === null || r[c.key] === undefined ? '-' : r[c.key])).join('  |  '));
    }
    doc.end();
    return;
  }

  res.json({ title: def.title, columns: def.columns, data: rows, total: rows.length });
});

module.exports = router;
