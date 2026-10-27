'use strict';

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
    if (/[",;\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const head = columns.map((c) => esc(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(';')).join('\n');
  return '\ufeff' + head + '\n' + body + '\n';
}

module.exports = { nowIso, nextNumber, today, addDays, pick, toCsv, pad };
