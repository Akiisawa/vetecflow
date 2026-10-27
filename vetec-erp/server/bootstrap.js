'use strict';
const crypto = require('crypto');
const { hashPassword } = require('./lib/auth');

function ensureAdmin(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users WHERE deleted_at IS NULL').get().c;
  if (count > 0) return null;

  const email = process.env.ADMIN_EMAIL || 'admin@vetec.local';
  const name = process.env.ADMIN_NAME || 'Administrador';
  let password = process.env.ADMIN_PASSWORD || '';
  let generated = false;

  if (!password) {
    password = crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    generated = true;
  }

  db.prepare(
    'INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)'
  ).run(name, email.toLowerCase(), hashPassword(password), 'admin');

  return { email, password, generated };
}

function ensureBaseData(db) {
  const cats = [
    ['Receita de projetos', 'receita'],
    ['Receita de serviços', 'receita'],
    ['Salários e encargos', 'despesa'],
    ['Materiais', 'despesa'],
    ['Equipamentos', 'despesa'],
    ['Terceiros e subcontratados', 'despesa'],
    ['Deslocamento', 'despesa'],
    ['Administrativo', 'despesa'],
    ['Impostos', 'despesa'],
    ['Outros', 'ambos']
  ];
  const cCount = db.prepare('SELECT COUNT(*) AS c FROM finance_categories').get().c;
  if (cCount === 0) {
    const ins = db.prepare('INSERT INTO finance_categories (name, kind) VALUES (?, ?)');
    for (const c of cats) ins.run(c[0], c[1]);
  }

  const methods = ['PIX', 'Transferência bancária', 'Boleto', 'Cartão de crédito', 'Dinheiro', 'Cheque'];
  const mCount = db.prepare('SELECT COUNT(*) AS c FROM payment_methods').get().c;
  if (mCount === 0) {
    const ins = db.prepare('INSERT INTO payment_methods (name) VALUES (?)');
    for (const m of methods) ins.run(m);
  }
}

module.exports = { ensureAdmin, ensureBaseData };
