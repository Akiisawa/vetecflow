'use strict';
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
