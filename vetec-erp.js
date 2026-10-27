#!/usr/bin/env node
/**
 * VETEC ERP — Gerador autônomo de projeto
 * ---------------------------------------------------------------
 * Uso:
 *   node vetec-erp.js [pasta-destino]
 *   node vetec-erp.js --out ./meu-erp --force
 *
 * Cria um ERP completo (backend Express + SQLite + frontend React/Vite)
 * a partir deste único arquivo. Não apaga dados existentes.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

/* ==============================================================
 * 0. UTILITÁRIOS DO GERADOR
 * ============================================================== */

const FILES = [];
function add(rel, content) {
  FILES.push({ rel: rel.replace(/\\/g, '/'), content: content.replace(/\r\n/g, '\n') });
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function ask(question) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) return resolve('');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); resolve((a || '').trim()); });
  });
}

function parseArgs(argv) {
  const args = { out: null, force: false, yes: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force' || a === '-f') args.force = true;
    else if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--out' || a === '-o') args.out = argv[++i];
    else if (!a.startsWith('-') && !args.out) args.out = a;
  }
  return args;
}

/* ==============================================================
 * 1. ARQUIVOS RAIZ
 * ============================================================== */

add('package.json', `{
  "name": "vetec-erp",
  "version": "1.0.0",
  "private": true,
  "description": "ERP empresarial da VETEC Engenharia",
  "scripts": {
    "dev": "concurrently -n API,WEB -c blue,green \\"npm:dev:api\\" \\"npm:dev:web\\"",
    "dev:api": "node server/index.js",
    "dev:web": "vite",
    "build": "vite build",
    "start": "cross-env NODE_ENV=production node server/index.js",
    "test": "node --test server/tests/"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^11.3.0",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "pdfkit": "^0.15.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "concurrently": "^8.2.2",
    "cross-env": "^7.0.3",
    "vite": "^5.4.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
`);

add('vite.config.mjs', `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } }
  },
  build: { outDir: '../dist', emptyOutDir: true }
});
`);

add('.gitignore', `node_modules/
dist/
data/
.env
server/storage/documents/*
!server/storage/documents/.gitkeep
*.log
`);

add('README.md', `# VETEC ERP

ERP empresarial da **VETEC Engenharia** — backend Node.js/Express + SQLite e frontend React/Vite.

## Requisitos

- Node.js 18 ou superior (recomendado 20+)
- npm 9+
- Windows, Linux ou macOS

> O \`better-sqlite3\` normalmente é instalado com binários pré-compilados.
> Se o \`npm install\` falhar na compilação, instale as *Build Tools* do Visual Studio
> (Windows) ou \`build-essential\` + \`python3\` (Linux).

## Instalação

\`\`\`bash
npm install
\`\`\`

Crie o arquivo \`.env\` (o gerador já cria um automaticamente na primeira execução).
Se precisar recriar, copie de \`.env.example\`.

## Execução (desenvolvimento)

\`\`\`bash
npm run dev
\`\`\`

- API: http://localhost:4000
- Interface: http://localhost:5173

## Execução (produção)

\`\`\`bash
npm run build
npm start
\`\`\`

A interface é servida pela própria API em http://localhost:4000.

## Primeiro acesso

Na primeira execução, se não existir nenhum usuário, o sistema cria a conta
administrativa. As credenciais vêm de \`ADMIN_EMAIL\` / \`ADMIN_PASSWORD\` no \`.env\`.
Se não estiverem definidas, uma senha aleatória é gerada e impressa **uma única vez**
no console do servidor.

## Testes

\`\`\`bash
npm test
\`\`\`

Os testes usam um banco temporário e não afetam os dados reais.

## Estrutura

\`\`\`
server/        API REST, banco, autenticação, auditoria
  routes/      Rotas por módulo
  lib/         Permissões, CRUD genérico, auditoria, utilitários
  schema.sql   Estrutura do banco
  storage/     Arquivos enviados (documentos)
client/        Interface React (Vite)
data/          Banco SQLite persistente (gerado em tempo de execução)
\`\`\`

## Backup

O banco fica em \`data/vetec.db\`. Basta copiar esse arquivo (com o servidor parado)
e a pasta \`server/storage/documents\` para ter um backup completo.

## Segurança — observações importantes

- Senhas usam hash bcrypt; tokens JWT assinados com segredo do \`.env\`.
- Autorizações são verificadas **no servidor** em todas as rotas.
- Antes de expor o sistema na internet: use HTTPS (proxy reverso), troque o
  \`JWT_SECRET\`, configure backups automáticos e revise as permissões por perfil.
- Este é um sistema funcional para uso interno; não foi submetido a auditoria de
  segurança externa.
`);

add('.env.example', `# Porta da API
PORT=4000
# Segredo para assinatura dos tokens JWT (troque em produção)
JWT_SECRET=troque-este-segredo
# Validade do token em horas
JWT_EXPIRES_HOURS=12
# Conta administrativa inicial (usada apenas se não houver usuários)
ADMIN_EMAIL=admin@vetec.local
ADMIN_PASSWORD=
ADMIN_NAME=Administrador
`);

/* ==============================================================
 * 2. BACKEND — SCHEMA
 * ============================================================== */

add('server/schema.sql', `PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'colaborador',
  phone TEXT,
  position TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'PJ',
  name TEXT NOT NULL,
  trade_name TEXT,
  doc TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  zip TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  segment TEXT,
  owner_id INTEGER REFERENCES users(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  owner_id INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id),
  lead_id INTEGER REFERENCES leads(id),
  title TEXT NOT NULL,
  service TEXT,
  value REAL NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'novo_lead',
  owner_id INTEGER REFERENCES users(id),
  source TEXT,
  expected_close TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_opp_stage ON opportunities(stage);

CREATE TABLE IF NOT EXISTS opportunity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT,
  user_id INTEGER REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  opportunity_id INTEGER REFERENCES opportunities(id),
  service TEXT,
  scope TEXT,
  items TEXT NOT NULL DEFAULT '[]',
  discount REAL NOT NULL DEFAULT 0,
  taxes REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  execution_days INTEGER,
  valid_until TEXT,
  payment_terms TEXT,
  notes TEXT,
  owner_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'rascunho',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  contract_id INTEGER,
  owner_id INTEGER REFERENCES users(id),
  location TEXT,
  start_date TEXT,
  due_date TEXT,
  expected_end TEXT,
  budget REAL NOT NULL DEFAULT 0,
  contracted_revenue REAL NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planejamento',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  proposal_id INTEGER REFERENCES proposals(id),
  project_id INTEGER REFERENCES projects(id),
  value REAL NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  payment_terms TEXT,
  owner_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'ativo',
  document_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT,
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  project_id INTEGER REFERENCES projects(id),
  assignee_id INTEGER REFERENCES users(id),
  priority TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente',
  start_date TEXT,
  due_date TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id)
);

CREATE TABLE IF NOT EXISTS task_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timesheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  project_id INTEGER REFERENCES projects(id),
  task_id INTEGER REFERENCES tasks(id),
  date TEXT NOT NULL,
  hours REAL NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_timesheets_project ON timesheets(project_id);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id),
  project_id INTEGER REFERENCES projects(id),
  category TEXT NOT NULL DEFAULT 'outros',
  name TEXT NOT NULL,
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_docs_client ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);

CREATE TABLE IF NOT EXISTS finance_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'ambos',
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  doc TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  category TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS finance_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  category_id INTEGER REFERENCES finance_categories(id),
  client_id INTEGER REFERENCES clients(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  project_id INTEGER REFERENCES projects(id),
  contract_id INTEGER REFERENCES contracts(id),
  proposal_id INTEGER REFERENCES proposals(id),
  competence_date TEXT,
  due_date TEXT,
  paid_date TEXT,
  status TEXT NOT NULL DEFAULT 'previsto',
  payment_method_id INTEGER REFERENCES payment_methods(id),
  notes TEXT,
  source_key TEXT UNIQUE,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_fin_type ON finance_entries(type);
CREATE INDEX IF NOT EXISTS idx_fin_status ON finance_entries(status);
CREATE INDEX IF NOT EXISTS idx_fin_due ON finance_entries(due_date);
CREATE INDEX IF NOT EXISTS idx_fin_project ON finance_entries(project_id);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  patrimony TEXT,
  name TEXT NOT NULL,
  category TEXT,
  state TEXT NOT NULL DEFAULT 'disponivel',
  location TEXT,
  responsible_id INTEGER REFERENCES users(id),
  project_id INTEGER REFERENCES projects(id),
  acquisition_value REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS asset_maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT,
  description TEXT,
  cost REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id),
  date TEXT NOT NULL,
  type TEXT,
  severity TEXT NOT NULL DEFAULT 'media',
  responsible_id INTEGER REFERENCES users(id),
  description TEXT NOT NULL,
  resolution TEXT,
  resolved_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS incident_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  note TEXT,
  status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_diary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  activities TEXT,
  problems TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'reuniao',
  start_at TEXT NOT NULL,
  end_at TEXT,
  project_id INTEGER REFERENCES projects(id),
  client_id INTEGER REFERENCES clients(id),
  user_id INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'info',
  entity TEXT,
  entity_id TEXT,
  dedupe_key TEXT UNIQUE,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity);
`);

/* ==============================================================
 * 3. BACKEND — NÚCLEO
 * ============================================================== */

add('server/db.js', `'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'vetec.db');
const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Mecanismo simples de migração incremental para versões futuras.
const MIGRATIONS = [
  // { version: 2, sql: 'ALTER TABLE ...' }
];

function currentVersion() {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
  return row ? parseInt(row.value, 10) : 1;
}

function runMigrations() {
  let v = currentVersion();
  for (const m of MIGRATIONS) {
    if (m.version > v) {
      const tx = db.transaction(() => {
        db.exec(m.sql);
        db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
          .run(String(m.version));
      });
      tx();
      v = m.version;
    }
  }
  if (!db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', '1')").run();
  }
}

runMigrations();

module.exports = db;
module.exports.DATA_DIR = DATA_DIR;
module.exports.DB_FILE = DB_FILE;
`);

add('server/lib/perm.js', `'use strict';

const ROLES = ['admin', 'gestor', 'comercial', 'engenharia', 'financeiro', 'colaborador'];

const PERMISSIONS = {
  admin: ['*'],
  gestor: [
    'clients:*', 'crm:*', 'proposals:*', 'contracts:*', 'projects:*', 'tasks:*',
    'team:*', 'timesheets:*', 'documents:*', 'finance:*', 'suppliers:*', 'assets:*',
    'incidents:*', 'calendar:*', 'reports:read', 'audit:read', 'users:read',
    'notifications:*', 'dashboard:read', 'search:read'
  ],
  comercial: [
    'clients:*', 'crm:*', 'proposals:*', 'contracts:read', 'contracts:write',
    'projects:read', 'finance:read', 'reports:read', 'dashboard:read',
    'documents:*', 'calendar:*', 'notifications:*', 'tasks:read', 'timesheets:read',
    'team:read', 'search:read', 'suppliers:read', 'incidents:read'
  ],
  engenharia: [
    'projects:*', 'tasks:*', 'incidents:*', 'documents:*', 'timesheets:*',
    'assets:read', 'assets:write', 'clients:read', 'contracts:read', 'suppliers:read',
    'finance:read', 'dashboard:read', 'calendar:*', 'notifications:*', 'team:read',
    'reports:read', 'search:read', 'crm:read', 'proposals:read'
  ],
  financeiro: [
    'finance:*', 'suppliers:*', 'contracts:read', 'clients:read', 'proposals:read',
    'projects:read', 'reports:read', 'dashboard:read', 'documents:read',
    'notifications:*', 'calendar:*', 'assets:read', 'timesheets:read', 'search:read',
    'crm:read', 'tasks:read', 'team:read'
  ],
  colaborador: [
    'tasks:read', 'tasks:write', 'timesheets:read', 'timesheets:write',
    'projects:read', 'documents:read', 'incidents:read', 'incidents:write',
    'dashboard:read', 'calendar:read', 'notifications:*', 'clients:read',
    'search:read', 'team:read'
  ]
};

function can(role, mod, action) {
  const list = PERMISSIONS[role] || [];
  if (list.indexOf('*') !== -1) return true;
  return list.indexOf(mod + ':*') !== -1 || list.indexOf(mod + ':' + action) !== -1;
}

function requirePerm(mod, action) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!can(req.user.role, mod, action)) {
      return res.status(403).json({ error: 'Acesso negado para esta operação' });
    }
    next();
  };
}

module.exports = { ROLES, PERMISSIONS, can, requirePerm };
`);

add('server/lib/audit.js', `'use strict';

function logAudit(db, req, action, entity, entityId, details) {
  try {
    db.prepare(
      'INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      req && req.user ? req.user.id : null,
      action,
      entity,
      entityId === undefined || entityId === null ? null : String(entityId),
      details ? JSON.stringify(sanitize(details)) : null,
      req ? (req.ip || null) : null
    );
  } catch (e) {
    console.error('[audit] falha ao registrar evento:', e.message);
  }
}

function sanitize(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (/password|token|secret|senha/i.test(k)) continue;
    out[k] = obj[k];
  }
  return out;
}

module.exports = { logAudit };
`);

add('server/lib/util.js', `'use strict';

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function pad(n, size) {
  let s = String(n);
  while (s.length < size) s = '0' + s;
  return s;
}

function nextNumber(db, table, column, prefix, size) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM ' + table).get();
  const seq = (row.c || 0) + 1;
  let candidate = prefix + pad(seq, size || 4);
  let n = seq;
  while (db.prepare('SELECT 1 FROM ' + table + ' WHERE ' + column + ' = ?').get(candidate)) {
    n++;
    candidate = prefix + pad(n, size || 4);
  }
  return candidate;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

function toCsv(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",;\\n\\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const head = columns.map((c) => esc(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(';')).join('\\n');
  return '\\ufeff' + head + '\\n' + body + '\\n';
}

module.exports = { nowIso, nextNumber, today, addDays, pick, toCsv, pad };
`);

add('server/lib/crud.js', `'use strict';
const express = require('express');
const { requirePerm } = require('./perm');
const { logAudit } = require('./audit');
const { pick } = require('./util');

/**
 * Fábrica de rotas CRUD genéricas.
 */
function createCrudRouter(db, opts) {
  const {
    table,
    columns,
    searchColumns = [],
    filterColumns = [],
    dateColumn = null,
    readPerm,
    writePerm,
    entity,
    softDelete = true,
    required = [],
    defaultOrder = 'id DESC',
    beforeSave = null,
    afterSave = null,
    extraColumns = []
  } = opts;

  const router = express.Router();
  const allColumns = columns.concat(extraColumns);
  const hasDeleted = softDelete && allColumns.indexOf('deleted_at') !== -1 || softDelete;

  function buildWhere(req) {
    const where = [];
    const params = {};
    if (softDelete) where.push('t.deleted_at IS NULL');
    if (searchColumns.length && req.query.q) {
      const parts = [];
      searchColumns.forEach((c, i) => {
        params['q' + i] = '%' + req.query.q + '%';
        parts.push('t.' + c + ' LIKE @q' + i);
      });
      where.push('(' + parts.join(' OR ') + ')');
    }
    for (const c of filterColumns) {
      const v = req.query['f_' + c];
      if (v !== undefined && v !== '') {
        params['f_' + c] = v;
        where.push('t.' + c + ' = @f_' + c);
      }
    }
    if (dateColumn) {
      if (req.query.from) { params.from = req.query.from; where.push('t.' + dateColumn + ' >= @from'); }
      if (req.query.to) { params.to = req.query.to; where.push('t.' + dateColumn + ' <= @to'); }
    }
    return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
  }

  router.get('/', requirePerm(readPerm[0], readPerm[1]), (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '25', 10)));
      const offset = (page - 1) * limit;
      const { sql, params } = buildWhere(req);

      let sort = req.query.sort || null;
      let dir = (req.query.dir || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      if (!sort || allColumns.indexOf(sort) === -1) {
        sort = null;
      }
      const orderBy = sort ? 't.' + sort + ' ' + dir : defaultOrder;

      const total = db.prepare('SELECT COUNT(*) AS c FROM ' + table + ' t ' + sql).get(params).c;
      const rows = db.prepare(
        'SELECT t.* FROM ' + table + ' t ' + sql + ' ORDER BY ' + orderBy + ' LIMIT @limit OFFSET @offset'
      ).all(Object.assign({}, params, { limit, offset }));

      res.json({ data: rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erro ao listar registros' });
    }
  });

  router.get('/:id', requirePerm(readPerm[0], readPerm[1]), (req, res) => {
    const row = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(req.params.id);
    if (!row || (softDelete && row.deleted_at)) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json(row);
  });

  router.post('/', requirePerm(writePerm[0], writePerm[1]), (req, res) => {
    try {
      for (const r of required) {
        if (req.body[r] === undefined || req.body[r] === null || req.body[r] === '') {
          return res.status(400).json({ error: 'Campo obrigatório: ' + r });
        }
      }
      let data = pick(req.body, allColumns);
      if (beforeSave) data = beforeSave(data, req, null) || data;

      const keys = Object.keys(data);
      if (!keys.length) return res.status(400).json({ error: 'Nenhum campo válido enviado' });

      const stmt = 'INSERT INTO ' + table + ' (' + keys.join(', ') + ') VALUES (' +
        keys.map((k) => '@' + k).join(', ') + ')';
      const info = db.prepare(stmt).run(data);
      const created = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(info.lastInsertRowid);

      logAudit(db, req, 'create', entity, created.id, created);
      if (afterSave) afterSave(created, req, db);
      res.status(201).json(created);
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: 'Erro ao criar registro: ' + e.message });
    }
  });

  router.put('/:id', requirePerm(writePerm[0], writePerm[1]), (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Registro não encontrado' });

      let data = pick(req.body, allColumns);
      if (beforeSave) data = beforeSave(data, req, existing) || data;
      const keys = Object.keys(data);
      if (!keys.length) return res.status(400).json({ error: 'Nenhum campo válido enviado' });

      if (allColumns.indexOf('updated_at') !== -1) {
        data.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }
      const sets = Object.keys(data).map((k) => k + ' = @' + k).join(', ');
      db.prepare('UPDATE ' + table + ' SET ' + sets + ' WHERE id = @id')
        .run(Object.assign({}, data, { id: req.params.id }));

      const updated = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(req.params.id);
      logAudit(db, req, 'update', entity, updated.id, { changes: Object.keys(data) });
      if (afterSave) afterSave(updated, req, db);
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: 'Erro ao atualizar registro: ' + e.message });
    }
  });

  router.delete('/:id', requirePerm(writePerm[0], writePerm[1]), (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Registro não encontrado' });

      if (softDelete) {
        db.prepare('UPDATE ' + table + " SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
      } else {
        db.prepare('DELETE FROM ' + table + ' WHERE id = ?').run(req.params.id);
      }
      logAudit(db, req, softDelete ? 'soft_delete' : 'delete', entity, req.params.id, null);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: 'Erro ao excluir: ' + e.message });
    }
  });

  return router;
}

module.exports = { createCrudRouter };
`);

add('server/lib/auth.js', `'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-nao-use-em-producao';
const EXPIRES_HOURS = parseInt(process.env.JWT_EXPIRES_HOURS || '12', 10);

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    SECRET,
    { expiresIn: EXPIRES_HOURS + 'h' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, SECRET, EXPIRES_HOURS };
`);

add('server/bootstrap.js', `'use strict';
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
`);

add('server/app.js', `'use strict';
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
  app.get(/^(?!\\/api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
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
`);

add('server/index.js', `'use strict';
require('dotenv').config();

const app = require('./app');
const db = require('./db');
const { ensureAdmin } = require('./bootstrap');

const PORT = parseInt(process.env.PORT || '4000', 10);

const created = ensureAdmin(db);

const server = app.listen(PORT, () => {
  console.log('');
  console.log('  VETEC ERP — API em execução');
  console.log('  http://localhost:' + PORT);
  console.log('  Banco: ' + db.DB_FILE);
  if (created) {
    console.log('');
    console.log('  ================================================');
    console.log('   CONTA ADMINISTRATIVA CRIADA');
    console.log('   E-mail: ' + created.email);
    if (created.generated) {
      console.log('   Senha : ' + created.password);
      console.log('   Guarde esta senha. Ela não será exibida novamente.');
    } else {
      console.log('   Senha : definida em ADMIN_PASSWORD (.env)');
    }
    console.log('  ================================================');
  }
  console.log('');
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
`);

/* ==============================================================
 * 4. BACKEND — ROTAS
 * ============================================================== */

add('server/routes/auth.js', `'use strict';
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
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\\'now\\') WHERE id = ?')
    .run(hashPassword(next), req.user.id);
  logAudit(db, req, 'change_password', 'user', req.user.id, null);
  res.json({ ok: true });
});

module.exports = router;
`);

add('server/routes/users.js', `'use strict';
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
`);

add('server/routes/clients.js', `'use strict';
const express = require('express');
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');
const { requirePerm } = require('../lib/perm');

const COLUMNS = [
  'type', 'name', 'trade_name', 'doc', 'phone', 'whatsapp', 'email', 'website',
  'zip', 'address', 'city', 'state', 'segment', 'owner_id', 'notes', 'status'
];

const router = createCrudRouter(db, {
  table: 'clients',
  columns: COLUMNS,
  searchColumns: ['name', 'trade_name', 'doc', 'email', 'city'],
  filterColumns: ['status', 'type', 'state', 'owner_id'],
  readPerm: ['clients', 'read'],
  writePerm: ['clients', 'write'],
  entity: 'client',
  required: ['name']
});

// Visão 360 do cliente
router.get('/:id/full', requirePerm('clients', 'read'), (req, res) => {
  const id = req.params.id;
  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  const contacts = db.prepare('SELECT * FROM contacts WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const leads = db.prepare('SELECT * FROM leads WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const opportunities = db.prepare('SELECT * FROM opportunities WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const proposals = db.prepare('SELECT * FROM proposals WHERE client_id = ? AND deleted_at IS NULL ORDER BY id DESC').all(id);
  const contracts = db.prepare('SELECT * FROM contracts WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const projects = db.prepare('SELECT * FROM projects WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const documents = db.prepare('SELECT * FROM documents WHERE client_id = ? AND deleted_at IS NULL').all(id);
  const finance = db.prepare('SELECT * FROM finance_entries WHERE client_id = ? AND deleted_at IS NULL ORDER BY due_date DESC LIMIT 50').all(id);
  const audit = db.prepare(
    "SELECT * FROM audit_log WHERE entity IN ('client','proposal','contract','project') AND entity_id = ? ORDER BY id DESC LIMIT 30"
  ).all(String(id));

  const totals = db.prepare(
    "SELECT type, SUM(amount) AS total FROM finance_entries WHERE client_id = ? AND deleted_at IS NULL AND status NOT IN ('cancelado') GROUP BY type"
  ).all(id);

  res.json({ client, contacts, leads, opportunities, proposals, contracts, projects, documents, finance, audit, totals });
});

module.exports = router;
`);

add('server/routes/contacts.js', `'use strict';
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');

module.exports = createCrudRouter(db, {
  table: 'contacts',
  columns: ['client_id', 'name', 'role', 'email', 'phone', 'notes'],
  searchColumns: ['name', 'email', 'phone'],
  filterColumns: ['client_id'],
  readPerm: ['clients', 'read'],
  writePerm: ['clients', 'write'],
  entity: 'contact',
  required: ['name', 'client_id']
});
`);

add('server/routes/leads.js', `'use strict';
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');

module.exports = createCrudRouter(db, {
  table: 'leads',
  columns: ['client_id', 'name', 'email', 'phone', 'company', 'source', 'status', 'owner_id', 'notes'],
  searchColumns: ['name', 'email', 'phone', 'company'],
  filterColumns: ['status', 'owner_id', 'source'],
  readPerm: ['crm', 'read'],
  writePerm: ['crm', 'write'],
  entity: 'lead',
  required: ['name']
});
`);

add('server/routes/opportunities.js', `'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');
const { pick } = require('../lib/util');

const router = express.Router();

const STAGES = ['novo_lead', 'primeiro_contato', 'qualificacao', 'proposta_enviada', 'negociacao', 'ganho', 'perdido'];
const COLUMNS = ['client_id', 'lead_id', 'title', 'service', 'value', 'probability', 'stage', 'owner_id', 'source', 'expected_close', 'notes'];

router.get('/', requirePerm('crm', 'read'), (req, res) => {
  const where = ['o.deleted_at IS NULL'];
  const params = {};
  if (req.query.q) {
    where.push('(o.title LIKE @q OR o.service LIKE @q)');
    params.q = '%' + req.query.q + '%';
  }
  if (req.query.stage) { where.push('o.stage = @stage'); params.stage = req.query.stage; }
  if (req.query.owner_id) { where.push('o.owner_id = @owner_id'); params.owner_id = req.query.owner_id; }
  if (req.query.client_id) { where.push('o.client_id = @client_id'); params.client_id = req.query.client_id; }

  const rows = db.prepare(
    'SELECT o.*, c.name AS client_name, u.name AS owner_name FROM opportunities o ' +
    'LEFT JOIN clients c ON c.id = o.client_id LEFT JOIN users u ON u.id = o.owner_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY o.id DESC'
  ).all(params);
  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.get('/board', requirePerm('crm', 'read'), (req, res) => {
  const rows = db.prepare(
    'SELECT o.*, c.name AS client_name, u.name AS owner_name FROM opportunities o ' +
    'LEFT JOIN clients c ON c.id = o.client_id LEFT JOIN users u ON u.id = o.owner_id ' +
    'WHERE o.deleted_at IS NULL ORDER BY o.id DESC'
  ).all();
  const board = {};
  for (const s of STAGES) board[s] = [];
  for (const r of rows) {
    if (!board[r.stage]) board[r.stage] = [];
    board[r.stage].push(r);
  }
  res.json({ stages: STAGES, board });
});

router.post('/', requirePerm('crm', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!data.title) return res.status(400).json({ error: 'Informe o título da oportunidade' });
  const info = db.prepare(
    'INSERT INTO opportunities (' + Object.keys(data).join(', ') + ') VALUES (' +
    Object.keys(data).map((k) => '@' + k).join(', ') + ')'
  ).run(data);
  db.prepare('INSERT INTO opportunity_events (opportunity_id, from_stage, to_stage, user_id, note) VALUES (?, NULL, ?, ?, ?)')
    .run(info.lastInsertRowid, data.stage || 'novo_lead', req.user.id, 'Oportunidade criada');
  logAudit(db, req, 'create', 'opportunity', info.lastInsertRowid, { title: data.title });
  res.status(201).json(db.prepare('SELECT * FROM opportunities WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requirePerm('crm', 'write'), (req, res) => {
  const existing = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  const data = pick(req.body, COLUMNS);
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Nada para atualizar' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE opportunities SET ' + Object.keys(data).map((k) => k + ' = @' + k).join(', ') +
      ", updated_at = datetime('now') WHERE id = @id").run(Object.assign({}, data, { id: req.params.id }));
    if (data.stage && data.stage !== existing.stage) {
      db.prepare('INSERT INTO opportunity_events (opportunity_id, from_stage, to_stage, user_id, note) VALUES (?, ?, ?, ?, ?)')
        .run(req.params.id, existing.stage, data.stage, req.user.id, req.body.stage_note || null);
    }
  });
  tx();
  logAudit(db, req, 'update', 'opportunity', req.params.id, { fields: Object.keys(data) });
  res.json(db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id));
});

router.post('/:id/stage', requirePerm('crm', 'write'), (req, res) => {
  const { stage, note } = req.body || {};
  if (STAGES.indexOf(stage) === -1) return res.status(400).json({ error: 'Etapa inválida' });
  const existing = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  db.prepare("UPDATE opportunities SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(stage, req.params.id);
  db.prepare('INSERT INTO opportunity_events (opportunity_id, from_stage, to_stage, user_id, note) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, existing.stage, stage, req.user.id, note || null);
  logAudit(db, req, 'stage_change', 'opportunity', req.params.id, { from: existing.stage, to: stage });
  res.json({ ok: true });
});

router.get('/:id/events', requirePerm('crm', 'read'), (req, res) => {
  const rows = db.prepare(
    'SELECT e.*, u.name AS user_name FROM opportunity_events e LEFT JOIN users u ON u.id = e.user_id ' +
    'WHERE e.opportunity_id = ? ORDER BY e.id DESC'
  ).all(req.params.id);
  res.json({ data: rows });
});

router.delete('/:id', requirePerm('crm', 'write'), (req, res) => {
  db.prepare("UPDATE opportunities SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'opportunity', req.params.id, null);
  res.json({ ok: true });
});

module.exports = router;
`);

add('server/routes/proposals.js', `'use strict';
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
    doc.fontSize(9).fillColor('#333').text((p.payment_terms || '') + '\\n' + (p.notes || ''), 50, y + 16, { width: 495 });
  }

  doc.end();
});

router.delete('/:id', requirePerm('proposals', 'write'), (req, res) => {
  db.prepare("UPDATE proposals SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'proposal', req.params.id, null);
  res.json({ ok: true });
});

module.exports = router;
`);

add('server/routes/contracts.js', `'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');
const { nextNumber, pick } = require('../lib/util');

const router = express.Router();

const COLUMNS = ['number', 'client_id', 'proposal_id', 'project_id', 'value', 'start_date', 'end_date', 'payment_terms', 'owner_id', 'status', 'document_id', 'notes'];

router.get('/', requirePerm('contracts', 'read'), (req, res) => {
  const where = ['ct.deleted_at IS NULL'];
  const params = {};
  if (req.query.q) { where.push('(ct.number LIKE @q OR c.name LIKE @q)'); params.q = '%' + req.query.q + '%'; }
  if (req.query.status) { where.push('ct.status = @status'); params.status = req.query.status; }
  if (req.query.client_id) { where.push('ct.client_id = @client_id'); params.client_id = req.query.client_id; }

  const rows = db.prepare(
    'SELECT ct.*, c.name AS client_name, p.name AS project_name FROM contracts ct ' +
    'LEFT JOIN clients c ON c.id = ct.client_id LEFT JOIN projects p ON p.id = ct.project_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY ct.id DESC'
  ).all(params);
  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.post('/', requirePerm('contracts', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!data.client_id) return res.status(400).json({ error: 'Selecione o cliente' });
  if (!data.number) data.number = nextNumber(db, 'contracts', 'number', 'CT-' + new Date().getFullYear() + '-', 4);
  data.owner_id = data.owner_id || req.user.id;

  const info = db.prepare(
    'INSERT INTO contracts (' + Object.keys(data).join(', ') + ') VALUES (' +
    Object.keys(data).map((k) => '@' + k).join(', ') + ')'
  ).run(data);

  if (data.project_id) {
    db.prepare('UPDATE projects SET contract_id = ? WHERE id = ?').run(info.lastInsertRowid, data.project_id);
  }
  logAudit(db, req, 'create', 'contract', info.lastInsertRowid, { number: data.number });
  res.status(201).json(db.prepare('SELECT * FROM contracts WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requirePerm('contracts', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Nada para atualizar' });
  db.prepare('UPDATE contracts SET ' + Object.keys(data).map((k) => k + ' = @' + k).join(', ') +
    ", updated_at = datetime('now') WHERE id = @id").run(Object.assign({}, data, { id: req.params.id }));
  logAudit(db, req, 'update', 'contract', req.params.id, { fields: Object.keys(data) });
  res.json(db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id));
});

router.post('/:id/generate-receivable', requirePerm('finance', 'write'), (req, res) => {
  const ct = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!ct) return res.status(404).json({ error: 'Contrato não encontrado' });
  if (req.body.confirm !== true) return res.status(400).json({ error: 'Confirmação explícita necessária' });
  const sourceKey = 'contract:' + ct.id;
  if (db.prepare('SELECT id FROM finance_entries WHERE source_key = ?').get(sourceKey)) {
    return res.status(409).json({ error: 'Já existe lançamento para este contrato' });
  }
  const info = db.prepare(
    'INSERT INTO finance_entries (description, type, amount, client_id, project_id, contract_id, competence_date, due_date, status, source_key, created_by) ' +
    "VALUES (?, 'receber', ?, ?, ?, ?, ?, ?, 'em_aberto', ?, ?)"
  ).run('Contrato ' + ct.number, ct.value, ct.client_id, ct.project_id, ct.id,
    ct.start_date || null, ct.end_date || null, sourceKey, req.user.id);
  logAudit(db, req, 'finance_generated', 'contract', ct.id, { entry: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/:id', requirePerm('contracts', 'write'), (req, res) => {
  db.prepare("UPDATE contracts SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'contract', req.params.id, null);
  res.json({ ok: true });
});

module.exports = router;
`);

add('server/routes/projects.js', `'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');
const { pick, nextNumber } = require('../lib/util');

const router = express.Router();

const COLUMNS = ['code', 'name', 'client_id', 'contract_id', 'owner_id', 'location', 'start_date', 'due_date', 'expected_end', 'budget', 'contracted_revenue', 'progress', 'status', 'notes'];

router.get('/', requirePerm('projects', 'read'), (req, res) => {
  const where = ['p.deleted_at IS NULL'];
  const params = {};
  if (req.query.q) { where.push('(p.name LIKE @q OR p.code LIKE @q)'); params.q = '%' + req.query.q + '%'; }
  if (req.query.status) { where.push('p.status = @status'); params.status = req.query.status; }
  if (req.query.client_id) { where.push('p.client_id = @client_id'); params.client_id = req.query.client_id; }

  const rows = db.prepare(
    'SELECT p.*, c.name AS client_name, u.name AS owner_name FROM projects p ' +
    'LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.owner_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY p.id DESC'
  ).all(params);
  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.post('/', requirePerm('projects', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!data.name) return res.status(400).json({ error: 'Informe o nome do projeto' });
  if (!data.code) data.code = nextNumber(db, 'projects', 'code', 'PRJ-' + new Date().getFullYear() + '-', 3);
  data.owner_id = data.owner_id || req.user.id;
  const info = db.prepare(
    'INSERT INTO projects (' + Object.keys(data).join(', ') + ') VALUES (' +
    Object.keys(data).map((k) => '@' + k).join(', ') + ')'
  ).run(data);
  logAudit(db, req, 'create', 'project', info.lastInsertRowid, { code: data.code });
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requirePerm('projects', 'write'), (req, res) => {
  const data = pick(req.body, COLUMNS);
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Nada para atualizar' });
  db.prepare('UPDATE projects SET ' + Object.keys(data).map((k) => k + ' = @' + k).join(', ') +
    ", updated_at = datetime('now') WHERE id = @id").run(Object.assign({}, data, { id: req.params.id }));
  logAudit(db, req, 'update', 'project', req.params.id, { fields: Object.keys(data) });
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requirePerm('projects', 'write'), (req, res) => {
  db.prepare("UPDATE projects SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'project', req.params.id, null);
  res.json({ ok: true });
});

router.get('/:id/full', requirePerm('projects', 'read'), (req, res) => {
  const id = req.params.id;
  const project = db.prepare(
    'SELECT p.*, c.name AS client_name, u.name AS owner_name FROM projects p ' +
    'LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.owner_id WHERE p.id = ?'
  ).get(id);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

  const tasks = db.prepare(
    'SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id ' +
    'WHERE t.project_id = ? AND t.deleted_at IS NULL ORDER BY t.due_date'
  ).all(id);
  const members = db.prepare(
    'SELECT pm.*, u.name AS user_name, u.email FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?'
  ).all(id);
  const documents = db.prepare('SELECT * FROM documents WHERE project_id = ? AND deleted_at IS NULL').all(id);
  const incidents = db.prepare('SELECT * FROM incidents WHERE project_id = ? AND deleted_at IS NULL ORDER BY id DESC').all(id);
  const timesheets = db.prepare(
    'SELECT ts.*, u.name AS user_name FROM timesheets ts JOIN users u ON u.id = ts.user_id ' +
    'WHERE ts.project_id = ? AND ts.deleted_at IS NULL ORDER BY ts.date DESC'
  ).all(id);
  const diary = db.prepare(
    'SELECT d.*, u.name AS user_name FROM project_diary d LEFT JOIN users u ON u.id = d.user_id WHERE d.project_id = ? ORDER BY d.date DESC'
  ).all(id);
  const finance = db.prepare('SELECT * FROM finance_entries WHERE project_id = ? AND deleted_at IS NULL ORDER BY due_date').all(id);

  const revenue = finance.filter((f) => f.type === 'receber' && ['recebido', 'pago'].indexOf(f.status) !== -1)
    .reduce((s, f) => s + f.amount, 0);
  const revenueOpen = finance.filter((f) => f.type === 'receber' && ['recebido', 'pago', 'cancelado'].indexOf(f.status) === -1)
    .reduce((s, f) => s + f.amount, 0);
  const cost = finance.filter((f) => f.type === 'pagar' && ['pago'].indexOf(f.status) !== -1)
    .reduce((s, f) => s + f.amount, 0);
  const costOpen = finance.filter((f) => f.type === 'pagar' && ['pago', 'cancelado'].indexOf(f.status) === -1)
    .reduce((s, f) => s + f.amount, 0);

  const profitability = {
    contracted_revenue: project.contracted_revenue,
    budget: project.budget,
    revenue_realized: revenue,
    revenue_open: revenueOpen,
    cost_realized: cost,
    cost_open: costOpen,
    result_estimated: revenue - cost,
    margin_estimated: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 10000) / 100 : 0,
    budget_deviation: project.budget > 0 ? Math.round(((cost - project.budget) / project.budget) * 10000) / 100 : 0
  };

  res.json({ project, tasks, members, documents, incidents, timesheets, diary, finance, profitability });
});

router.post('/:id/members', requirePerm('projects', 'write'), (req, res) => {
  const { user_id, role } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'Informe o usuário' });
  try {
    db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(req.params.id, user_id, role || null);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id/members/:memberId', requirePerm('projects', 'write'), (req, res) => {
  db.prepare('DELETE FROM project_members WHERE id = ? AND project_id = ?').run(req.params.memberId, req.params.id);
  res.json({ ok: true });
});

router.post('/:id/diary', requirePerm('projects', 'write'), (req, res) => {
  const { date, activities, problems, notes } = req.body || {};
  if (!date) return res.status(400).json({ error: 'Informe a data' });
  const info = db.prepare(
    'INSERT INTO project_diary (project_id, date, user_id, activities, problems, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, date, req.user.id, activities || null, problems || null, notes || null);
  logAudit(db, req, 'create', 'project_diary', info.lastInsertRowid, { project_id: req.params.id });
  res.status(201).json({ id: info.lastInsertRowid });
});

module.exports = router;
`);

add('server/routes/tasks.js', `'use strict';
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
`);

add('server/routes/timesheets.js', `'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');

const router = express.Router();

router.get('/', requirePerm('timesheets', 'read'), (req, res) => {
  const where = ['ts.deleted_at IS NULL'];
  const params = {};
  if (req.query.project_id) { where.push('ts.project_id = @project_id'); params.project_id = req.query.project_id; }
  if (req.query.user_id) { where.push('ts.user_id = @user_id'); params.user_id = req.query.user_id; }
  if (req.query.status) { where.push('ts.status = @status'); params.status = req.query.status; }
  if (req.query.from) { where.push('ts.date >= @from'); params.from = req.query.from; }
  if (req.query.to) { where.push('ts.date <= @to'); params.to = req.query.to; }

  const rows = db.prepare(
    'SELECT ts.*, u.name AS user_name, p.name AS project_name FROM timesheets ts ' +
    'LEFT JOIN users u ON u.id = ts.user_id LEFT JOIN projects p ON p.id = ts.project_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY ts.date DESC'
  ).all(params);
  const total = rows.reduce((s, r) => s + r.hours, 0);
  res.json({ data: rows, total, page: 1, limit: rows.length, pages: 1 });
});

router.post('/', requirePerm('timesheets', 'write'), (req, res) => {
  const { project_id, task_id, date, hours, description } = req.body || {};
  if (!date || !hours) return res.status(400).json({ error: 'Informe data e horas' });
  const info = db.prepare(
    'INSERT INTO timesheets (user_id, project_id, task_id, date, hours, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, project_id || null, task_id || null, date, Number(hours), description || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/:id/approve', requirePerm('timesheets', 'write'), (req, res) => {
  if (['admin', 'gestor', 'engenharia'].indexOf(req.user.role) === -1) {
    return res.status(403).json({ error: 'Apenas gestores e engenharia podem aprovar horas' });
  }
  db.prepare("UPDATE timesheets SET status = 'aprovado', approved_by = ?, approved_at = datetime('now') WHERE id = ?")
    .run(req.user.id, req.params.id);
  logAudit(db, req, 'approve', 'timesheet', req.params.id, null);
  res.json({ ok: true });
});

router.delete('/:id', requirePerm('timesheets', 'write'), (req, res) => {
  const row = db.prepare('SELECT * FROM timesheets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Registro não encontrado' });
  if (row.user_id !== req.user.id && ['admin', 'gestor'].indexOf(req.user.role) === -1) {
    return res.status(403).json({ error: 'Você só pode excluir seus próprios lançamentos' });
  }
  db.prepare("UPDATE timesheets SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
`);

add('server/routes/documents.js', `'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');

const router = express.Router();

const STORAGE_ROOT = path.join(__dirname, '..', 'storage', 'documents');
ensure(STORAGE_ROOT);
function ensure(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

const ALLOWED = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.dwg', '.dxf', '.txt', '.csv', '.zip'];
const MAX_SIZE = 25 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sub = path.join(
      String(req.body.client_id || 'geral'),
      String(req.body.project_id || 'geral'),
      String(req.body.category || 'outros')
    );
    const dest = path.join(STORAGE_ROOT, sub);
    ensure(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(10).toString('hex') + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED.indexOf(ext) === -1) return cb(new Error('Extensão de arquivo não permitida: ' + ext));
    cb(null, true);
  }
});

router.get('/', requirePerm('documents', 'read'), (req, res) => {
  const where = ['d.deleted_at IS NULL'];
  const params = {};
  if (req.query.client_id) { where.push('d.client_id = @client_id'); params.client_id = req.query.client_id; }
  if (req.query.project_id) { where.push('d.project_id = @project_id'); params.project_id = req.query.project_id; }
  if (req.query.category) { where.push('d.category = @category'); params.category = req.query.category; }

  const rows = db.prepare(
    'SELECT d.*, c.name AS client_name, p.name AS project_name, u.name AS uploader_name FROM documents d ' +
    'LEFT JOIN clients c ON c.id = d.client_id LEFT JOIN projects p ON p.id = d.project_id ' +
    'LEFT JOIN users u ON u.id = d.uploaded_by WHERE ' + where.join(' AND ') + ' ORDER BY d.id DESC'
  ).all(params);
  res.json({ data: rows, total: rows.length, page: 1, limit: rows.length, pages: 1 });
});

router.post('/', requirePerm('documents', 'write'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie um arquivo' });
  const { client_id, project_id, category, name } = req.body;
  const rel = path.relative(STORAGE_ROOT, req.file.path);

  const info = db.prepare(
    'INSERT INTO documents (client_id, project_id, category, name, filename, stored_path, mime, size, uploaded_by) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    client_id || null, project_id || null, category || 'outros',
    name || req.file.originalname, req.file.originalname, rel,
    req.file.mimetype, req.file.size, req.user.id
  );

  logAudit(db, req, 'upload', 'document', info.lastInsertRowid, { name: req.file.originalname });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/:id/download', requirePerm('documents', 'read'), (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });

  const abs = path.join(STORAGE_ROOT, doc.stored_path);
  if (!abs.startsWith(STORAGE_ROOT)) return res.status(400).json({ error: 'Caminho inválido' });
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Arquivo ausente no armazenamento' });

  logAudit(db, req, 'download', 'document', doc.id, { name: doc.name });
  res.download(abs, doc.filename);
});

router.delete('/:id', requirePerm('documents', 'write'), (req, res) => {
  db.prepare("UPDATE documents SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  logAudit(db, req, 'soft_delete', 'document', req.params.id, null);
  res.json({ ok: true });
});

module.exports = router;
`);

add('server/routes/finance.js', `'use strict';
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
    'FROM finance_entries WHERE deleted_at IS NULL AND status <> \'cancelado\' ' +
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
`);

add('server/routes/suppliers.js', `'use strict';
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');

module.exports = createCrudRouter(db, {
  table: 'suppliers',
  columns: ['name', 'doc', 'email', 'phone', 'address', 'category', 'notes', 'status'],
  searchColumns: ['name', 'doc', 'email'],
  filterColumns: ['status', 'category'],
  readPerm: ['suppliers', 'read'],
  writePerm: ['suppliers', 'write'],
  entity: 'supplier',
  required: ['name']
});
`);

add('server/routes/assets.js', `'use strict';
const express = require('express');
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');
const { requirePerm } = require('../lib/perm');

const router = createCrudRouter(db, {
  table: 'assets',
  columns: ['code', 'patrimony', 'name', 'category', 'state', 'location', 'responsible_id', 'project_id', 'acquisition_value', 'notes'],
  searchColumns: ['code', 'patrimony', 'name', 'location'],
  filterColumns: ['state', 'category', 'project_id'],
  readPerm: ['assets', 'read'],
  writePerm: ['assets', 'write'],
  entity: 'asset',
  required: ['name', 'code']
});

router.get('/:id/maintenance', requirePerm('assets', 'read'), (req, res) => {
  res.json({ data: db.prepare('SELECT * FROM asset_maintenance WHERE asset_id = ? ORDER BY date DESC').all(req.params.id) });
});

router.post('/:id/maintenance', requirePerm('assets', 'write'), (req, res) => {
  const { date, type, description, cost, status } = req.body || {};
  if (!date) return res.status(400).json({ error: 'Informe a data' });
  const info = db.prepare(
    'INSERT INTO asset_maintenance (asset_id, date, type, description, cost, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, date, type || null, description || null, Number(cost) || 0, status || 'aberta');
  if (status === 'concluida') {
    db.prepare("UPDATE assets SET state = 'disponivel' WHERE id = ?").run(req.params.id);
  } else {
    db.prepare("UPDATE assets SET state = 'manutencao' WHERE id = ?").run(req.params.id);
  }
  res.status(201).json({ id: info.lastInsertRowid });
});

module.exports = router;
`);

add('server/routes/incidents.js', `'use strict';
const express = require('express');
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');
const { requirePerm } = require('../lib/perm');
const { logAudit } = require('../lib/audit');

const router = createCrudRouter(db, {
  table: 'incidents',
  columns: ['project_id', 'date', 'type', 'severity', 'responsible_id', 'description', 'resolution', 'resolved_by', 'status'],
  searchColumns: ['description', 'type'],
  filterColumns: ['status', 'severity', 'project_id'],
  dateColumn: 'date',
  readPerm: ['incidents', 'read'],
  writePerm: ['incidents', 'write'],
  entity: 'incident',
  required: ['description', 'date']
});

router.get('/:id/events', requirePerm('incidents', 'read'), (req, res) => {
  res.json({
    data: db.prepare(
      'SELECT e.*, u.name AS user_name FROM incident_events e LEFT JOIN users u ON u.id = e.user_id ' +
      'WHERE e.incident_id = ? ORDER BY e.id DESC'
    ).all(req.params.id)
  });
});

router.post('/:id/resolve', requirePerm('incidents', 'write'), (req, res) => {
  const { resolution } = req.body || {};
  db.prepare("UPDATE incidents SET status = 'resolvida', resolution = ?, resolved_by = ?, updated_at = datetime('now') WHERE id = ?")
    .run(resolution || null, req.user.id, req.params.id);
  db.prepare('INSERT INTO incident_events (incident_id, user_id, note, status) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.user.id, resolution || 'Ocorrência resolvida', 'resolvida');
  logAudit(db, req, 'resolve', 'incident', req.params.id, null);
  res.json({ ok: true });
});

module.exports = router;
`);

add('server/routes/calendar.js', `'use strict';
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');

module.exports = createCrudRouter(db, {
  table: 'calendar_events',
  columns: ['title', 'type', 'start_at', 'end_at', 'project_id', 'client_id', 'user_id', 'notes'],
  searchColumns: ['title', 'notes'],
  filterColumns: ['type', 'project_id', 'client_id', 'user_id'],
  dateColumn: 'start_at',
  readPerm: ['calendar', 'read'],
  writePerm: ['calendar', 'write'],
  entity: 'calendar_event',
  required: ['title', 'start_at']
});
`);

add('server/routes/notifications.js', `'use strict';
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
`);

add('server/routes/dashboard.js', `'use strict';
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
`);

add('server/routes/reports.js', `'use strict';
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
`);

add('server/routes/audit.js', `'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');

const router = express.Router();

router.get('/', requirePerm('audit', 'read'), (req, res) => {
  const where = ['1=1'];
  const params = {};
  if (req.query.entity) { where.push('a.entity = @entity'); params.entity = req.query.entity; }
  if (req.query.user_id) { where.push('a.user_id = @user_id'); params.user_id = req.query.user_id; }
  if (req.query.q) { where.push('(a.action LIKE @q OR a.entity LIKE @q)'); params.q = '%' + req.query.q + '%'; }

  const limit = Math.min(500, parseInt(req.query.limit || '100', 10));
  const rows = db.prepare(
    'SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ' +
    'WHERE ' + where.join(' AND ') + ' ORDER BY a.id DESC LIMIT ' + limit
  ).all(params);
  res.json({ data: rows, total: rows.length, page: 1, limit, pages: 1 });
});

module.exports = router;
`);

add('server/routes/search.js', `'use strict';
const express = require('express');
const db = require('../db');
const { requirePerm } = require('../lib/perm');

const router = express.Router();

router.get('/', requirePerm('search', 'read'), (req, res) => {
  const q = '%' + (req.query.q || '') + '%';
  if (!req.query.q) return res.json({ clients: [], projects: [], proposals: [], contracts: [], tasks: [] });

  res.json({
    clients: db.prepare("SELECT id, name FROM clients WHERE deleted_at IS NULL AND (name LIKE ? OR doc LIKE ?) LIMIT 6").all(q, q),
    projects: db.prepare("SELECT id, code, name FROM projects WHERE deleted_at IS NULL AND (name LIKE ? OR code LIKE ?) LIMIT 6").all(q, q),
    proposals: db.prepare("SELECT id, number, service FROM proposals WHERE deleted_at IS NULL AND (number LIKE ? OR service LIKE ?) LIMIT 6").all(q, q),
    contracts: db.prepare("SELECT id, number FROM contracts WHERE deleted_at IS NULL AND number LIKE ? LIMIT 6").all(q),
    tasks: db.prepare("SELECT id, title FROM tasks WHERE deleted_at IS NULL AND title LIKE ? LIMIT 6").all(q)
  });
});

module.exports = router;
`);

/* ==============================================================
 * 5. TESTES
 * ============================================================== */

add('server/tests/api.test.js', `'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vetec-test-'));
process.env.DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.ADMIN_EMAIL = 'admin@teste.local';
process.env.ADMIN_PASSWORD = 'SenhaDeTeste123';

const app = require('../app');
const db = require('../db');
const { ensureAdmin } = require('../bootstrap');

ensureAdmin(db);

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = 'http://127.0.0.1:' + server.address().port;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((r) => server.close(r));
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
});

async function call(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(base + url, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, body: json, text };
}

let adminToken;

test('login com credenciais válidas', async () => {
  const r = await call('POST', '/api/auth/login', { email: 'admin@teste.local', password: 'SenhaDeTeste123' });
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.token);
  adminToken = r.body.token;
});

test('login com senha inválida é rejeitado', async () => {
  const r = await call('POST', '/api/auth/login', { email: 'admin@teste.local', password: 'errada' });
  assert.strictEqual(r.status, 401);
});

test('rota protegida sem token retorna 401', async () => {
  const r = await call('GET', '/api/clients');
  assert.strictEqual(r.status, 401);
});

test('criação de cliente e persistência', async () => {
  const r = await call('POST', '/api/clients', { name: 'Cliente Teste', type: 'PJ' }, adminToken);
  assert.strictEqual(r.status, 201);
  const list = await call('GET', '/api/clients', null, adminToken);
  assert.ok(list.body.data.some((c) => c.name === 'Cliente Teste'));
});

test('oportunidade e mudança de etapa', async () => {
  const client = await call('POST', '/api/clients', { name: 'Cliente CRM' }, adminToken);
  const opp = await call('POST', '/api/opportunities', {
    title: 'Oportunidade teste', client_id: client.body.id, value: 1000
  }, adminToken);
  assert.strictEqual(opp.status, 201);
  const stage = await call('POST', '/api/opportunities/' + opp.body.id + '/stage', { stage: 'negociacao' }, adminToken);
  assert.strictEqual(stage.status, 200);
});

test('proposta, aprovação e vínculo financeiro', async () => {
  const client = await call('POST', '/api/clients', { name: 'Cliente Proposta' }, adminToken);
  const prop = await call('POST', '/api/proposals', {
    client_id: client.body.id,
    service: 'Laudo técnico',
    items: [{ desc: 'Laudo', qty: 2, unit: 500 }],
    discount: 0,
    taxes: 0
  }, adminToken);
  assert.strictEqual(prop.status, 201);
  assert.strictEqual(prop.body.total, 1000);

  const approve = await call('POST', '/api/proposals/' + prop.body.id + '/approve', {}, adminToken);
  assert.strictEqual(approve.status, 200);

  const fin = await call('POST', '/api/proposals/' + prop.body.id + '/generate-receivable', { confirm: true }, adminToken);
  assert.strictEqual(fin.status, 201);

  const dup = await call('POST', '/api/proposals/' + prop.body.id + '/generate-receivable', { confirm: true }, adminToken);
  assert.strictEqual(dup.status, 409);
});

test('contrato e projeto relacionados', async () => {
  const client = await call('POST', '/api/clients', { name: 'Cliente Contrato' }, adminToken);
  const project = await call('POST', '/api/projects', { name: 'Projeto Teste', client_id: client.body.id }, adminToken);
  const contract = await call('POST', '/api/contracts', {
    client_id: client.body.id, project_id: project.body.id, value: 5000
  }, adminToken);
  assert.strictEqual(contract.status, 201);
  const updated = await call('GET', '/api/projects/' + project.body.id + '/full', null, adminToken);
  assert.strictEqual(updated.body.project.contract_id, contract.body.id);
});

test('permissões: colaborador não acessa financeiro', async () => {
  const created = await call('POST', '/api/users', {
    name: 'Colaborador Teste', email: 'colab@teste.local', password: 'SenhaForte123', role: 'colaborador'
  }, adminToken);
  assert.strictEqual(created.status, 201);

  const login = await call('POST', '/api/auth/login', { email: 'colab@teste.local', password: 'SenhaForte123' });
  assert.strictEqual(login.status, 200);

  const fin = await call('GET', '/api/finance', null, login.body.token);
  assert.strictEqual(fin.status, 403);
});

test('dados persistem após reabrir o banco', async () => {
  const rows = db.prepare('SELECT COUNT(*) AS c FROM clients').get();
  assert.ok(rows.c > 0);
  const file = path.join(tmpDir, 'vetec.db');
  assert.ok(fs.existsSync(file));
});
`);

add('server/storage/documents/.gitkeep', '');

/* ==============================================================
 * 6. FRONTEND
 * ============================================================== */

add('client/index.html', `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0f2233" />
    <title>VETEC ERP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`);

add('client/src/main.jsx', `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { ToastProvider } from './ui.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
`);

add('client/src/api.js', `let token = localStorage.getItem('vetec_token') || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('vetec_token', t);
  else localStorage.removeItem('vetec_token');
}

export function getToken() { return token; }

function qs(params) {
  if (!params) return '';
  const parts = [];
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (v === undefined || v === null || v === '') continue;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
  }
  return parts.length ? '?' + parts.join('&') : '';
}

async function request(method, url, body, isForm) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch('/api' + url, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }

  if (!res.ok) {
    const err = new Error((data && data.error) || 'Erro ' + res.status);
    err.status = res.status;
    if (res.status === 401 && !url.startsWith('/auth/login')) {
      window.dispatchEvent(new CustomEvent('vetec:unauthorized'));
    }
    throw err;
  }
  return data;
}

export const api = {
  get: (url, params) => request('GET', url + qs(params)),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
  upload: (url, formData) => request('POST', url, formData, true),
  downloadUrl: (url) => '/api' + url
};
`);

add('client/src/auth.jsx', `import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onUnauthorized = () => { setToken(null); setUser(null); };
    window.addEventListener('vetec:unauthorized', onUnauthorized);
    return () => window.removeEventListener('vetec:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    (async () => {
      if (!getToken()) { setLoading(false); return; }
      try {
        const me = await api.get('/auth/me');
        setUser(me);
      } catch (e) {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }

  async function logout() {
    try { await api.post('/auth/logout', {}); } catch (e) {}
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}

const PERMS = {
  admin: ['*'],
  gestor: ['clients:*','crm:*','proposals:*','contracts:*','projects:*','tasks:*','team:*','timesheets:*','documents:*','finance:*','suppliers:*','assets:*','incidents:*','calendar:*','reports:read','audit:read','users:read','notifications:*','dashboard:read','search:read'],
  comercial: ['clients:*','crm:*','proposals:*','contracts:read','contracts:write','projects:read','finance:read','reports:read','dashboard:read','documents:*','calendar:*','notifications:*','tasks:read','timesheets:read','team:read','search:read','suppliers:read','incidents:read'],
  engenharia: ['projects:*','tasks:*','incidents:*','documents:*','timesheets:*','assets:read','assets:write','clients:read','contracts:read','suppliers:read','finance:read','dashboard:read','calendar:*','notifications:*','team:read','reports:read','search:read','crm:read','proposals:read'],
  financeiro: ['finance:*','suppliers:*','contracts:read','clients:read','proposals:read','projects:read','reports:read','dashboard:read','documents:read','notifications:*','calendar:*','assets:read','timesheets:read','search:read','crm:read','tasks:read','team:read'],
  colaborador: ['tasks:read','tasks:write','timesheets:read','timesheets:write','projects:read','documents:read','incidents:read','incidents:write','dashboard:read','calendar:read','notifications:*','clients:read','search:read','team:read']
};

export function can(user, mod, action) {
  if (!user) return false;
  const list = PERMS[user.role] || [];
  if (list.indexOf('*') !== -1) return true;
  return list.indexOf(mod + ':*') !== -1 || list.indexOf(mod + ':' + action) !== -1;
}
`);

add('client/src/lookups.jsx', `import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const LookupContext = createContext(null);

export function LookupProvider({ children }) {
  const [state, setState] = useState({
    clients: [], users: [], projects: [], suppliers: [], categories: [], methods: [], contracts: [], opportunities: []
  });

  async function reload() {
    const safe = async (fn, fallback) => { try { return await fn(); } catch (e) { return fallback; } };
    const [clients, users, projects, suppliers, categories, methods, contracts, opportunities, proposals] = await Promise.all([
      safe(() => api.get('/clients', { limit: 200 }), { data: [] }),
      safe(() => api.get('/users'), { data: [] }),
      safe(() => api.get('/projects'), { data: [] }),
      safe(() => api.get('/suppliers', { limit: 200 }), { data: [] }),
      safe(() => api.get('/finance/categories'), { data: [] }),
      safe(() => api.get('/finance/payment-methods'), { data: [] }),
      safe(() => api.get('/contracts'), { data: [] }),
      safe(() => api.get('/opportunities'), { data: [] }),
      safe(() => api.get('/proposals'), { data: [] })
    ]);
    setState({
      clients: clients.data || [],
      users: users.data || [],
      projects: projects.data || [],
      suppliers: suppliers.data || [],
      categories: categories.data || [],
      methods: methods.data || [],
      contracts: contracts.data || [],
      opportunities: opportunities.data || [],
      proposals: proposals.data || []
    });
  }

  useEffect(() => { reload(); }, []);

  return (
    <LookupContext.Provider value={{ ...state, reload }}>
      {children}
    </LookupContext.Provider>
  );
}

export function useLookups() {
  return useContext(LookupContext) || {
    clients: [], users: [], projects: [], suppliers: [], categories: [],
    methods: [], contracts: [], opportunities: [], proposals: [], reload: () => {}
  };
}
`);

add('client/src/ui.jsx', `import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { useLookups } from './lookups.jsx';

/* ---------------- Toasts ---------------- */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, kind) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => prev.concat([{ id, message, kind: kind || 'info' }]));
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ success: (m) => push(m, 'success'), error: (m) => push(m, 'error'), info: (m) => push(m, 'info') }}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} className={'toast toast-' + t.kind}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) || { success: () => {}, error: () => {}, info: () => {} };
}

/* ---------------- Componentes básicos ---------------- */
export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section className={'card ' + (className || '')}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Badge({ value }) {
  const map = {
    ativo: 'ok', concluido: 'ok', aprovada: 'ok', ganho: 'ok', recebido: 'ok', pago: 'ok',
    pago_: 'ok', resolvida: 'ok', disponivel: 'ok',
    vencido: 'danger', perdido: 'danger', atrasado: 'danger', cancelado: 'muted', inativo: 'muted',
    em_andamento: 'info', enviada: 'info', negociacao: 'info', em_negociacao: 'info',
    pendente: 'warn', em_aberto: 'warn', previsto: 'warn', rascunho: 'muted', aberta: 'danger',
    manutencao: 'warn', planejamento: 'info', em_pausa: 'warn', recusada: 'danger', expirada: 'danger'
  };
  const cls = map[value] || 'muted';
  const label = String(value || '').replace(/_/g, ' ');
  return <span className={'badge badge-' + cls}>{label}</span>;
}

export function Spinner() {
  return <div className="spinner" aria-label="Carregando" />;
}

export function Empty({ title, hint, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">▤</div>
      <h4>{title || 'Nenhum registro encontrado'}</h4>
      {hint && <p className="muted small">{hint}</p>}
      {action}
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal ' + (wide ? 'modal-wide' : '')}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------------- Campos de formulário ---------------- */
export function Field({ field, value, onChange }) {
  const lookups = useLookups();

  const optionsFrom = (src) => {
    if (!src) return [];
    const map = {
      clients: [lookups.clients, 'name'],
      users: [lookups.users, 'name'],
      projects: [lookups.projects, 'name'],
      suppliers: [lookups.suppliers, 'name'],
      categories: [lookups.categories, 'name'],
      methods: [lookups.methods, 'name'],
      contracts: [lookups.contracts, 'number'],
      opportunities: [lookups.opportunities, 'title'],
      proposals: [lookups.proposals, 'number']
    };
    const entry = map[src];
    if (!entry) return [];
    return (entry[0] || []).map((o) => ({ value: o.id, label: o[entry[1]] || ('#' + o.id) }));
  };

  const opts = field.optionsFrom
    ? optionsFrom(field.optionsFrom)
    : (field.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o.replace(/_/g, ' ') } : o));

  const common = {
    id: 'f-' + field.key,
    name: field.key,
    value: value === undefined || value === null ? '' : value,
    required: !!field.required,
    disabled: !!field.readOnly,
    onChange: (e) => onChange(field.key, field.type === 'number' ? e.target.value : e.target.value)
  };

  return (
    <div className={'field ' + (field.full ? 'field-full' : '')}>
      <label htmlFor={common.id}>{field.label}{field.required ? ' *' : ''}</label>

      {field.type === 'textarea' && (
        <textarea {...common} rows={field.rows || 3} placeholder={field.placeholder || ''} />
      )}

      {field.type === 'select' && (
        <select {...common}>
          <option value="">— selecione —</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      {field.type === 'checkbox' && (
        <input
          id={common.id}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(field.key, e.target.checked)}
        />
      )}

      {(!field.type || field.type === 'text' || field.type === 'number' || field.type === 'date' ||
        field.type === 'datetime-local' || field.type === 'email' || field.type === 'password') && (
        <input
          {...common}
          type={field.type || 'text'}
          step={field.type === 'number' ? 'any' : undefined}
          placeholder={field.placeholder || ''}
        />
      )}

      {field.hint && <small className="muted">{field.hint}</small>}
    </div>
  );
}

/* ---------------- Tabela ---------------- */
export function DataTable({ columns, rows, loading, empty, onRowClick, actions }) {
  if (loading) return <div className="table-loading"><Spinner /></div>;
  if (!rows || rows.length === 0) return empty || <Empty />;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
            {actions && <th className="col-actions">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={onRowClick ? 'clickable' : ''}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(r) : (r[c.key] === null || r[c.key] === undefined ? <span className="muted">—</span> : r[c.key])}
                </td>
              ))}
              {actions && <td className="col-actions" onClick={(e) => e.stopPropagation()}>{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, total, onPage }) {
  if (!pages || pages <= 1) return <div className="muted small">{total || 0} registro(s)</div>;
  return (
    <div className="pagination">
      <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <span className="small">Página {page} de {pages} · {total} registros</span>
      <button className="btn btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Próxima</button>
    </div>
  );
}

export function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dateBR(v) {
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return s;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}
`);

add('client/src/components/Resource.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, Pagination, useToast, Empty, money, dateBR } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

export default function Resource({
  title, subtitle, endpoint, perm, columns, fields, filters,
  canWrite, defaults, rowActions, createLabel
}) {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const allowed = canWrite !== undefined ? canWrite : can(user, perm || 'clients', 'write');

  async function load() {
    setLoading(true);
    try {
      const params = Object.assign({ page, limit: 25, q }, filterValues);
      const res = await api.get(endpoint, params);
      setRows(res.data || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, q, JSON.stringify(filterValues)]);

  function openCreate() {
    setForm(Object.assign({}, defaults || {}));
    setEditing({});
  }

  function openEdit(row) {
    setForm(Object.assign({}, row));
    setEditing(row);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = Object.assign({}, form);
      for (const f of fields) {
        if (f.type === 'number' && payload[f.key] !== '' && payload[f.key] !== undefined && payload[f.key] !== null) {
          payload[f.key] = Number(payload[f.key]);
        }
        if (payload[f.key] === '') payload[f.key] = null;
      }
      if (editing && editing.id) {
        await api.put(endpoint + '/' + editing.id, payload);
        toast.success('Registro atualizado');
      } else {
        await api.post(endpoint, payload);
        toast.success('Registro criado');
      }
      setEditing(null);
      load();
      if (lookups.reload) lookups.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!window.confirm('Confirma a exclusão deste registro?')) return;
    try {
      await api.del(endpoint + '/' + row.id);
      toast.success('Registro excluído');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  function setField(key, value) {
    setForm((prev) => Object.assign({}, prev, { [key]: value }));
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {allowed && (
          <button className="btn btn-primary" onClick={openCreate}>
            + {createLabel || 'Novo'}
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Pesquisar..."
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
        />
        {filters && filters.map((f) => (
          <select
            key={f.key}
            className="filter"
            value={filterValues['f_' + f.key] || ''}
            onChange={(e) => {
              setPage(1);
              setFilterValues((prev) => Object.assign({}, prev, { ['f_' + f.key]: e.target.value }));
            }}
          >
            <option value="">{f.label}: todos</option>
            {(f.options || []).map((o) => {
              const val = typeof o === 'string' ? o : o.value;
              const label = typeof o === 'string' ? o.replace(/_/g, ' ') : o.label;
              return <option key={val} value={val}>{label}</option>;
            })}
          </select>
        ))}
        <div className="spacer" />
        <span className="muted small">{total} registro(s)</span>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        empty={<Empty title="Nada por aqui" hint="Use o botão acima para criar o primeiro registro." />}
        onRowClick={allowed ? openEdit : undefined}
        actions={(r) => (
          <div className="row-actions">
            {allowed && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Editar</button>}
            {rowActions && rowActions(r, { reload: load })}
            {allowed && <button className="btn btn-ghost btn-sm danger" onClick={() => remove(r)}>Excluir</button>}
          </div>
        )}
      />

      <Pagination page={page} pages={pages} total={total} onPage={setPage} />

      {editing && (
        <Modal
          title={(editing.id ? 'Editar ' : 'Novo ') + title}
          onClose={() => setEditing(null)}
          wide={fields.length > 6}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            {fields.map((f) => (
              <Field key={f.key} field={f} value={form[f.key]} onChange={setField} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

export { money, dateBR };
`);

add('client/src/App.jsx', `import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { LookupProvider } from './lookups.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Crm from './pages/Crm.jsx';
import Proposals from './pages/Proposals.jsx';
import Contracts from './pages/Contracts.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Tasks from './pages/Tasks.jsx';
import Team from './pages/Team.jsx';
import Timesheets from './pages/Timesheets.jsx';
import Documents from './pages/Documents.jsx';
import Finance from './pages/Finance.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Assets from './pages/Assets.jsx';
import Incidents from './pages/Incidents.jsx';
import CalendarPage from './pages/Calendar.jsx';
import Reports from './pages/Reports.jsx';
import Audit from './pages/Audit.jsx';
import Users from './pages/Users.jsx';
import { Spinner } from './ui.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="boot"><Spinner /><p className="muted">Carregando VETEC ERP...</p></div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <LookupProvider>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/crm" element={<Crm />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/team" element={<Team />} />
          <Route path="/timesheets" element={<Timesheets />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/users" element={<Users />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LookupProvider>
  );
}
`);

add('client/src/components/Layout.jsx', `import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth, can } from '../auth.jsx';
import { api } from '../api.js';

const NAV = [
  { section: 'Visão geral', items: [
    { to: '/', label: 'Dashboard', icon: '◧', perm: ['dashboard', 'read'] }
  ]},
  { section: 'Comercial', items: [
    { to: '/clients', label: 'Clientes', icon: '◉', perm: ['clients', 'read'] },
    { to: '/crm', label: 'CRM / Oportunidades', icon: '◈', perm: ['crm', 'read'] },
    { to: '/proposals', label: 'Propostas', icon: '▤', perm: ['proposals', 'read'] },
    { to: '/contracts', label: 'Contratos', icon: '▦', perm: ['contracts', 'read'] }
  ]},
  { section: 'Operações', items: [
    { to: '/projects', label: 'Projetos e obras', icon: '◆', perm: ['projects', 'read'] },
    { to: '/tasks', label: 'Tarefas', icon: '☑', perm: ['tasks', 'read'] },
    { to: '/timesheets', label: 'Horas', icon: '◔', perm: ['timesheets', 'read'] },
    { to: '/incidents', label: 'Ocorrências', icon: '⚠', perm: ['incidents', 'read'] },
    { to: '/documents', label: 'Documentos', icon: '▣', perm: ['documents', 'read'] }
  ]},
  { section: 'Financeiro', items: [
    { to: '/finance', label: 'Financeiro', icon: '◫', perm: ['finance', 'read'] },
    { to: '/suppliers', label: 'Fornecedores', icon: '⌂', perm: ['suppliers', 'read'] },
    { to: '/assets', label: 'Equipamentos', icon: '⚙', perm: ['assets', 'read'] }
  ]},
  { section: 'Organização', items: [
    { to: '/team', label: 'Equipe', icon: '☺', perm: ['team', 'read'] },
    { to: '/calendar', label: 'Calendário', icon: '▩', perm: ['calendar', 'read'] },
    { to: '/reports', label: 'Relatórios', icon: '≣', perm: ['reports', 'read'] },
    { to: '/audit', label: 'Auditoria', icon: '⛨', perm: ['audit', 'read'] },
    { to: '/users', label: 'Usuários', icon: '☰', perm: ['team', 'write'] }
  ]}
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => { setSidebarOpen(false); setShowNotif(false); }, [location.pathname]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await api.get('/notifications');
        if (active) setNotifications(res.data || []);
      } catch (e) { /* silencioso */ }
    }
    load();
    const t = setInterval(load, 60000);
    return () => { active = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!search || search.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/search', { q: search });
        setResults(res);
      } catch (e) { setResults(null); }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all', {});
      setNotifications([]);
    } catch (e) {}
  }

  const crumbs = location.pathname.split('/').filter(Boolean);

  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (sidebarOpen ? 'open' : '')}>
        <div className="brand">
          <div className="brand-mark">VT</div>
          <div>
            <strong>VETEC</strong>
            <span className="brand-sub">Engenharia · ERP</span>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((group) => {
            const items = group.items.filter((i) => can(user, i.perm[0], i.perm[1]));
            if (!items.length) return null;
            return (
              <div key={group.section} className="nav-group">
                <div className="nav-section">{group.section}</div>
                {items.map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.to === '/'}
                    className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
                  >
                    <span className="nav-icon">{i.icon}</span>
                    {i.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{(user.name || '?').slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <span className="muted small">{user.role}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>
            Sair
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setSidebarOpen((v) => !v)} aria-label="Menu">☰</button>

          <div className="global-search">
            <input
              placeholder="Buscar clientes, projetos, propostas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {results && (
              <div className="search-results">
                {['clients', 'projects', 'proposals', 'contracts', 'tasks'].map((key) => {
                  const list = results[key] || [];
                  if (!list.length) return null;
                  const label = { clients: 'Clientes', projects: 'Projetos', proposals: 'Propostas', contracts: 'Contratos', tasks: 'Tarefas' }[key];
                  return (
                    <div key={key} className="search-group">
                      <div className="search-group-title">{label}</div>
                      {list.map((r) => (
                        <button
                          key={key + r.id}
                          className="search-item"
                          onClick={() => {
                            setSearch(''); setResults(null);
                            if (key === 'clients') navigate('/clients/' + r.id);
                            else if (key === 'projects') navigate('/projects/' + r.id);
                            else if (key === 'proposals') navigate('/proposals');
                            else if (key === 'contracts') navigate('/contracts');
                            else navigate('/tasks');
                          }}
                        >
                          {r.name || r.title || r.number || r.service}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {Object.values(results).every((v) => !v || v.length === 0) && (
                  <div className="search-item muted">Nenhum resultado</div>
                )}
              </div>
            )}
          </div>

          <div className="topbar-actions">
            <div className="notif-wrap">
              <button className="icon-btn" onClick={() => setShowNotif((v) => !v)} aria-label="Notificações">
                ◔ {notifications.length > 0 && <span className="dot">{notifications.length}</span>}
              </button>
              {showNotif && (
                <div className="notif-panel">
                  <div className="notif-head">
                    <strong>Notificações</strong>
                    {notifications.length > 0 && (
                      <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Marcar lidas</button>
                    )}
                  </div>
                  {notifications.length === 0 && <p className="muted small" style={{ padding: 16 }}>Nada por aqui.</p>}
                  {notifications.map((n) => (
                    <div key={n.id} className={'notif-item notif-' + n.kind}>
                      <strong>{n.title}</strong>
                      <p className="small">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="avatar small">{(user.name || '?').slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        <div className="breadcrumbs">
          <Link to="/">Início</Link>
          {crumbs.map((c, i) => (
            <span key={i}> / {c}</span>
          ))}
        </div>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
`);

add('client/src/pages/Login.jsx', `import React, { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand login-brand">
          <div className="brand-mark">VT</div>
          <div>
            <strong>VETEC</strong>
            <span className="brand-sub">Engenharia · ERP</span>
          </div>
        </div>

        <h1>Acessar o sistema</h1>
        <p className="muted small">Use as credenciais fornecidas pelo administrador.</p>

        <form onSubmit={submit} className="login-form">
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="muted small login-foot">
          Acesso restrito. Todas as operações são registradas em auditoria.
        </p>
      </div>
    </div>
  );
}
`);

add('client/src/pages/Dashboard.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Spinner, money, dateBR, Badge, useToast } from '../ui.jsx';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#1d6fa5', '#2fa27a', '#d97706', '#b91c1c', '#6b7280', '#7c3aed', '#0891b2', '#be123c'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/summary', { from, to });
      setData(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [from, to]);

  if (loading && !data) return <div className="page"><Spinner /></div>;
  if (!data) return null;

  const k = data.kpis;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard executivo</h1>
          <p className="muted">Indicadores calculados a partir dos dados registrados.</p>
        </div>
        <div className="toolbar-inline">
          <input className="filter" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="muted small">até</span>
          <input className="filter" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>Limpar</button>}
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi label="Receita recebida" value={money(k.revenueReceived)} tone="ok" />
        <Kpi label="Receitas previstas" value={money(k.revenueExpected)} tone="info" />
        <Kpi label="Despesas pagas" value={money(k.expensesPaid)} tone="danger" />
        <Kpi label="Despesas previstas" value={money(k.expensesExpected)} tone="warn" />
        <Kpi label="Saldo (recebido - pago)" value={money(k.balance)} tone={k.balance >= 0 ? 'ok' : 'danger'} />
        <Kpi label="Projetos ativos" value={k.activeProjects} tone="info" />
        <Kpi label="Projetos atrasados" value={k.lateProjects} tone={k.lateProjects ? 'danger' : 'ok'} />
        <Kpi label="Clientes ativos" value={k.activeClients} tone="info" />
        <Kpi label="Propostas em aberto" value={k.openProposals} tone="info" />
        <Kpi label="Conversão comercial" value={k.conversionRate + '%'} tone="info" />
        <Kpi label="Tarefas pendentes" value={k.pendingTasks} tone="warn" />
      </div>

      <div className="chart-grid">
        <Card title="Receitas e despesas por mês">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.charts.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6eaef" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => money(v)} />
              <Legend />
              <Bar dataKey="revenue" name="Receitas" fill="#2fa27a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="#b91c1c" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Resultado financeiro mensal">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.charts.monthly.map((m) => ({ month: m.month, result: (m.revenue || 0) - (m.expense || 0) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6eaef" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => money(v)} />
              <Line type="monotone" dataKey="result" name="Resultado" stroke="#1d6fa5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Projetos por status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.charts.projectsByStatus} dataKey="count" nameKey="status" outerRadius={90} label>
                {data.charts.projectsByStatus.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Propostas por etapa">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.charts.proposalsByStage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e6eaef" />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="status" width={110} fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" name="Propostas" fill="#1d6fa5" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Receita por cliente">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.charts.revenueByClient} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e6eaef" />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="client" width={140} fontSize={11} />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="total" name="Receita" fill="#2fa27a" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Custos por projeto">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.charts.costsByProject} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e6eaef" />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="project" width={140} fontSize={11} />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="total" name="Custos" fill="#b91c1c" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="chart-grid">
        <AlertCard title="Contas vencidas" items={data.alerts.overdueAccounts.map((a) => ({
          key: a.id, text: a.description, meta: money(a.amount) + ' · ' + dateBR(a.due_date)
        }))} />
        <AlertCard title="Projetos atrasados" items={data.alerts.lateProjects.map((p) => ({
          key: p.id, text: p.code + ' — ' + p.name, meta: 'prazo ' + dateBR(p.due_date)
        }))} />
        <AlertCard title="Tarefas vencidas" items={data.alerts.overdueTasks.map((t) => ({
          key: t.id, text: t.title, meta: 'prazo ' + dateBR(t.due_date)
        }))} />
        <AlertCard title="Propostas vencendo" items={data.alerts.expiringProposals.map((p) => ({
          key: p.id, text: p.number, meta: 'válida até ' + dateBR(p.valid_until)
        }))} />
        <AlertCard title="Contratos vencendo" items={data.alerts.expiringContracts.map((c) => ({
          key: c.id, text: c.number, meta: 'término ' + dateBR(c.end_date)
        }))} />
        <AlertCard title="Projetos acima do orçamento" items={data.alerts.overBudgetProjects.map((p) => ({
          key: p.id, text: p.name, meta: 'orçamento ' + money(p.budget) + ' · custo ' + money(p.cost)
        }))} />
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className={'kpi kpi-' + (tone || 'info')}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
    </div>
  );
}

function AlertCard({ title, items }) {
  return (
    <Card title={title}>
      {items.length === 0 && <p className="muted small">Nenhum alerta.</p>}
      <ul className="alert-list">
        {items.map((i) => (
          <li key={i.key}>
            <span>{i.text}</span>
            <span className="muted small">{i.meta}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
`);

add('client/src/pages/Clients.jsx', `import React from 'react';
import { useNavigate } from 'react-router-dom';
import Resource from '../components/Resource.jsx';
import { Badge } from '../ui.jsx';

export default function Clients() {
  const navigate = useNavigate();

  return (
    <Resource
      title="Clientes"
      subtitle="Pessoas físicas e jurídicas atendidas pela VETEC."
      endpoint="/clients"
      perm="clients"
      createLabel="Novo cliente"
      filters={[
        { key: 'status', label: 'Status', options: ['ativo', 'inativo', 'prospect'] },
        { key: 'type', label: 'Tipo', options: [{ value: 'PF', label: 'Pessoa física' }, { value: 'PJ', label: 'Pessoa jurídica' }] }
      ]}
      columns={[
        { key: 'name', label: 'Nome / Razão social', render: (r) => (
          <a className="link" onClick={(e) => { e.stopPropagation(); navigate('/clients/' + r.id); }}>{r.name}</a>
        )},
        { key: 'doc', label: 'CPF/CNPJ' },
        { key: 'city', label: 'Cidade' },
        { key: 'state', label: 'UF', width: 60 },
        { key: 'phone', label: 'Telefone' },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> }
      ]}
      fields={[
        { key: 'type', label: 'Tipo', type: 'select', options: [{ value: 'PF', label: 'Pessoa física' }, { value: 'PJ', label: 'Pessoa jurídica' }] },
        { key: 'name', label: 'Nome / Razão social', required: true },
        { key: 'trade_name', label: 'Nome fantasia' },
        { key: 'doc', label: 'CPF / CNPJ' },
        { key: 'phone', label: 'Telefone' },
        { key: 'whatsapp', label: 'WhatsApp' },
        { key: 'email', label: 'E-mail', type: 'email' },
        { key: 'website', label: 'Site' },
        { key: 'zip', label: 'CEP' },
        { key: 'address', label: 'Endereço' },
        { key: 'city', label: 'Cidade' },
        { key: 'state', label: 'Estado' },
        { key: 'segment', label: 'Segmento' },
        { key: 'owner_id', label: 'Responsável interno', type: 'select', optionsFrom: 'users' },
        { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo', 'prospect'] },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true }
      ]}
      defaults={{ type: 'PJ', status: 'ativo' }}
    />
  );
}
`);

add('client/src/pages/ClientDetail.jsx', `import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Spinner, Badge, money, dateBR, useToast, Empty } from '../ui.jsx';

const TABS = ['Resumo', 'Contatos', 'Leads', 'Oportunidades', 'Propostas', 'Contratos', 'Projetos', 'Documentos', 'Financeiro', 'Histórico'];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('Resumo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/clients/' + id + '/full');
        setData(res);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="page"><Spinner /></div>;
  if (!data) return <div className="page"><Empty title="Cliente não encontrado" /></div>;

  const c = data.client;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')}>← Clientes</button>
          <h1>{c.name}</h1>
          <p className="muted">{c.trade_name || c.segment || '—'} · <Badge value={c.status} /></p>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={'tab ' + (tab === t ? 'active' : '')} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Resumo' && (
        <div className="two-col">
          <Card title="Dados cadastrais">
            <dl className="dl">
              <Row label="Tipo" value={c.type} />
              <Row label="CPF/CNPJ" value={c.doc} />
              <Row label="Telefone" value={c.phone} />
              <Row label="WhatsApp" value={c.whatsapp} />
              <Row label="E-mail" value={c.email} />
              <Row label="Site" value={c.website} />
              <Row label="Endereço" value={[c.address, c.city, c.state].filter(Boolean).join(', ')} />
              <Row label="Segmento" value={c.segment} />
              <Row label="Observações" value={c.notes} />
            </dl>
          </Card>
          <Card title="Resumo financeiro">
            {data.totals.length === 0 && <p className="muted small">Sem lançamentos financeiros.</p>}
            <ul className="alert-list">
              {data.totals.map((t) => (
                <li key={t.type}>
                  <span>{t.type === 'receber' ? 'A receber' : 'A pagar'}</span>
                  <strong>{money(t.total)}</strong>
                </li>
              ))}
            </ul>
            <h4 className="mt">Contadores</h4>
            <ul className="alert-list">
              <li><span>Projetos</span><strong>{data.projects.length}</strong></li>
              <li><span>Propostas</span><strong>{data.proposals.length}</strong></li>
              <li><span>Contratos</span><strong>{data.contracts.length}</strong></li>
              <li><span>Documentos</span><strong>{data.documents.length}</strong></li>
            </ul>
          </Card>
        </div>
      )}

      {tab === 'Contatos' && <SimpleTable rows={data.contacts} cols={[
        { key: 'name', label: 'Nome' }, { key: 'role', label: 'Função' },
        { key: 'email', label: 'E-mail' }, { key: 'phone', label: 'Telefone' }
      ]} />}

      {tab === 'Leads' && <SimpleTable rows={data.leads} cols={[
        { key: 'name', label: 'Nome' }, { key: 'source', label: 'Origem' },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> }
      ]} />}

      {tab === 'Oportunidades' && <SimpleTable rows={data.opportunities} cols={[
        { key: 'title', label: 'Título' }, { key: 'stage', label: 'Etapa', render: (r) => <Badge value={r.stage} /> },
        { key: 'value', label: 'Valor', render: (r) => money(r.value) }
      ]} />}

      {tab === 'Propostas' && <SimpleTable rows={data.proposals} cols={[
        { key: 'number', label: 'Número' }, { key: 'service', label: 'Serviço' },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'total', label: 'Total', render: (r) => money(r.total) },
        { key: 'valid_until', label: 'Validade', render: (r) => dateBR(r.valid_until) }
      ]} />}

      {tab === 'Contratos' && <SimpleTable rows={data.contracts} cols={[
        { key: 'number', label: 'Número' }, { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'value', label: 'Valor', render: (r) => money(r.value) },
        { key: 'end_date', label: 'Término', render: (r) => dateBR(r.end_date) }
      ]} />}

      {tab === 'Projetos' && <SimpleTable rows={data.projects} cols={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Projeto', render: (r) => <Link className="link" to={'/projects/' + r.id}>{r.name}</Link> },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'progress', label: 'Progresso', render: (r) => r.progress + '%' }
      ]} />}

      {tab === 'Documentos' && <SimpleTable rows={data.documents} cols={[
        { key: 'name', label: 'Nome' }, { key: 'category', label: 'Categoria' },
        { key: 'created_at', label: 'Enviado em', render: (r) => dateBR(r.created_at) },
        { key: 'id', label: 'Download', render: (r) => (
          <a className="link" href={api.downloadUrl('/documents/' + r.id + '/download')} target="_blank" rel="noreferrer">baixar</a>
        )}
      ]} />}

      {tab === 'Financeiro' && <SimpleTable rows={data.finance} cols={[
        { key: 'description', label: 'Descrição' },
        { key: 'type', label: 'Tipo' },
        { key: 'amount', label: 'Valor', render: (r) => money(r.amount) },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'due_date', label: 'Vencimento', render: (r) => dateBR(r.due_date) }
      ]} />}

      {tab === 'Histórico' && <SimpleTable rows={data.audit} cols={[
        { key: 'created_at', label: 'Data', render: (r) => dateBR(r.created_at) },
        { key: 'action', label: 'Ação' },
        { key: 'entity', label: 'Entidade' }
      ]} />}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value || <span className="muted">—</span>}</dd>
    </>
  );
}

function SimpleTable({ rows, cols }) {
  if (!rows || rows.length === 0) return <Empty title="Sem registros nesta seção" />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i}>
              {cols.map((c) => (
                <td key={c.key}>{c.render ? c.render(r) : (r[c.key] || <span className="muted">—</span>)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`);

add('client/src/pages/Crm.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Spinner, Modal, Field, money, useToast, Badge } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

const STAGE_LABELS = {
  novo_lead: 'Novo lead',
  primeiro_contato: 'Primeiro contato',
  qualificacao: 'Qualificação',
  proposta_enviada: 'Proposta enviada',
  negociacao: 'Negociação',
  ganho: 'Ganho',
  perdido: 'Perdido'
};

const FIELDS = [
  { key: 'title', label: 'Título', required: true },
  { key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients' },
  { key: 'service', label: 'Serviço de interesse' },
  { key: 'value', label: 'Valor estimado', type: 'number' },
  { key: 'probability', label: 'Probabilidade (%)', type: 'number' },
  { key: 'owner_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
  { key: 'source', label: 'Origem' },
  { key: 'expected_close', label: 'Fechamento previsto', type: 'date' },
  { key: 'notes', label: 'Observações', type: 'textarea', full: true }
];

export default function Crm() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [dragId, setDragId] = useState(null);

  const canWrite = can(user, 'crm', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/opportunities/board');
      setBoard(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function moveTo(id, stage) {
    try {
      await api.post('/opportunities/' + id + '/stage', { stage });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function save() {
    try {
      const payload = Object.assign({}, form);
      if (editing && editing.id) await api.put('/opportunities/' + editing.id, payload);
      else await api.post('/opportunities', payload);
      toast.success('Oportunidade salva');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  if (loading && !board) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>CRM — Oportunidades</h1>
          <p className="muted">Arraste os cartões entre as etapas para atualizar o funil.</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => { setForm({ stage: 'novo_lead' }); setEditing({}); }}>
            + Nova oportunidade
          </button>
        )}
      </div>

      <div className="kanban">
        {board.stages.map((stage) => (
          <div
            key={stage}
            className="kanban-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId && canWrite) moveTo(dragId, stage); setDragId(null); }}
          >
            <div className="kanban-head">
              <span>{STAGE_LABELS[stage]}</span>
              <span className="muted small">{board.board[stage].length}</span>
            </div>
            <div className="kanban-body">
              {board.board[stage].map((o) => (
                <div
                  key={o.id}
                  className="kanban-card"
                  draggable={canWrite}
                  onDragStart={() => setDragId(o.id)}
                  onClick={() => { setForm(o); setEditing(o); }}
                >
                  <strong>{o.title}</strong>
                  <span className="muted small">{o.client_name || 'Sem cliente'}</span>
                  <div className="kanban-foot">
                    <span>{money(o.value)}</span>
                    <span className="muted small">{o.probability}%</span>
                  </div>
                </div>
              ))}
              {board.board[stage].length === 0 && <p className="muted small empty-col">Sem oportunidades</p>}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Editar oportunidade' : 'Nova oportunidade'}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            {FIELDS.map((f) => (
              <Field key={f.key} field={f} value={form[f.key]} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            ))}
            <div className="field">
              <label>Etapa</label>
              <select value={form.stage || 'novo_lead'} onChange={(e) => setForm(Object.assign({}, form, { stage: e.target.value }))}>
                {Object.keys(STAGE_LABELS).map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
`);

add('client/src/pages/Proposals.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, DataTable, Modal, Field, money, dateBR, Badge, useToast, Empty, Spinner } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

const STATUS = ['rascunho', 'enviada', 'em_negociacao', 'aprovada', 'recusada', 'expirada'];

const EMPTY_ITEM = { desc: '', qty: 1, unit_label: 'un', unit: 0 };

export default function Proposals() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ items: [Object.assign({}, EMPTY_ITEM)] });

  const canWrite = can(user, 'proposals', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/proposals');
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm({
      client_id: '', service: '', scope: '', items: [Object.assign({}, EMPTY_ITEM)],
      discount: 0, taxes: 0, valid_until: '', payment_terms: '', status: 'rascunho'
    });
    setEditing({});
  }

  async function openEdit(row) {
    try {
      const full = await api.get('/proposals/' + row.id);
      setForm(Object.assign({}, full, { items: full.items && full.items.length ? full.items : [Object.assign({}, EMPTY_ITEM)] }));
      setEditing(row);
    } catch (e) {
      toast.error(e.message);
    }
  }

  function setItem(idx, key, value) {
    const items = form.items.slice();
    items[idx] = Object.assign({}, items[idx], { [key]: value });
    setForm(Object.assign({}, form, { items }));
  }

  function addItem() {
    setForm(Object.assign({}, form, { items: form.items.concat([Object.assign({}, EMPTY_ITEM)]) }));
  }

  function removeItem(idx) {
    setForm(Object.assign({}, form, { items: form.items.filter((_, i) => i !== idx) }));
  }

  const subtotal = (form.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit) || 0), 0);
  const total = subtotal - (Number(form.discount) || 0) + (Number(form.taxes) || 0);

  async function save() {
    try {
      const payload = Object.assign({}, form, { items: form.items });
      if (editing && editing.id) await api.put('/proposals/' + editing.id, payload);
      else await api.post('/proposals', payload);
      toast.success('Proposta salva');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function duplicate(row) {
    try {
      await api.post('/proposals/' + row.id + '/duplicate', {});
      toast.success('Proposta duplicada');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function approve(row) {
    try {
      await api.post('/proposals/' + row.id + '/approve', {});
      toast.success('Proposta aprovada');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function generateReceivable(row) {
    if (!window.confirm('Gerar uma conta a receber para esta proposta? Esta ação cria um lançamento financeiro.')) return;
    try {
      await api.post('/proposals/' + row.id + '/generate-receivable', { confirm: true });
      toast.success('Conta a receber criada');
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Propostas comerciais</h1>
          <p className="muted">Elabore, acompanhe e gere PDFs das propostas.</p>
        </div>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}>+ Nova proposta</button>}
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'number', label: 'Número' },
            { key: 'client_name', label: 'Cliente' },
            { key: 'service', label: 'Serviço' },
            { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
            { key: 'total', label: 'Total', render: (r) => money(r.total) },
            { key: 'valid_until', label: 'Validade', render: (r) => dateBR(r.valid_until) }
          ]}
          rows={rows}
          empty={<Empty title="Nenhuma proposta" hint="Crie a primeira proposta comercial." />}
          onRowClick={canWrite ? openEdit : undefined}
          actions={(r) => (
            <div className="row-actions">
              <a className="btn btn-ghost btn-sm" href={api.downloadUrl('/proposals/' + r.id + '/pdf')} target="_blank" rel="noreferrer">PDF</a>
              {canWrite && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Editar</button>}
              {canWrite && <button className="btn btn-ghost btn-sm" onClick={() => duplicate(r)}>Duplicar</button>}
              {canWrite && r.status !== 'aprovada' && <button className="btn btn-ghost btn-sm" onClick={() => approve(r)}>Aprovar</button>}
              {can(user, 'finance', 'write') && r.status === 'aprovada' && (
                <button className="btn btn-ghost btn-sm" onClick={() => generateReceivable(r)}>Gerar recebível</button>
              )}
            </div>
          )}
        />
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Editar proposta' : 'Nova proposta'}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <span className="spacer" />
              <strong>Total: {money(total)}</strong>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            <Field field={{ key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients', required: true }}
              value={form.client_id} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'service', label: 'Serviço' }}
              value={form.service} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'owner_id', label: 'Responsável', type: 'select', optionsFrom: 'users' }}
              value={form.owner_id} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'status', label: 'Status', type: 'select', options: STATUS }}
              value={form.status} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'valid_until', label: 'Validade', type: 'date' }}
              value={form.valid_until} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'execution_days', label: 'Prazo de execução (dias)', type: 'number' }}
              value={form.execution_days} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'scope', label: 'Escopo', type: 'textarea', full: true }}
              value={form.scope} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
          </div>

          <h4 className="mt">Itens</h4>
          <table className="items-table">
            <thead>
              <tr><th>Descrição</th><th>Qtd</th><th>Un.</th><th>Valor unit.</th><th>Total</th><th /></tr>
            </thead>
            <tbody>
              {(form.items || []).map((it, idx) => (
                <tr key={idx}>
                  <td><input value={it.desc || ''} onChange={(e) => setItem(idx, 'desc', e.target.value)} /></td>
                  <td><input type="number" step="any" value={it.qty || 0} onChange={(e) => setItem(idx, 'qty', e.target.value)} /></td>
                  <td><input value={it.unit_label || 'un'} onChange={(e) => setItem(idx, 'unit_label', e.target.value)} /></td>
                  <td><input type="number" step="any" value={it.unit || 0} onChange={(e) => setItem(idx, 'unit', e.target.value)} /></td>
                  <td>{money((Number(it.qty) || 0) * (Number(it.unit) || 0))}</td>
                  <td><button className="btn btn-ghost btn-sm danger" onClick={() => removeItem(idx)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Adicionar item</button>

          <div className="form-grid mt">
            <Field field={{ key: 'discount', label: 'Desconto (R$)', type: 'number' }}
              value={form.discount} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'taxes', label: 'Tributos (R$)', type: 'number' }}
              value={form.taxes} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'payment_terms', label: 'Condições de pagamento', type: 'textarea', full: true }}
              value={form.payment_terms} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'notes', label: 'Observações', type: 'textarea', full: true }}
              value={form.notes} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
`);

add('client/src/pages/Contracts.jsx', `import React from 'react';
import Resource from '../components/Resource.jsx';
import { Badge, money, dateBR } from '../ui.jsx';

export default function Contracts() {
  return (
    <Resource
      title="Contratos"
      subtitle="Contratos firmados, vigências e valores."
      endpoint="/contracts"
      perm="contracts"
      createLabel="Novo contrato"
      filters={[{ key: 'status', label: 'Status', options: ['ativo', 'encerrado', 'cancelado', 'suspenso'] }]}
      columns={[
        { key: 'number', label: 'Número' },
        { key: 'client_name', label: 'Cliente' },
        { key: 'project_name', label: 'Projeto' },
        { key: 'value', label: 'Valor', render: (r) => money(r.value) },
        { key: 'start_date', label: 'Início', render: (r) => dateBR(r.start_date) },
        { key: 'end_date', label: 'Término', render: (r) => dateBR(r.end_date) },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> }
      ]}
      fields={[
        { key: 'number', label: 'Número (deixe vazio para gerar)' },
        { key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients', required: true },
        { key: 'proposal_id', label: 'Proposta de origem', type: 'select', optionsFrom: 'proposals' },
        { key: 'project_id', label: 'Projeto relacionado', type: 'select', optionsFrom: 'projects' },
        { key: 'value', label: 'Valor', type: 'number' },
        { key: 'start_date', label: 'Início', type: 'date' },
        { key: 'end_date', label: 'Término', type: 'date' },
        { key: 'owner_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
        { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'encerrado', 'cancelado', 'suspenso'] },
        { key: 'payment_terms', label: 'Condições de pagamento', type: 'textarea', full: true },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true }
      ]}
      defaults={{ status: 'ativo' }}
    />
  );
}
`);

add('client/src/pages/Projects.jsx', `import React from 'react';
import { useNavigate } from 'react-router-dom';
import Resource from '../components/Resource.jsx';
import { Badge, money, dateBR } from '../ui.jsx';

export default function Projects() {
  const navigate = useNavigate();

  return (
    <Resource
      title="Projetos e obras"
      subtitle="Todos os projetos, prazos e orçamentos."
      endpoint="/projects"
      perm="projects"
      createLabel="Novo projeto"
      filters={[
        { key: 'status', label: 'Status', options: ['planejamento', 'em_andamento', 'em_pausa', 'atrasado', 'concluido', 'cancelado'] }
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Projeto', render: (r) => (
          <a className="link" onClick={(e) => { e.stopPropagation(); navigate('/projects/' + r.id); }}>{r.name}</a>
        )},
        { key: 'client_name', label: 'Cliente' },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'due_date', label: 'Prazo', render: (r) => dateBR(r.due_date) },
        { key: 'budget', label: 'Orçamento', render: (r) => money(r.budget) },
        { key: 'progress', label: 'Progresso', render: (r) => r.progress + '%' }
      ]}
      fields={[
        { key: 'code', label: 'Código (vazio = automático)' },
        { key: 'name', label: 'Nome', required: true },
        { key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients' },
        { key: 'owner_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
        { key: 'location', label: 'Local de execução' },
        { key: 'start_date', label: 'Início', type: 'date' },
        { key: 'due_date', label: 'Prazo', type: 'date' },
        { key: 'expected_end', label: 'Conclusão prevista', type: 'date' },
        { key: 'budget', label: 'Orçamento', type: 'number' },
        { key: 'contracted_revenue', label: 'Receita contratada', type: 'number' },
        { key: 'progress', label: 'Progresso (%)', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: ['planejamento', 'em_andamento', 'em_pausa', 'atrasado', 'concluido', 'cancelado'] },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true }
      ]}
      defaults={{ status: 'planejamento', progress: 0 }}
    />
  );
}
`);

add('client/src/pages/ProjectDetail.jsx', `import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Spinner, Badge, money, dateBR, useToast, Empty, Modal, Field } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';

const TABS = ['Visão geral', 'Tarefas', 'Equipe', 'Financeiro', 'Rentabilidade', 'Ocorrências', 'Horas', 'Diário', 'Documentos'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const lookups = useLookups();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Visão geral');
  const [diaryForm, setDiaryForm] = useState(null);

  async function load() {
    try {
      const res = await api.get('/projects/' + id + '/full');
      setData(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="page"><Spinner /></div>;
  if (!data) return <div className="page"><Empty title="Projeto não encontrado" /></div>;

  const p = data.project;
  const r = data.profitability;

  async function saveDiary() {
    try {
      await api.post('/projects/' + id + '/diary', diaryForm);
      toast.success('Diário registrado');
      setDiaryForm(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>← Projetos</button>
          <h1>{p.code} — {p.name}</h1>
          <p className="muted">{p.client_name || 'Sem cliente'} · <Badge value={p.status} /> · Progresso {p.progress}%</p>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={'tab ' + (tab === t ? 'active' : '')} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Visão geral' && (
        <div className="two-col">
          <Card title="Dados do projeto">
            <dl className="dl">
              <dt>Local</dt><dd>{p.location || '—'}</dd>
              <dt>Início</dt><dd>{dateBR(p.start_date)}</dd>
              <dt>Prazo</dt><dd>{dateBR(p.due_date)}</dd>
              <dt>Conclusão prevista</dt><dd>{dateBR(p.expected_end)}</dd>
              <dt>Orçamento</dt><dd>{money(p.budget)}</dd>
              <dt>Receita contratada</dt><dd>{money(p.contracted_revenue)}</dd>
              <dt>Responsável</dt><dd>{p.owner_name || '—'}</dd>
            </dl>
          </Card>
          <Card title="Resumo operacional">
            <ul className="alert-list">
              <li><span>Tarefas</span><strong>{data.tasks.length}</strong></li>
              <li><span>Tarefas concluídas</span><strong>{data.tasks.filter((t) => t.status === 'concluida').length}</strong></li>
              <li><span>Ocorrências abertas</span><strong>{data.incidents.filter((i) => i.status === 'aberta').length}</strong></li>
              <li><span>Horas lançadas</span><strong>{data.timesheets.reduce((s, t) => s + t.hours, 0).toFixed(1)}h</strong></li>
              <li><span>Documentos</span><strong>{data.documents.length}</strong></li>
            </ul>
          </Card>
        </div>
      )}

      {tab === 'Tarefas' && (
        <Table rows={data.tasks} cols={[
          { key: 'title', label: 'Tarefa' },
          { key: 'assignee_name', label: 'Responsável' },
          { key: 'status', label: 'Status', render: (r2) => <Badge value={r2.status} /> },
          { key: 'priority', label: 'Prioridade' },
          { key: 'due_date', label: 'Prazo', render: (r2) => dateBR(r2.due_date) }
        ]} />
      )}

      {tab === 'Equipe' && (
        <Table rows={data.members} cols={[
          { key: 'user_name', label: 'Nome' },
          { key: 'email', label: 'E-mail' },
          { key: 'role', label: 'Função no projeto' }
        ]} />
      )}

      {tab === 'Financeiro' && (
        <Table rows={data.finance} cols={[
          { key: 'description', label: 'Descrição' },
          { key: 'type', label: 'Tipo' },
          { key: 'amount', label: 'Valor', render: (r2) => money(r2.amount) },
          { key: 'status', label: 'Status', render: (r2) => <Badge value={r2.status} /> },
          { key: 'due_date', label: 'Vencimento', render: (r2) => dateBR(r2.due_date) }
        ]} />
      )}

      {tab === 'Rentabilidade' && (
        <div className="two-col">
          <Card title="Receita e custos">
            <ul className="alert-list">
              <li><span>Receita contratada</span><strong>{money(r.contracted_revenue)}</strong></li>
              <li><span>Receita recebida</span><strong>{money(r.revenue_realized)}</strong></li>
              <li><span>Receita pendente</span><strong>{money(r.revenue_open)}</strong></li>
              <li><span>Custos realizados</span><strong>{money(r.cost_realized)}</strong></li>
              <li><span>Custos previstos</span><strong>{money(r.cost_open)}</strong></li>
            </ul>
          </Card>
          <Card title="Resultado">
            <ul className="alert-list">
              <li><span>Resultado estimado</span><strong>{money(r.result_estimated)}</strong></li>
              <li><span>Margem estimada</span><strong>{r.margin_estimated}%</strong></li>
              <li><span>Orçamento</span><strong>{money(r.budget)}</strong></li>
              <li><span>Desvio orçamentário</span><strong>{r.budget_deviation}%</strong></li>
            </ul>
            {r.budget_deviation > 0 && (
              <div className="alert alert-error">Atenção: os custos realizados já ultrapassaram o orçamento.</div>
            )}
          </Card>
        </div>
      )}

      {tab === 'Ocorrências' && (
        <Table rows={data.incidents} cols={[
          { key: 'date', label: 'Data', render: (r2) => dateBR(r2.date) },
          { key: 'type', label: 'Tipo' },
          { key: 'severity', label: 'Gravidade' },
          { key: 'status', label: 'Status', render: (r2) => <Badge value={r2.status} /> },
          { key: 'description', label: 'Descrição' }
        ]} />
      )}

      {tab === 'Horas' && (
        <Table rows={data.timesheets} cols={[
          { key: 'date', label: 'Data', render: (r2) => dateBR(r2.date) },
          { key: 'user_name', label: 'Colaborador' },
          { key: 'hours', label: 'Horas' },
          { key: 'status', label: 'Status', render: (r2) => <Badge value={r2.status} /> },
          { key: 'description', label: 'Descrição' }
        ]} />
      )}

      {tab === 'Diário' && (
        <>
          <div className="toolbar">
            <button className="btn btn-primary btn-sm" onClick={() => setDiaryForm({ date: new Date().toISOString().slice(0, 10) })}>
              + Registrar diário
            </button>
          </div>
          <Table rows={data.diary} cols={[
            { key: 'date', label: 'Data', render: (r2) => dateBR(r2.date) },
            { key: 'user_name', label: 'Responsável' },
            { key: 'activities', label: 'Atividades' },
            { key: 'problems', label: 'Problemas' },
            { key: 'notes', label: 'Observações' }
          ]} />
        </>
      )}

      {tab === 'Documentos' && (
        <Table rows={data.documents} cols={[
          { key: 'name', label: 'Nome' },
          { key: 'category', label: 'Categoria' },
          { key: 'id', label: 'Download', render: (r2) => (
            <a className="link" href={api.downloadUrl('/documents/' + r2.id + '/download')} target="_blank" rel="noreferrer">baixar</a>
          )}
        ]} />
      )}

      {diaryForm && (
        <Modal
          title="Registrar diário de obra"
          onClose={() => setDiaryForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDiaryForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveDiary}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            <Field field={{ key: 'date', label: 'Data', type: 'date', required: true }} value={diaryForm.date}
              onChange={(k, v) => setDiaryForm(Object.assign({}, diaryForm, { [k]: v }))} />
            <Field field={{ key: 'activities', label: 'Atividades executadas', type: 'textarea', full: true }} value={diaryForm.activities}
              onChange={(k, v) => setDiaryForm(Object.assign({}, diaryForm, { [k]: v }))} />
            <Field field={{ key: 'problems', label: 'Problemas encontrados', type: 'textarea', full: true }} value={diaryForm.problems}
              onChange={(k, v) => setDiaryForm(Object.assign({}, diaryForm, { [k]: v }))} />
            <Field field={{ key: 'notes', label: 'Observações', type: 'textarea', full: true }} value={diaryForm.notes}
              onChange={(k, v) => setDiaryForm(Object.assign({}, diaryForm, { [k]: v }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Table({ rows, cols }) {
  if (!rows || rows.length === 0) return <Empty title="Sem registros" />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r2, i) => (
            <tr key={r2.id || i}>
              {cols.map((c) => <td key={c.key}>{c.render ? c.render(r2) : (r2[c.key] || <span className="muted">—</span>)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`);

add('client/src/pages/Tasks.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Spinner, Modal, Field, Badge, dateBR, useToast, Empty } from '../ui.jsx';
import { can, useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';

const STATUSES = ['pendente', 'em_andamento', 'concluida', 'cancelada'];

export default function Tasks() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('lista');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const canWrite = can(user, 'tasks', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/tasks');
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm({ status: 'pendente', priority: 'media' });
    setEditing({});
  }

  async function save() {
    try {
      const payload = Object.assign({}, form);
      if (editing && editing.id) await api.put('/tasks/' + editing.id, payload);
      else await api.post('/tasks', payload);
      toast.success('Tarefa salva');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function changeStatus(task, status) {
    try {
      await api.put('/tasks/' + task.id, { status });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const fields = [
    { key: 'title', label: 'Título', required: true },
    { key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' },
    { key: 'assignee_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
    { key: 'priority', label: 'Prioridade', type: 'select', options: ['baixa', 'media', 'alta', 'urgente'] },
    { key: 'status', label: 'Status', type: 'select', options: STATUSES },
    { key: 'start_date', label: 'Início', type: 'date' },
    { key: 'due_date', label: 'Prazo', type: 'date' },
    { key: 'progress', label: 'Progresso (%)', type: 'number' },
    { key: 'description', label: 'Descrição', type: 'textarea', full: true }
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tarefas</h1>
          <p className="muted">Lista e quadro Kanban das tarefas da empresa.</p>
        </div>
        <div className="toolbar-inline">
          <select className="filter" value={view} onChange={(e) => setView(e.target.value)}>
            <option value="lista">Lista</option>
            <option value="kanban">Kanban</option>
          </select>
          {canWrite && <button className="btn btn-primary" onClick={openCreate}>+ Nova tarefa</button>}
        </div>
      </div>

      {loading ? <Spinner /> : view === 'lista' ? (
        rows.length === 0 ? <Empty title="Nenhuma tarefa" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Título</th><th>Projeto</th><th>Responsável</th><th>Status</th><th>Prazo</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} onClick={canWrite ? () => { setForm(t); setEditing(t); } : undefined} className="clickable">
                    <td>{t.title}</td>
                    <td>{t.project_name || '—'}</td>
                    <td>{t.assignee_name || '—'}</td>
                    <td><Badge value={t.status} /></td>
                    <td>{dateBR(t.due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="kanban">
          {STATUSES.map((s) => (
            <div
              key={s}
              className="kanban-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/plain');
                const task = rows.find((r) => String(r.id) === id);
                if (task && canWrite) changeStatus(task, s);
              }}
            >
              <div className="kanban-head"><span>{s.replace(/_/g, ' ')}</span>
                <span className="muted small">{rows.filter((r) => r.status === s).length}</span>
              </div>
              <div className="kanban-body">
                {rows.filter((r) => r.status === s).map((t) => (
                  <div
                    key={t.id}
                    className="kanban-card"
                    draggable={canWrite}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(t.id))}
                    onClick={canWrite ? () => { setForm(t); setEditing(t); } : undefined}
                  >
                    <strong>{t.title}</strong>
                    <span className="muted small">{t.project_name || 'Sem projeto'}</span>
                    <div className="kanban-foot">
                      <span className="muted small">{t.assignee_name || '—'}</span>
                      <span className="muted small">{dateBR(t.due_date)}</span>
                    </div>
                  </div>
                ))}
                {rows.filter((r) => r.status === s).length === 0 && <p className="muted small empty-col">Vazio</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Editar tarefa' : 'Nova tarefa'}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            {fields.map((f) => (
              <Field key={f.key} field={f} value={form[f.key]} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
`);

add('client/src/pages/Team.jsx', `import React from 'react';
import Resource from '../components/Resource.jsx';
import { Badge } from '../ui.jsx';

export default function Team() {
  return (
    <Resource
      title="Equipe"
      subtitle="Colaboradores cadastrados no sistema."
      endpoint="/users"
      perm="team"
      createLabel="Novo colaborador"
      canWrite={false}
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'email', label: 'E-mail' },
        { key: 'role', label: 'Perfil' },
        { key: 'position', label: 'Cargo' },
        { key: 'active', label: 'Ativo', render: (r) => <Badge value={r.active ? 'ativo' : 'inativo'} /> }
      ]}
      fields={[]}
    />
  );
}
`);

add('client/src/pages/Users.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, Badge, useToast, Empty, Spinner } from '../ui.jsx';
import { can, useAuth } from '../auth.jsx';

const ROLES = ['admin', 'gestor', 'comercial', 'engenharia', 'financeiro', 'colaborador'];

export default function Users() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const canWrite = can(user, 'team', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    try {
      if (editing && editing.id) await api.put('/users/' + editing.id, form);
      else await api.post('/users', form);
      toast.success('Usuário salvo');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function remove(row) {
    if (!window.confirm('Desativar este usuário?')) return;
    try {
      await api.del('/users/' + row.id);
      toast.success('Usuário desativado');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Usuários e permissões</h1>
          <p className="muted">Perfis definem o que cada usuário pode fazer no sistema.</p>
        </div>
        {canWrite && <button className="btn btn-primary" onClick={() => { setForm({ role: 'colaborador', active: 1 }); setEditing({}); }}>
          + Novo usuário
        </button>}
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'name', label: 'Nome' },
            { key: 'email', label: 'E-mail' },
            { key: 'role', label: 'Perfil' },
            { key: 'active', label: 'Situação', render: (r) => <Badge value={r.active ? 'ativo' : 'inativo'} /> }
          ]}
          rows={rows}
          empty={<Empty title="Sem usuários" />}
          onRowClick={canWrite ? (r) => { setForm(r); setEditing(r); } : undefined}
          actions={canWrite ? (r) => (
            <div className="row-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm(r); setEditing(r); }}>Editar</button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => remove(r)}>Desativar</button>
            </div>
          ) : null}
        />
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Editar usuário' : 'Novo usuário'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            <Field field={{ key: 'name', label: 'Nome', required: true }} value={form.name}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'email', label: 'E-mail', type: 'email', required: true }} value={form.email}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'role', label: 'Perfil', type: 'select', options: ROLES }} value={form.role}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'position', label: 'Cargo' }} value={form.position}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'phone', label: 'Telefone' }} value={form.phone}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'password', label: editing.id ? 'Nova senha (opcional)' : 'Senha', type: 'password', required: !editing.id }}
              value={form.password} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
`);

add('client/src/pages/Timesheets.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, Badge, dateBR, useToast, Empty, Spinner } from '../ui.jsx';
import { can, useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';

export default function Timesheets() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

  const canWrite = can(user, 'timesheets', 'write');
  const canApprove = ['admin', 'gestor', 'engenharia'].indexOf(user.role) !== -1;

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/timesheets');
      setRows(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    try {
      await api.post('/timesheets', form);
      toast.success('Horas registradas');
      setForm(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function approve(row) {
    try {
      await api.post('/timesheets/' + row.id + '/approve', {});
      toast.success('Horas aprovadas');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Controle de horas</h1>
          <p className="muted">Total no filtro atual: <strong>{Number(total).toFixed(1)}h</strong></p>
        </div>
        {canWrite && <button className="btn btn-primary" onClick={() => setForm({ date: new Date().toISOString().slice(0, 10), hours: 1 })}>
          + Lançar horas
        </button>}
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'date', label: 'Data', render: (r) => dateBR(r.date) },
            { key: 'user_name', label: 'Colaborador' },
            { key: 'project_name', label: 'Projeto' },
            { key: 'hours', label: 'Horas' },
            { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
            { key: 'description', label: 'Descrição' }
          ]}
          rows={rows}
          empty={<Empty title="Nenhum lançamento de horas" />}
          actions={(r) => (
            <div className="row-actions">
              {canApprove && r.status !== 'aprovado' && (
                <button className="btn btn-ghost btn-sm" onClick={() => approve(r)}>Aprovar</button>
              )}
            </div>
          )}
        />
      )}

      {form && (
        <Modal
          title="Lançar horas"
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            <Field field={{ key: 'date', label: 'Data', type: 'date', required: true }} value={form.date}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'hours', label: 'Horas', type: 'number', required: true }} value={form.hours}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' }} value={form.project_id}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'description', label: 'Descrição', type: 'textarea', full: true }} value={form.description}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
`);

add('client/src/pages/Documents.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, useToast, Empty, Spinner, dateBR } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

const CATEGORIES = ['contratos', 'projetos', 'plantas', 'relatorios', 'art', 'laudos', 'orcamentos', 'notas_fiscais', 'fotografias', 'administrativo', 'outros'];

export default function Documents() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [file, setFile] = useState(null);

  const canWrite = can(user, 'documents', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/documents');
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    if (!file) { toast.error('Selecione um arquivo'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', uploading.name || file.name);
    fd.append('category', uploading.category || 'outros');
    if (uploading.client_id) fd.append('client_id', uploading.client_id);
    if (uploading.project_id) fd.append('project_id', uploading.project_id);

    try {
      await api.upload('/documents', fd);
      toast.success('Documento enviado');
      setUploading(null);
      setFile(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Documentos</h1>
          <p className="muted">Gestão eletrônica de documentos por cliente, projeto e categoria.</p>
        </div>
        {canWrite && <button className="btn btn-primary" onClick={() => setUploading({ category: 'outros' })}>+ Enviar documento</button>}
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'name', label: 'Nome' },
            { key: 'category', label: 'Categoria' },
            { key: 'client_name', label: 'Cliente' },
            { key: 'project_name', label: 'Projeto' },
            { key: 'created_at', label: 'Enviado em', render: (r) => dateBR(r.created_at) },
            { key: 'id', label: 'Arquivo', render: (r) => (
              <a className="link" href={api.downloadUrl('/documents/' + r.id + '/download')} target="_blank" rel="noreferrer">baixar</a>
            )}
          ]}
          rows={rows}
          empty={<Empty title="Nenhum documento" hint="Envie plantas, contratos, laudos e outros arquivos." />}
        />
      )}

      {uploading && (
        <Modal
          title="Enviar documento"
          onClose={() => setUploading(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setUploading(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={submit}>Enviar</button>
            </>
          }
        >
          <div className="form-grid">
            <div className="field field-full">
              <label>Arquivo *</label>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} />
              <small className="muted">Máximo 25MB. Extensões permitidas: PDF, imagens, Office, DWG/DXF, CSV, ZIP.</small>
            </div>
            <Field field={{ key: 'name', label: 'Nome do documento' }} value={uploading.name}
              onChange={(k, v) => setUploading(Object.assign({}, uploading, { [k]: v }))} />
            <Field field={{ key: 'category', label: 'Categoria', type: 'select', options: CATEGORIES }} value={uploading.category}
              onChange={(k, v) => setUploading(Object.assign({}, uploading, { [k]: v }))} />
            <Field field={{ key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients' }} value={uploading.client_id}
              onChange={(k, v) => setUploading(Object.assign({}, uploading, { [k]: v }))} />
            <Field field={{ key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' }} value={uploading.project_id}
              onChange={(k, v) => setUploading(Object.assign({}, uploading, { [k]: v }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
`);

add('client/src/pages/Finance.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, Badge, money, dateBR, useToast, Empty, Spinner, Card } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

const STATUSES = ['previsto', 'em_aberto', 'vencido', 'pago', 'recebido', 'cancelado'];
const FIELDS = [
  { key: 'description', label: 'Descrição', required: true },
  { key: 'type', label: 'Tipo', type: 'select', options: [{ value: 'receber', label: 'A receber' }, { value: 'pagar', label: 'A pagar' }], required: true },
  { key: 'amount', label: 'Valor', type: 'number', required: true },
  { key: 'category_id', label: 'Categoria', type: 'select', optionsFrom: 'categories' },
  { key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients' },
  { key: 'supplier_id', label: 'Fornecedor', type: 'select', optionsFrom: 'suppliers' },
  { key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' },
  { key: 'competence_date', label: 'Competência', type: 'date' },
  { key: 'due_date', label: 'Vencimento', type: 'date' },
  { key: 'paid_date', label: 'Pagamento', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: STATUSES },
  { key: 'payment_method_id', label: 'Forma de pagamento', type: 'select', optionsFrom: 'methods' },
  { key: 'notes', label: 'Observações', type: 'textarea', full: true }
];

export default function Finance() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const canWrite = can(user, 'finance', 'write');

  async function load() {
    setLoading(true);
    try {
      const [list, flow] = await Promise.all([
        api.get('/finance', filters),
        api.get('/finance/cashflow')
      ]);
      setRows(list.data || []);
      setCashflow(flow.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  async function save() {
    try {
      const payload = Object.assign({}, form);
      if (editing && editing.id) await api.put('/finance/' + editing.id, payload);
      else await api.post('/finance', payload);
      toast.success('Lançamento salvo');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function settle(row) {
    try {
      await api.post('/finance/' + row.id + '/settle', {});
      toast.success('Lançamento liquidado');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const totals = rows.reduce((acc, r) => {
    if (r.status === 'cancelado') return acc;
    if (r.type === 'receber') acc.receivable += r.amount;
    else acc.payable += r.amount;
    return acc;
  }, { receivable: 0, payable: 0 });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Financeiro</h1>
          <p className="muted">Contas a pagar, a receber e fluxo de caixa.</p>
        </div>
        <div className="toolbar-inline">
          <a className="btn btn-ghost" href={api.downloadUrl('/finance/export?format=csv')}>Exportar CSV</a>
          <a className="btn btn-ghost" href={api.downloadUrl('/finance/export?format=pdf')} target="_blank" rel="noreferrer">Exportar PDF</a>
          {canWrite && <button className="btn btn-primary" onClick={() => { setForm({ type: 'pagar', status: 'em_aberto' }); setEditing({}); }}>
            + Novo lançamento
          </button>}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi kpi-ok"><span className="kpi-label">Total a receber</span><strong className="kpi-value">{money(totals.receivable)}</strong></div>
        <div className="kpi kpi-danger"><span className="kpi-label">Total a pagar</span><strong className="kpi-value">{money(totals.payable)}</strong></div>
        <div className="kpi kpi-info"><span className="kpi-label">Saldo previsto</span><strong className="kpi-value">{money(totals.receivable - totals.payable)}</strong></div>
      </div>

      <Card title="Fluxo de caixa por mês">
        {cashflow.length === 0 ? <p className="muted small">Sem lançamentos.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Mês</th><th>Recebido</th><th>A receber</th><th>Pago</th><th>A pagar</th><th>Saldo</th></tr></thead>
              <tbody>
                {cashflow.map((c) => (
                  <tr key={c.month}>
                    <td>{c.month}</td>
                    <td>{money(c.received)}</td>
                    <td>{money(c.receivable)}</td>
                    <td>{money(c.paid)}</td>
                    <td>{money(c.payable)}</td>
                    <td>{money((c.received || 0) - (c.paid || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="toolbar mt">
        <select className="filter" value={filters.type || ''} onChange={(e) => setFilters(Object.assign({}, filters, { type: e.target.value }))}>
          <option value="">Todos os tipos</option>
          <option value="receber">A receber</option>
          <option value="pagar">A pagar</option>
        </select>
        <select className="filter" value={filters.status || ''} onChange={(e) => setFilters(Object.assign({}, filters, { status: e.target.value }))}>
          <option value="">Todos os status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'description', label: 'Descrição' },
            { key: 'type', label: 'Tipo' },
            { key: 'amount', label: 'Valor', render: (r) => money(r.amount) },
            { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
            { key: 'due_date', label: 'Vencimento', render: (r) => dateBR(r.due_date) },
            { key: 'paid_date', label: 'Liquidação', render: (r) => dateBR(r.paid_date) },
            { key: 'project_name', label: 'Projeto' }
          ]}
          rows={rows}
          empty={<Empty title="Nenhum lançamento" hint="Registre contas a pagar e a receber." />}
          onRowClick={canWrite ? (r) => { setForm(r); setEditing(r); } : undefined}
          actions={(r) => (
            <div className="row-actions">
              {canWrite && ['pago', 'recebido', 'cancelado'].indexOf(r.status) === -1 && (
                <button className="btn btn-ghost btn-sm" onClick={() => settle(r)}>Liquidar</button>
              )}
              {canWrite && <button className="btn btn-ghost btn-sm" onClick={() => { setForm(r); setEditing(r); }}>Editar</button>}
            </div>
          )}
        />
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Editar lançamento' : 'Novo lançamento'}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            {FIELDS.map((f) => (
              <Field key={f.key} field={f} value={form[f.key]} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
`);

add('client/src/pages/Suppliers.jsx', `import React from 'react';
import Resource from '../components/Resource.jsx';
import { Badge } from '../ui.jsx';

export default function Suppliers() {
  return (
    <Resource
      title="Fornecedores"
      subtitle="Parceiros e prestadores de serviço."
      endpoint="/suppliers"
      perm="suppliers"
      createLabel="Novo fornecedor"
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'doc', label: 'Documento' },
        { key: 'email', label: 'E-mail' },
        { key: 'phone', label: 'Telefone' },
        { key: 'category', label: 'Categoria' },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> }
      ]}
      fields={[
        { key: 'name', label: 'Nome', required: true },
        { key: 'doc', label: 'CNPJ / CPF' },
        { key: 'email', label: 'E-mail', type: 'email' },
        { key: 'phone', label: 'Telefone' },
        { key: 'address', label: 'Endereço' },
        { key: 'category', label: 'Categoria' },
        { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true }
      ]}
      defaults={{ status: 'ativo' }}
    />
  );
}
`);

add('client/src/pages/Assets.jsx', `import React from 'react';
import Resource from '../components/Resource.jsx';
import { Badge, money } from '../ui.jsx';

export default function Assets() {
  return (
    <Resource
      title="Equipamentos e ativos"
      subtitle="Controle patrimonial de equipamentos e materiais."
      endpoint="/assets"
      perm="assets"
      createLabel="Novo equipamento"
      filters={[{ key: 'state', label: 'Estado', options: ['disponivel', 'em_uso', 'manutencao', 'baixado'] }]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'category', label: 'Categoria' },
        { key: 'state', label: 'Estado', render: (r) => <Badge value={r.state} /> },
        { key: 'location', label: 'Localização' },
        { key: 'acquisition_value', label: 'Valor', render: (r) => money(r.acquisition_value) }
      ]}
      fields={[
        { key: 'code', label: 'Código', required: true },
        { key: 'patrimony', label: 'Patrimônio' },
        { key: 'name', label: 'Nome', required: true },
        { key: 'category', label: 'Categoria' },
        { key: 'state', label: 'Estado', type: 'select', options: ['disponivel', 'em_uso', 'manutencao', 'baixado'] },
        { key: 'location', label: 'Localização' },
        { key: 'responsible_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
        { key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' },
        { key: 'acquisition_value', label: 'Valor de aquisição', type: 'number' },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true }
      ]}
      defaults={{ state: 'disponivel' }}
    />
  );
}
`);

add('client/src/pages/Incidents.jsx', `import React from 'react';
import Resource from '../components/Resource.jsx';
import { Badge, dateBR } from '../ui.jsx';

export default function Incidents() {
  return (
    <Resource
      title="Ocorrências"
      subtitle="Registro e acompanhamento de ocorrências em projetos."
      endpoint="/incidents"
      perm="incidents"
      createLabel="Nova ocorrência"
      filters={[
        { key: 'status', label: 'Status', options: ['aberta', 'em_analise', 'resolvida'] },
        { key: 'severity', label: 'Gravidade', options: ['baixa', 'media', 'alta', 'critica'] }
      ]}
      columns={[
        { key: 'date', label: 'Data', render: (r) => dateBR(r.date) },
        { key: 'project_id', label: 'Projeto' },
        { key: 'type', label: 'Tipo' },
        { key: 'severity', label: 'Gravidade', render: (r) => <Badge value={r.severity} /> },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'description', label: 'Descrição' }
      ]}
      fields={[
        { key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' },
        { key: 'date', label: 'Data', type: 'date', required: true },
        { key: 'type', label: 'Tipo' },
        { key: 'severity', label: 'Gravidade', type: 'select', options: ['baixa', 'media', 'alta', 'critica'] },
        { key: 'responsible_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
        { key: 'status', label: 'Status', type: 'select', options: ['aberta', 'em_analise', 'resolvida'] },
        { key: 'description', label: 'Descrição', type: 'textarea', required: true, full: true },
        { key: 'resolution', label: 'Medidas adotadas / resolução', type: 'textarea', full: true }
      ]}
      defaults={{ status: 'aberta', severity: 'media', date: new Date().toISOString().slice(0, 10) }}
    />
  );
}
`);

add('client/src/pages/Calendar.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, useToast, Empty, Spinner, dateBR } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

export default function CalendarPage() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const canWrite = can(user, 'calendar', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/calendar', { limit: 200 });
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    try {
      if (editing && editing.id) await api.put('/calendar/' + editing.id, form);
      else await api.post('/calendar', form);
      toast.success('Evento salvo');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const fields = [
    { key: 'title', label: 'Título', required: true },
    { key: 'type', label: 'Tipo', type: 'select', options: ['reuniao', 'entrega', 'visita', 'inspecao', 'vencimento', 'outro'] },
    { key: 'start_at', label: 'Início', type: 'datetime-local', required: true },
    { key: 'end_at', label: 'Término', type: 'datetime-local' },
    { key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' },
    { key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients' },
    { key: 'user_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
    { key: 'notes', label: 'Observações', type: 'textarea', full: true }
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Calendário</h1>
          <p className="muted">Reuniões, entregas, visitas, inspeções e vencimentos.</p>
        </div>
        {canWrite && <button className="btn btn-primary" onClick={() => { setForm({ type: 'reuniao' }); setEditing({}); }}>
          + Novo evento
        </button>}
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'title', label: 'Título' },
            { key: 'type', label: 'Tipo' },
            { key: 'start_at', label: 'Início', render: (r) => String(r.start_at || '').replace('T', ' ').slice(0, 16) },
            { key: 'end_at', label: 'Término', render: (r) => String(r.end_at || '').replace('T', ' ').slice(0, 16) },
            { key: 'notes', label: 'Observações' }
          ]}
          rows={rows}
          empty={<Empty title="Nenhum evento" />}
          onRowClick={canWrite ? (r) => { setForm(r); setEditing(r); } : undefined}
        />
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Editar evento' : 'Novo evento'}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            {fields.map((f) => (
              <Field key={f.key} field={f} value={form[f.key]} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
`);

add('client/src/pages/Reports.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Spinner, useToast, money } from '../ui.jsx';

export default function Reports() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [active, setActive] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/reports');
        setList(res.data || []);
      } catch (e) { toast.error(e.message); }
    })();
  }, []);

  async function open(key) {
    setActive(key);
    setLoading(true);
    try {
      const res = await api.get('/reports/' + key);
      setData(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Relatórios</h1>
          <p className="muted">Dados consolidados a partir dos registros do sistema.</p>
        </div>
      </div>

      <div className="report-grid">
        {list.map((r) => (
          <button key={r.key} className={'report-card ' + (active === r.key ? 'active' : '')} onClick={() => open(r.key)}>
            {r.title}
          </button>
        ))}
      </div>

      {loading && <Spinner />}

      {data && !loading && (
        <Card
          title={data.title}
          actions={
            <>
              <a className="btn btn-ghost btn-sm" href={api.downloadUrl('/reports/' + active + '?format=csv')}>CSV</a>
              <a className="btn btn-ghost btn-sm" href={api.downloadUrl('/reports/' + active + '?format=pdf')} target="_blank" rel="noreferrer">PDF</a>
            </>
          }
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>{data.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {data.data.map((row, i) => (
                  <tr key={i}>
                    {data.columns.map((c) => (
                      <td key={c.key}>
                        {row[c.key] === null || row[c.key] === undefined
                          ? <span className="muted">—</span>
                          : (typeof row[c.key] === 'number' && /valor|total|budget|revenue|cost|amount/i.test(c.key)
                            ? money(row[c.key])
                            : row[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small mt">{data.total} registro(s)</p>
        </Card>
      )}
    </div>
  );
}
`);

add('client/src/pages/Audit.jsx', `import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Spinner, useToast, Empty, dateBR } from '../ui.jsx';

export default function Audit() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/audit', { q });
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [q]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Auditoria</h1>
          <p className="muted">Registro de operações relevantes no sistema.</p>
        </div>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Filtrar por ação ou entidade..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'created_at', label: 'Data', render: (r) => String(r.created_at || '').slice(0, 16).replace('T', ' ') },
            { key: 'user_name', label: 'Usuário' },
            { key: 'action', label: 'Ação' },
            { key: 'entity', label: 'Entidade' },
            { key: 'entity_id', label: 'Registro' },
            { key: 'ip', label: 'IP' }
          ]}
          rows={rows}
          empty={<Empty title="Sem eventos de auditoria" />}
        />
      )}
    </div>
  );
}
`);

add('client/src/styles.css', `:root {
  --bg: #f4f6f8;
  --surface: #ffffff;
  --surface-2: #f9fafb;
  --border: #e3e8ee;
  --text: #16222e;
  --muted: #6b7a89;
  --brand: #1d6fa5;
  --brand-dark: #14516f;
  --sidebar: #0f2233;
  --sidebar-text: #c9d6e2;
  --ok: #2fa27a;
  --warn: #d97706;
  --danger: #b91c1c;
  --radius: 10px;
  --shadow: 0 1px 2px rgba(16, 32, 48, 0.06), 0 2px 8px rgba(16, 32, 48, 0.04);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

h1 { font-size: 22px; margin: 0 0 4px; font-weight: 650; letter-spacing: -0.2px; }
h3 { font-size: 15px; margin: 0; font-weight: 600; }
h4 { font-size: 14px; margin: 0 0 8px; font-weight: 600; }
p { margin: 0; }
a { color: var(--brand); text-decoration: none; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.mt { margin-top: 16px; }
.spacer { flex: 1; }

/* ---------- layout ---------- */
.app-shell { display: flex; min-height: 100vh; }

.sidebar {
  width: 244px;
  flex-shrink: 0;
  background: var(--sidebar);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}

.brand-mark {
  width: 34px; height: 34px;
  border-radius: 8px;
  background: var(--brand);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; letter-spacing: 0.5px;
}

.brand strong { display: block; color: #fff; font-size: 14px; letter-spacing: 0.5px; }
.brand-sub { font-size: 11px; color: #7f93a6; }

.nav { flex: 1; padding: 12px 8px; }
.nav-group { margin-bottom: 14px; }
.nav-section {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
  color: #5f7386; padding: 6px 10px; font-weight: 600;
}
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 7px;
  color: var(--sidebar-text); font-size: 13.5px;
  margin-bottom: 1px;
}
.nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
.nav-item.active { background: var(--brand); color: #fff; font-weight: 500; }
.nav-icon { width: 16px; text-align: center; opacity: 0.85; }

.sidebar-foot {
  padding: 12px; border-top: 1px solid rgba(255,255,255,0.07);
  display: flex; flex-direction: column; gap: 8px;
}
.user-chip { display: flex; align-items: center; gap: 10px; }
.user-chip strong { display: block; color: #fff; font-size: 13px; }

.avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--brand); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; flex-shrink: 0;
}
.avatar.small { width: 28px; height: 28px; font-size: 11px; }

.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.topbar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 20;
}

.global-search { flex: 1; max-width: 460px; position: relative; }
.global-search input {
  width: 100%; padding: 8px 12px;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface-2); font-size: 13px; outline: none;
}
.global-search input:focus { border-color: var(--brand); background: #fff; }

.search-results {
  position: absolute; top: 42px; left: 0; right: 0;
  background: #fff; border: 1px solid var(--border); border-radius: 10px;
  box-shadow: var(--shadow); max-height: 400px; overflow-y: auto; z-index: 50;
}
.search-group-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.7px; color: var(--muted); padding: 8px 12px 4px; }
.search-item {
  display: block; width: 100%; text-align: left;
  padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 13px;
}
.search-item:hover { background: var(--surface-2); }

.topbar-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }

.icon-btn {
  border: 1px solid var(--border); background: var(--surface);
  border-radius: 8px; padding: 6px 10px; cursor: pointer;
  font-size: 14px; color: var(--text); position: relative;
}
.icon-btn:hover { background: var(--surface-2); }
.dot {
  position: absolute; top: -6px; right: -6px;
  background: var(--danger); color: #fff;
  font-size: 10px; border-radius: 10px; padding: 1px 5px;
}

.notif-wrap { position: relative; }
.notif-panel {
  position: absolute; right: 0; top: 42px; width: 330px;
  background: #fff; border: 1px solid var(--border); border-radius: 10px;
  box-shadow: var(--shadow); max-height: 440px; overflow-y: auto; z-index: 50;
}
.notif-head { display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); }
.notif-item { padding: 10px 12px; border-bottom: 1px solid var(--border); }
.notif-item strong { font-size: 13px; display: block; margin-bottom: 2px; }
.notif-warning { border-left: 3px solid var(--warn); }
.notif-danger { border-left: 3px solid var(--danger); }
.notif-info { border-left: 3px solid var(--brand); }

.breadcrumbs {
  padding: 8px 20px; font-size: 12px; color: var(--muted);
  background: var(--surface); border-bottom: 1px solid var(--border);
}

.content { padding: 20px; flex: 1; }

/* ---------- page ---------- */
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }

.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.toolbar-inline { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.search {
  padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px;
  font-size: 13px; min-width: 240px; outline: none; background: #fff;
}
.search:focus { border-color: var(--brand); }

.filter {
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
  font-size: 13px; background: #fff; outline: none;
}

.btn {
  border: 1px solid transparent; border-radius: 8px;
  padding: 8px 14px; font-size: 13px; font-weight: 500;
  cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; gap: 6px;
  transition: background 0.12s;
}
.btn-primary { background: var(--brand); color: #fff; }
.btn-primary:hover { background: var(--brand-dark); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost { background: var(--surface); border-color: var(--border); color: var(--text); }
.btn-ghost:hover { background: var(--surface-2); }
.btn-ghost.danger { color: var(--danger); }
.btn-sm { padding: 4px 9px; font-size: 12px; }
.btn-block { width: 100%; justify-content: center; }

.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow);
  overflow: hidden;
}
.card-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border); gap: 10px; }
.card-body { padding: 16px; }
.card-actions { display: flex; gap: 6px; }

.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.kpi {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 14px 16px; box-shadow: var(--shadow);
  border-left: 3px solid var(--brand);
}
.kpi-ok { border-left-color: var(--ok); }
.kpi-warn { border-left-color: var(--warn); }
.kpi-danger { border-left-color: var(--danger); }
.kpi-info { border-left-color: var(--brand); }
.kpi-label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.kpi-value { font-size: 19px; font-weight: 650; letter-spacing: -0.3px; }

.chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; }

.alert-list { list-style: none; margin: 0; padding: 0; }
.alert-list li {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 7px 0; border-bottom: 1px dashed var(--border); font-size: 13px;
}
.alert-list li:last-child { border-bottom: none; }

/* ---------- tabela ---------- */
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.table-loading { padding: 40px; display: flex; justify-content: center; }

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  text-align: left; padding: 10px 12px;
  background: var(--surface-2); color: var(--muted);
  font-weight: 600; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border); white-space: nowrap;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr:hover { background: #fbfcfd; }
.data-table tr.clickable { cursor: pointer; }
.col-actions { width: 1%; white-space: nowrap; }
.row-actions { display: flex; gap: 4px; justify-content: flex-end; }

.link { cursor: pointer; color: var(--brand); font-weight: 500; }

.badge {
  display: inline-block; padding: 2px 8px; border-radius: 20px;
  font-size: 11.5px; font-weight: 500; text-transform: capitalize;
}
.badge-ok { background: #e5f6ee; color: #1c7a58; }
.badge-info { background: #e6f0fa; color: #1a5d8a; }
.badge-warn { background: #fdf3e3; color: #97600b; }
.badge-danger { background: #fbe9e9; color: #8f1d1d; }
.badge-muted { background: #eef1f4; color: #5b6b79; }

.pagination { display: flex; align-items: center; gap: 12px; justify-content: flex-end; }

/* ---------- forms ---------- */
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-full { grid-column: 1 / -1; }
.field label { font-size: 12.5px; font-weight: 500; color: #3c4a58; }
.field input, .field select, .field textarea {
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
  font-size: 13px; font-family: inherit; outline: none; background: #fff; width: 100%;
}
.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--brand); }
.field textarea { resize: vertical; }

.items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.items-table th { text-align: left; font-size: 11.5px; color: var(--muted); padding: 6px; }
.items-table td { padding: 4px 6px; }
.items-table input { width: 100%; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; }

/* ---------- modal ---------- */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(15, 34, 51, 0.45);
  display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100;
}
.modal {
  background: var(--surface); border-radius: 12px; width: 100%; max-width: 560px;
  max-height: 90vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(15, 34, 51, 0.25);
}
.modal-wide { max-width: 860px; }
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--border); }
.modal-body { padding: 18px; overflow-y: auto; }
.modal-foot { padding: 12px 18px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; align-items: center; }

/* ---------- kanban ---------- */
.kanban { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
.kanban-col {
  flex: 0 0 240px; background: var(--surface-2);
  border: 1px solid var(--border); border-radius: var(--radius);
  display: flex; flex-direction: column; min-height: 300px;
}
.kanban-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 12px; border-bottom: 1px solid var(--border);
  font-size: 12.5px; font-weight: 600; text-transform: capitalize;
}
.kanban-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.kanban-card {
  background: #fff; border: 1px solid var(--border); border-radius: 8px;
  padding: 10px; cursor: pointer; display: flex; flex-direction: column; gap: 4px;
  box-shadow: var(--shadow);
}
.kanban-card:hover { border-color: var(--brand); }
.kanban-card strong { font-size: 13px; }
.kanban-foot { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-top: 4px; }
.empty-col { text-align: center; padding: 12px; }

/* ---------- outros ---------- */
.two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }

.dl { display: grid; grid-template-columns: 150px 1fr; gap: 6px 12px; margin: 0; font-size: 13px; }
.dl dt { color: var(--muted); }
.dl dd { margin: 0; }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); overflow-x: auto; }
.tab {
  padding: 8px 14px; border: none; background: none; cursor: pointer;
  font-size: 13px; color: var(--muted); border-bottom: 2px solid transparent;
  font-family: inherit; white-space: nowrap;
}
.tab:hover { color: var(--text); }
.tab.active { color: var(--brand); border-bottom-color: var(--brand); font-weight: 500; }

.report-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
.report-card {
  padding: 14px; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--surface); text-align: left; cursor: pointer;
  font-size: 13px; font-weight: 500; font-family: inherit; color: var(--text);
}
.report-card:hover { border-color: var(--brand); }
.report-card.active { border-color: var(--brand); background: #eef6fb; color: var(--brand-dark); }

.empty { text-align: center; padding: 40px 20px; }
.empty-icon { font-size: 26px; color: #c3ccd5; margin-bottom: 8px; }

.alert { padding: 10px 12px; border-radius: 8px; font-size: 13px; }
.alert-error { background: #fbe9e9; color: #8f1d1d; }

.spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--border); border-top-color: var(--brand);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.boot { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }

/* ---------- login ---------- */
.login-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, #0f2233 0%, #16374f 100%); padding: 20px;
}
.login-card {
  background: #fff; border-radius: 14px; padding: 32px; width: 100%; max-width: 400px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.3);
}
.login-brand { padding: 0 0 20px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.login-brand strong { color: var(--text); }
.login-card h1 { font-size: 20px; margin-bottom: 4px; }
.login-form { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; }
.login-foot { margin-top: 20px; text-align: center; }

/* ---------- toasts ---------- */
.toast-stack { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 200; }
.toast {
  padding: 11px 16px; border-radius: 8px; font-size: 13px; color: #fff;
  box-shadow: 0 6px 20px rgba(15,34,51,0.2); max-width: 340px;
}
.toast-success { background: #1c7a58; }
.toast-error { background: #8f1d1d; }
.toast-info { background: var(--brand-dark); }

/* ---------- responsivo ---------- */
.mobile-only { display: none; }

@media (max-width: 900px) {
  .sidebar {
    position: fixed; left: 0; top: 0; bottom: 0; z-index: 90;
    transform: translateX(-100%); transition: transform 0.2s;
  }
  .sidebar.open { transform: translateX(0); box-shadow: 0 0 40px rgba(0,0,0,0.3); }
  .mobile-only { display: inline-flex; }
  .content { padding: 14px; }
  .global-search { max-width: none; }
  .chart-grid { grid-template-columns: 1fr; }
  .dl { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .page-head { flex-direction: column; align-items: stretch; }
  .kpi-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .modal { max-width: 100%; }
}
`);

/* ==============================================================
 * 7. EXECUÇÃO DO GERADOR
 * ============================================================== */

const args = parseArgs(process.argv);
const TARGET = path.resolve(args.out || process.env.VETEC_OUT || './vetec-erp');

function banner() {
  console.log('');
  console.log('  ==============================================');
  console.log('   VETEC ERP — Gerador de projeto');
  console.log('  ==============================================');
  console.log('');
}

function checkEnvironment() {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    console.error('  [ERRO] Node.js 18 ou superior é necessário. Versão atual: ' + process.versions.node);
    process.exit(1);
  }
  console.log('  Node.js ' + process.versions.node + ' — OK');
  console.log('  npm ' + (process.env.npm_config_user_agent || 'detectado pelo ambiente') + '');

  try {
    require('child_process').execSync('npm --version', { stdio: 'ignore' });
    console.log('  npm disponível — OK');
  } catch (e) {
    console.warn('  [AVISO] npm não encontrado no PATH. Você precisará do npm para instalar as dependências.');
  }
}

async function writeFiles() {
  ensureDir(TARGET);
  const created = [];
  const overwritten = [];
  const skipped = [];
  let overwriteAll = args.force;

  for (const f of FILES) {
    const dest = path.join(TARGET, f.rel);
    ensureDir(path.dirname(dest));

    if (fs.existsSync(dest)) {
      const current = fs.readFileSync(dest, 'utf8');
      if (current === f.content) { skipped.push(f.rel); continue; }

      if (!overwriteAll && !args.yes) {
        const answer = await ask('  O arquivo "' + f.rel + '" já existe e é diferente. Sobrescrever? (s/n/t=todos) ');
        if (answer.toLowerCase() === 't') overwriteAll = true;
        else if (answer.toLowerCase() !== 's') { skipped.push(f.rel); continue; }
      } else if (!overwriteAll && args.yes) {
        skipped.push(f.rel);
        continue;
      }

      fs.writeFileSync(dest, f.content, 'utf8');
      overwritten.push(f.rel);
    } else {
      fs.writeFileSync(dest, f.content, 'utf8');
      created.push(f.rel);
    }
  }

  return { created, overwritten, skipped };
}

function createRuntimeDirs() {
  ensureDir(path.join(TARGET, 'data'));
  ensureDir(path.join(TARGET, 'server', 'storage', 'documents'));
}

function createEnvIfMissing() {
  const envPath = path.join(TARGET, '.env');
  if (fs.existsSync(envPath)) return false;

  const secret = crypto.randomBytes(32).toString('hex');
  const content =
    '# Gerado automaticamente pelo instalador VETEC ERP\n' +
    'PORT=4000\n' +
    'JWT_SECRET=' + secret + '\n' +
    'JWT_EXPIRES_HOURS=12\n' +
    'ADMIN_EMAIL=admin@vetec.local\n' +
    'ADMIN_PASSWORD=\n' +
    'ADMIN_NAME=Administrador\n';

  fs.writeFileSync(envPath, content, 'utf8');
  return true;
}

async function main() {
  banner();
  checkEnvironment();

  console.log('');
  console.log('  Pasta de destino: ' + TARGET);
  console.log('');

  if (fs.existsSync(TARGET) && fs.readdirSync(TARGET).length > 0) {
    console.log('  A pasta já possui arquivos. Arquivos existentes só serão sobrescritos com sua autorização.');
    console.log('  O banco de dados em "data/" NUNCA é apagado pelo gerador.');
    console.log('');
  }

  const result = await writeFiles();
  createRuntimeDirs();
  const envCreated = createEnvIfMissing();

  console.log('');
  console.log('  ----------------------------------------------');
  console.log('  Arquivos criados    : ' + result.created.length);
  console.log('  Arquivos atualizados: ' + result.overwritten.length);
  console.log('  Arquivos preservados: ' + result.skipped.length);
  if (envCreated) console.log('  Arquivo .env criado com segredo aleatório.');
  console.log('  ----------------------------------------------');
  console.log('');

  if (result.overwritten.length) {
    console.log('  Atualizados:');
    result.overwritten.slice(0, 20).forEach((f) => console.log('    ~ ' + f));
    if (result.overwritten.length > 20) console.log('    ... e mais ' + (result.overwritten.length - 20));
    console.log('');
  }

  console.log('  Próximos passos:');
  console.log('');
  console.log('    cd ' + path.relative(process.cwd(), TARGET));
  console.log('    npm install');
  console.log('    npm run dev');
  console.log('');
  console.log('  Acesse: http://localhost:5173');
  console.log('  API   : http://localhost:4000');
  console.log('');
  console.log('  Na primeira execução o servidor exibirá as credenciais administrativas.');
  console.log('  Para produção: npm run build && npm start');
  console.log('');
}

main().catch((err) => {
  console.error('');
  console.error('  [ERRO] ' + err.message);
  console.error(err.stack);
  process.exit(1);
});