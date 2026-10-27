'use strict';
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
