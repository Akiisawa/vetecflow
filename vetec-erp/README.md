# VETEC ERP

ERP empresarial da **VETEC Engenharia** — backend Node.js/Express + SQLite e frontend React/Vite.

## Requisitos

- Node.js 18 ou superior (recomendado 20+)
- npm 9+
- Windows, Linux ou macOS

> O `better-sqlite3` normalmente é instalado com binários pré-compilados.
> Se o `npm install` falhar na compilação, instale as *Build Tools* do Visual Studio
> (Windows) ou `build-essential` + `python3` (Linux).

## Instalação

```bash
npm install
```

Crie o arquivo `.env` (o gerador já cria um automaticamente na primeira execução).
Se precisar recriar, copie de `.env.example`.

## Execução (desenvolvimento)

```bash
npm run dev
```

- API: http://localhost:4000
- Interface: http://localhost:5173

## Execução (produção)

```bash
npm run build
npm start
```

A interface é servida pela própria API em http://localhost:4000.

## Primeiro acesso

Na primeira execução, se não existir nenhum usuário, o sistema cria a conta
administrativa. As credenciais vêm de `ADMIN_EMAIL` / `ADMIN_PASSWORD` no `.env`.
Se não estiverem definidas, uma senha aleatória é gerada e impressa **uma única vez**
no console do servidor.

## Testes

```bash
npm test
```

Os testes usam um banco temporário e não afetam os dados reais.

## Estrutura

```
server/        API REST, banco, autenticação, auditoria
  routes/      Rotas por módulo
  lib/         Permissões, CRUD genérico, auditoria, utilitários
  schema.sql   Estrutura do banco
  storage/     Arquivos enviados (documentos)
client/        Interface React (Vite)
data/          Banco SQLite persistente (gerado em tempo de execução)
```

## Backup

O banco fica em `data/vetec.db`. Basta copiar esse arquivo (com o servidor parado)
e a pasta `server/storage/documents` para ter um backup completo.

## Segurança — observações importantes

- Senhas usam hash bcrypt; tokens JWT assinados com segredo do `.env`.
- Autorizações são verificadas **no servidor** em todas as rotas.
- Antes de expor o sistema na internet: use HTTPS (proxy reverso), troque o
  `JWT_SECRET`, configure backups automáticos e revise as permissões por perfil.
- Este é um sistema funcional para uso interno; não foi submetido a auditoria de
  segurança externa.
