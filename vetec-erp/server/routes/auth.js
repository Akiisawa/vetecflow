'use strict';
const express = require('express');
const db = require('../db');
const { verifyPassword, signToken, hashPassword } = require('../lib/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .get(String(email).toLowerCase().trim());

  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = signToken(user);
  res.cookie('vetec_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000
  });
  logAudit(db, { user, ip: req.ip }, 'login', 'user', user.id, null);

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('vetec_token');
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
  res.json(req.user);
});

router.post('/change-password', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
  const { current, next } = req.body || {};
  if (!current || !next) return res.status(400).json({ error: 'Informe a senha atual e a nova senha' });
  if (String(next).length < 8) return res.status(400).json({ error: 'A nova senha deve ter ao menos 8 caracteres' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current, user.password_hash)) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(hashPassword(next), req.user.id);
  logAudit(db, req, 'change_password', 'user', req.user.id, null);
  res.json({ ok: true });
});

module.exports = router;
