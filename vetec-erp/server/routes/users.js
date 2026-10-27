'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { hashPassword } = require('../lib/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();

router.get('/', requirePerm('team', 'read'), (req, res) => {
  const rows = db.prepare(
    "SELECT id, name, email, role, phone, position, active, created_at FROM users WHERE deleted_at IS NULL ORDER BY name"
  ).all();
  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.post('/', requirePerm('team', 'write'), (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'gestor') {
    return res.status(403).json({ error: 'Apenas administradores e gestores podem criar usuários' });
  }
  const { name, email, password, role, phone, position } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
  if (String(password).length < 8) return res.status(400).json({ error: 'A senha deve ter ao menos 8 caracteres' });
  if (role === 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Somente administradores podem criar administradores' });
  }
  try {
    const info = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, phone, position) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, String(email).toLowerCase(), hashPassword(password), role || 'colaborador', phone || null, position || null);
    logAudit(db, req, 'create', 'user', info.lastInsertRowid, { email, role });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Não foi possível criar o usuário (e-mail duplicado?)' });
  }
});

router.put('/:id', requirePerm('team', 'write'), (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'gestor') {
    return res.status(403).json({ error: 'Sem permissão para editar usuários' });
  }
  const allowed = ['name', 'email', 'role', 'phone', 'position', 'active'];
  const data = {};
  for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
  if (data.role === 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Somente administradores podem promover administradores' });
  }
  if (req.body.password) {
    if (String(req.body.password).length < 8) return res.status(400).json({ error: 'Senha muito curta' });
    data.password_hash = hashPassword(req.body.password);
  }
  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'Nada para atualizar' });
  db.prepare('UPDATE users SET ' + keys.map((k) => k + ' = @' + k).join(', ') + ' WHERE id = @id')
    .run(Object.assign({}, data, { id: req.params.id }));
  logAudit(db, req, 'update', 'user', req.params.id, { fields: keys });
  res.json({ ok: true });
});

router.delete('/:id', requirePerm('team', 'write'), (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem desativar usuários' });
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: 'Você não pode desativar a própria conta' });
  }
  db.prepare("UPDATE users SET deleted_at = datetime('now'), active = 0 WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'user', req.params.id, null);
  res.json({ ok: true });
});

module.exports = router;
