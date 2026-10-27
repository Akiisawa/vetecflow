'use strict';
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
