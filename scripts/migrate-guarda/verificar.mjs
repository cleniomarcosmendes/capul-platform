/**
 * Confere que TODA migration da arvore do repo esta aplicada em
 * `_prisma_migrations` — e diz de qual das duas causas se trata quando nao esta.
 *
 * Uso: node verificar.mjs <dirFonte> <dirImagem> <nomeDaEnvComAUrl>
 */
import { createRequire } from 'node:module';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// O script vive num bind mount (/guarda), fora da arvore de node_modules da
// aplicacao — entao a resolucao tem de partir do diretorio de trabalho.
const require = createRequire(join(process.cwd(), 'guarda.cjs'));

const [, , dirFonte, dirImagem, varUrl] = process.argv;
const url = process.env[varUrl ?? 'DATABASE_URL'];
if (!url) {
  console.error(`GUARDA: a variavel ${varUrl} nao esta definida no container.`);
  process.exit(1);
}

/** Nomes das migrations de um diretorio no formato do Prisma. */
function migrationsDe(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'migration.sql')))
    .map((e) => e.name)
    .sort();
}

/**
 * O Prisma cria `_prisma_migrations` no schema que vem na connection string —
 * por isso o auth-gateway (schema=core) tem a tabela dele separada da dos
 * demais (schema=public), e o cofre tem a sua em outro banco.
 */
function schemaDaUrl(u) {
  const m = /[?&]schema=([^&]+)/.exec(u);
  return m ? decodeURIComponent(m[1]) : 'public';
}

const esperadas = migrationsDe(dirFonte);
const naImagem = migrationsDe(dirImagem);

if (esperadas.length === 0) {
  console.error(`GUARDA: nenhuma migration encontrada em ${dirFonte}.`);
  console.error('GUARDA: o bind mount de referencia aponta para o lugar errado.');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: url });
const schema = schemaDaUrl(url);

const linhas = await prisma.$queryRawUnsafe(
  `SELECT migration_name FROM "${schema}"."_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
);
await prisma.$disconnect();

const aplicadas = new Set(linhas.map((l) => l.migration_name));
const faltando = esperadas.filter((m) => !aplicadas.has(m));

if (faltando.length === 0) {
  // A imagem trazer MAIS do que a arvore nao quebra nada (o banco ja tem tudo
  // que o codigo espera), mas denuncia bind mount desatualizado.
  const sobrando = naImagem.filter((m) => !esperadas.includes(m));
  if (sobrando.length > 0) {
    console.warn(
      `GUARDA: aviso — a imagem tem ${sobrando.length} migration(s) que nao estao na arvore ` +
        `de referencia (${sobrando.join(', ')}). Confira o bind mount.`,
    );
  }
  const n = esperadas.length;
  console.log(
    `GUARDA: ok — ${n === 1 ? 'a migration' : `as ${n} migrations`} de ${dirFonte} ` +
      `${n === 1 ? 'esta aplicada' : 'estao aplicadas'} em "${schema}"._prisma_migrations.`,
  );
  process.exit(0);
}

const semNaImagem = faltando.filter((m) => !naImagem.includes(m));

console.error('');
console.error('==========================================================');
console.error('GUARDA: MIGRATION ESPERADA NAO ESTA APLICADA NO BANCO.');
console.error('==========================================================');
for (const m of faltando) {
  console.error(`  - ${m}${naImagem.includes(m) ? '' : '   (nem existe na imagem)'}`);
}
console.error('');
if (semNaImagem.length > 0) {
  console.error('CAUSA: a IMAGEM DESTE JOB esta velha — ela nao contem a(s) migration(s)');
  console.error('acima, entao o `migrate deploy` disse "No pending migrations" com razao.');
  console.error('CORRECAO: rebuild da imagem do job e subir de novo. Exemplo:');
  console.error('  docker compose build <servico>-migrate && docker compose up -d <servico>-migrate');
} else {
  console.error('CAUSA: a imagem tem a migration, mas o `migrate deploy` nao a aplicou.');
  console.error(`CORRECAO: conferir ${varUrl} (banco/schema certos?) e o log acima.`);
}
console.error('');
process.exit(1);
