'use strict';
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const db = require('./db');
const { verifyToken } = require('./lib/auth');
const { ensureBaseData } = require('./bootstrap');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

ensureBaseData(db);

// -------- autenticação de cada requisição --------
app.use((req, res, next) => {
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) token = header.slice(7);
  if (!token && req.cookies && req.cookies.vetec_token) token = req.cookies.vetec_token;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = db.prepare(
        'SELECT id, name, email, role, active, deleted_at FROM users WHERE id = ?'
      ).get(payload.sub);
      if (user && user.active && !user.deleted_at) {
        req.user = user;
      }
    }
  }
  next();
});

// -------- rotas --------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/opportunities', require('./routes/opportunities'));
app.use('/api/proposals', require('./routes/proposals'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/timesheets', require('./routes/timesheets'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/search', require('./routes/search'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// -------- frontend em produção --------
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// -------- erros --------
app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Arquivo maior que o limite permitido' });
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
});

module.exports = app;
