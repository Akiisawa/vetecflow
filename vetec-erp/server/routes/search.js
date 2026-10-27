'use strict';
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
