#!/usr/bin/env node
// scripts/check-prisma-migrations.mjs
//
// Audit: compara schema.prisma vs migrations/ e reporta tabelas que estão
// declaradas no schema mas NÃO são criadas por nenhuma migration. Detecta
// o padrão "alguém rodou `prisma db push` em DEV mas esqueceu de gerar
// a migration" — bug que aconteceu 28/04/2026 com projetos_favorito,
// anexos_parada e atividade_responsaveis.
//
// Uso:
//   node scripts/check-prisma-migrations.mjs --root auth-gateway
//   node scripts/check-prisma-migrations.mjs --root fiscal/backend
//   node scripts/check-prisma-migrations.mjs --root gestao-ti/backend
//
// Exit codes:
//   0 = OK (todas as tabelas têm migration correspondente)
//   1 = falha (tabelas faltantes detectadas — ou erro de leitura)
//
// Sem dependências externas — roda em Node 18+ puro.

import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { argv, exit, cwd } from 'node:process';

function parseArgs() {
  const args = { root: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) {
      args.root = argv[++i];
    }
  }
  if (!args.root) {
    console.error('Uso: node check-prisma-migrations.mjs --root <caminho-do-backend>');
    console.error('Exemplo: node check-prisma-migrations.mjs --root gestao-ti/backend');
    exit(2);
  }
  return args;
}

/**
 * Extrai todos os modelos declarados no schema.prisma e suas tabelas físicas.
 * Cada modelo tem um @@map("nome_tabela") e um @@schema("nome_schema") quando
 * multi-schema. Retorna pares { schema, tabela, model } únicos.
 */
function parseSchema(content) {
  const tables = [];
  // Encontra cada bloco "model Foo { ... }"
  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/gs;
  for (const match of content.matchAll(modelRegex)) {
    const modelName = match[1];
    const body = match[2];
    const mapMatch = body.match(/@@map\(\s*"([^"]+)"\s*\)/);
    const schemaMatch = body.match(/@@schema\(\s*"([^"]+)"\s*\)/);
    if (!mapMatch) continue; // sem @@map = nome da tabela é o do model (raro)
    tables.push({
      model: modelName,
      tabela: mapMatch[1],
      schema: schemaMatch ? schemaMatch[1] : null,
    });
  }
  return tables;
}

/**
 * Varre todos os migration.sql do diretório e extrai nomes de tabelas
 * criadas via CREATE TABLE. Cobre os formatos:
 *   CREATE TABLE "schema"."tabela"
 *   CREATE TABLE IF NOT EXISTS "schema"."tabela"
 *   CREATE TABLE public."tabela"
 *   CREATE TABLE "tabela"
 */
async function extractCreateTables(sql, set) {
  // Regex aceita: schema."tab" / "schema"."tab" / public.tab / "tab"
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\(/gi;
  for (const m of sql.matchAll(tableRegex)) {
    const schema = m[1] ?? null;
    const tabela = m[2];
    set.add(`${schema ?? ''}.${tabela}`);
    // Adiciona variante sem schema também (caso schema seja default)
    set.add(`.${tabela}`);
  }
}

async function collectMigrationTables(prismaDir) {
  const tables = new Set();
  const migrationsDir = join(prismaDir, 'migrations');

  // 1. Migrations Prisma em prisma/migrations/<dir>/migration.sql
  let entries = [];
  try {
    entries = await readdir(migrationsDir);
  } catch (err) {
    // Sem migrations/ — pode ser ok se houver bootstrap script
  }
  for (const entry of entries) {
    const fullPath = join(migrationsDir, entry);
    let st;
    try {
      st = await stat(fullPath);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const sqlPath = join(fullPath, 'migration.sql');
    try {
      const sql = await readFile(sqlPath, 'utf8');
      await extractCreateTables(sql, tables);
    } catch {
      continue;
    }
  }

  // 2. Bootstrap scripts em prisma/*.sql (ex: fiscal-schema-init.sql)
  // Convenção: arquivos .sql na raiz de prisma/ (não em migrations/) que
  // criam tabelas iniciais quando o schema é deployado pela primeira vez.
  let prismaEntries = [];
  try {
    prismaEntries = await readdir(prismaDir);
  } catch {
    // sem prisma/ — não deve acontecer
  }
  for (const entry of prismaEntries) {
    if (!entry.endsWith('.sql')) continue;
    const fullPath = join(prismaDir, entry);
    let st;
    try {
      st = await stat(fullPath);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    try {
      const sql = await readFile(fullPath, 'utf8');
      await extractCreateTables(sql, tables);
    } catch {
      continue;
    }
  }

  return tables;
}

function colorize(text, color) {
  if (!process.stdout.isTTY) return text;
  const codes = { red: 31, green: 32, yellow: 33, gray: 90, bold: 1 };
  return `\x1b[${codes[color] ?? 0}m${text}\x1b[0m`;
}

async function main() {
  const args = parseArgs();
  const root = resolve(cwd(), args.root);
  const prismaDir = join(root, 'prisma');
  const schemaPath = join(prismaDir, 'schema.prisma');
  const migrationsDir = join(prismaDir, 'migrations');

  let schemaContent;
  try {
    schemaContent = await readFile(schemaPath, 'utf8');
  } catch (err) {
    console.error(colorize(`✗ Não foi possível ler ${schemaPath}: ${err.message}`, 'red'));
    exit(1);
  }

  const schemaTables = parseSchema(schemaContent);
  if (schemaTables.length === 0) {
    console.error(colorize(`✗ Nenhum modelo encontrado em ${schemaPath}`, 'red'));
    exit(1);
  }

  let migrationTables;
  try {
    migrationTables = await collectMigrationTables(prismaDir);
  } catch (err) {
    console.error(colorize(`✗ ${err.message}`, 'red'));
    exit(1);
  }

  // Para cada tabela do schema, vê se foi criada em alguma migration.
  // Match aceita "schema.tabela" OU ".tabela" (caso migration não declare schema).
  const faltantes = [];
  for (const t of schemaTables) {
    const keyComSchema = `${t.schema ?? ''}.${t.tabela}`;
    const keySemSchema = `.${t.tabela}`;
    if (!migrationTables.has(keyComSchema) && !migrationTables.has(keySemSchema)) {
      faltantes.push(t);
    }
  }

  // Heurística: tabelas mapeadas para schemas que o backend lê apenas como
  // read-only (ex: gestao-ti/backend lê schema "core") são owned por outro
  // backend. Ignorar essas falsamente reportadas.
  // Detecta pelo header datasource: schemas que aparecem ali são "owned".
  const datasourceMatch = schemaContent.match(
    /datasource\s+\w+\s*\{[^}]*schemas\s*=\s*\[([^\]]+)\]/s,
  );
  const ownedSchemas = datasourceMatch
    ? datasourceMatch[1]
        .split(',')
        .map((s) => s.trim().replace(/^"|"$/g, ''))
        .filter(Boolean)
    : [];
  // Se o schema do datasource lista múltiplos, todos são "owned" (Prisma escreve
  // migrations para todos os schemas listados). Nada para filtrar normalmente.
  // Mas quando o backend usa DB_SCHEMA env separado, alguns @@schema podem ser
  // somente de leitura. Neste repo: gestao-ti/backend lista core+gestao_ti mas
  // só escreve em gestao_ti. Usuario/Filial/Departamento etc são MAPEADOS no
  // schema só pra Prisma fazer JOIN — não devem ser auditados como "faltando
  // migration", porque não são owned por este backend.
  // Convenção do projeto: backend escreve apenas no PRIMEIRO schema do array
  // datasource, e os demais são read-only.
  const ownedSchema = ownedSchemas.length > 0 ? ownedSchemas[0] : null;
  const filtrados = ownedSchema
    ? faltantes.filter((t) => t.schema === null || t.schema === ownedSchema)
    : faltantes;

  // Reporte
  console.log(colorize(`\n=== Audit: ${args.root} ===`, 'bold'));
  console.log(`Schema: ${schemaPath}`);
  console.log(`Migrations: ${migrationsDir}`);
  console.log(`Modelos no schema: ${schemaTables.length}`);
  console.log(`Tabelas detectadas em migrations: ${migrationTables.size / 2} (com e sem schema)`);
  if (ownedSchema) {
    console.log(colorize(`Schema owned (auditado): ${ownedSchema}`, 'gray'));
    if (ownedSchemas.length > 1) {
      console.log(
        colorize(
          `Schemas read-only (ignorados no audit): ${ownedSchemas.slice(1).join(', ')}`,
          'gray',
        ),
      );
    }
  }

  if (filtrados.length === 0) {
    console.log(colorize(`\n✓ OK — todas as ${schemaTables.length} tabelas têm migration.\n`, 'green'));
    exit(0);
  }

  console.log(
    colorize(
      `\n✗ ${filtrados.length} tabela(s) declarada(s) no schema SEM migration:`,
      'red',
    ),
  );
  for (const t of filtrados) {
    const fq = t.schema ? `${t.schema}.${t.tabela}` : t.tabela;
    console.log(`  - ${colorize(fq, 'yellow')} (model ${t.model})`);
  }
  console.log(
    colorize(
      '\nProvável causa: alguém rodou `prisma db push` em DEV/HOM mas esqueceu de gerar/commitar',
    'gray'
    ),
  );
  console.log(
    colorize('a migration. Em PROD a tabela nunca será criada e endpoints retornarão 500.', 'gray'),
  );
  console.log(
    colorize('Fix: `npx prisma migrate dev --create-only --name <nome>` no backend afetado,', 'gray'),
  );
  console.log(
    colorize(
      'editar a migration para ser idempotente (CREATE TABLE IF NOT EXISTS), commitar.',
      'gray',
    ),
  );
  console.log('');
  exit(1);
}

main().catch((err) => {
  console.error(colorize(`✗ Erro inesperado: ${err.stack ?? err.message}`, 'red'));
  exit(1);
});
