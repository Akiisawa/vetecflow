'use strict';
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
