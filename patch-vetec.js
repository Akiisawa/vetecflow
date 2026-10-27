#!/usr/bin/env node
/**
 * patch-vetec.js
 * Aplica correções pontuais dentro de vetec-erp.js.
 * Uso: node patch-vetec.js [caminho/vetec-erp.js]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.resolve(process.argv[2] || 'vetec-erp.js');

if (!fs.existsSync(filePath)) {
  console.error('❌ Arquivo não encontrado:', filePath);
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n'); // normaliza p/ matching

const original = content;
const results = [];

function apply(name, from, to) {
  if (content.indexOf(to) !== -1 && content.indexOf(from) === -1) {
    results.push({ name, status: 'já aplicado' });
    return;
  }
  if (content.indexOf(from) === -1) {
    results.push({ name, status: 'NÃO ENCONTRADO' });
    return;
  }
  content = content.replace(from, to);
  results.push({ name, status: 'aplicado' });
}

/* ---------- 1. schema.sql: contract_id sem FK em projects ---------- */
apply(
  'schema: contract_id sem FK em projects',
  `  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  contract_id INTEGER REFERENCES contracts(id),`,
  `  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  contract_id INTEGER,`
);

/* ---------- 2. Contracts.jsx: lookup correto ---------- */
apply(
  'Contracts.jsx: optionsFrom propostas',
  `{ key: 'proposal_id', label: 'Proposta de origem', type: 'select', optionsFrom: 'opportunities' },`,
  `{ key: 'proposal_id', label: 'Proposta de origem', type: 'select', optionsFrom: 'proposals' },`
);

/* ---------- 3. lookups.jsx ---------- */
apply(
  'lookups.jsx: destructuring proposals',
  `const [clients, users, projects, suppliers, categories, methods, contracts, opportunities] = await Promise.all([`,
  `const [clients, users, projects, suppliers, categories, methods, contracts, opportunities, proposals] = await Promise.all([`
);

apply(
  'lookups.jsx: fetch /proposals',
  `      safe(() => api.get('/opportunities'), { data: [] })
    ]);`,
  `      safe(() => api.get('/opportunities'), { data: [] }),
      safe(() => api.get('/proposals'), { data: [] })
    ]);`
);

apply(
  'lookups.jsx: state proposals',
  `      opportunities: opportunities.data || []
    });`,
  `      opportunities: opportunities.data || [],
      proposals: proposals.data || []
    });`
);

apply(
  'lookups.jsx: fallback proposals',
  `    methods: [], contracts: [], opportunities: [], reload: () => {}`,
  `    methods: [], contracts: [], opportunities: [], proposals: [], reload: () => {}`
);

/* ---------- 4. ui.jsx: map optionsFrom ---------- */
apply(
  'ui.jsx: optionsFrom proposals',
  `      contracts: [lookups.contracts, 'number'],
      opportunities: [lookups.opportunities, 'title']
    };`,
  `      contracts: [lookups.contracts, 'number'],
      opportunities: [lookups.opportunities, 'title'],
      proposals: [lookups.proposals, 'number']
    };`
);

/* ---------- 5. reports.js: mover rota / antes de /:type ---------- */
(function patchReportsOrder() {
  const block = `router.get('/', requirePerm('reports', 'read'), (req, res) => {
  res.json({ data: Object.keys(REPORTS).map((k) => ({ key: k, title: REPORTS[k].title })) });
});`;
  const marker = `router.get('/:type', requirePerm('reports', 'read'), (req, res) => {`;

  const blockPos = content.indexOf(block);
  const markerPos = content.indexOf(marker);

  if (blockPos === -1 || markerPos === -1) {
    results.push({ name: 'reports.js: rota / antes de /:type', status: 'NÃO ENCONTRADO' });
    return;
  }
  if (blockPos < markerPos) {
    results.push({ name: 'reports.js: rota / antes de /:type', status: 'já aplicado' });
    return;
  }

  content = content.replace(block + '\n\n', '');
  content = content.replace(marker, block + '\n\n' + marker);
  results.push({ name: 'reports.js: rota / antes de /:type', status: 'aplicado' });
})();

/* ---------- resultado ---------- */
if (content === original) {
  console.log('Nenhuma alteração necessária.');
} else {
  const backup = filePath + '.bak';
  fs.writeFileSync(backup, original, 'utf8');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Backup salvo em:', backup);
}

console.log('\nPatches:');
let ok = 0, skip = 0, fail = 0;
for (const r of results) {
  const icon = r.status === 'aplicado' ? '✅' : r.status === 'já aplicado' ? '⏭️ ' : '❌';
  if (r.status === 'aplicado') ok++;
  else if (r.status === 'já aplicado') skip++;
  else fail++;
  console.log(`  ${icon} ${r.name} — ${r.status}`);
}
console.log(`\nResumo: ${ok} aplicado(s), ${skip} já estava(m) ok, ${fail} com problema.`);

if (fail > 0) process.exit(2);