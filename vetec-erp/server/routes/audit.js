'use strict';
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
