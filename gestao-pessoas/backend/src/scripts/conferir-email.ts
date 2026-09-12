/**
 * ⭐⭐ COBERTURA DE E-MAIL — a medição que decide o DESENHO da notificação.
 *
 * ── POR QUE ESTE ARQUIVO EXISTE ─────────────────────────────────────────────
 *
 * Antes de gastar 3–5 dias construindo notificação por e-mail, é preciso saber
 * para quantos ela chegaria. A pergunta não é "o SMTP existe?" (existe, §3.1.140)
 * — é **quantas pessoas têm endereço**.
 *
 * ⚠️ **`rh.colaborador` NÃO TEM CAMPO DE E-MAIL.** O e-mail não vem do Protheus
 * para o módulo: ele mora em `core.usuarios.email`, que é a CONTA da plataforma.
 * A consequência muda tudo: a cobertura de e-mail é **limitada pela cobertura de
 * CONTA**, que já é o gargalo conhecido do módulo — quem não tem conta não tem
 * e-mail por definição, e não é um problema separado.
 *
 * ⚠️ `core.usuarios.email` é **UNIQUE**. E-mail repetido entre duas pessoas é
 * impossível no banco — a pergunta "a notificação de uma chega para a outra"
 * está respondida pelo schema, não por amostragem. O que SOBRA de risco é
 * endereço de CAIXA COMPARTILHADA (um setor inteiro atrás de `rh@`), que é
 * único no banco e ainda assim não identifica uma pessoa. Este script separa os
 * dois.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   docker compose exec gestao-pessoas-backend node dist/scripts/conferir-email.js [ciclo]
 *
 * ⚠️ SOMENTE LEITURA. Nenhuma escrita, nenhum efeito.
 *
 * ⚠️ Mora em `src/` e roda do `dist/` pelo mesmo motivo do `conferir-estado.ts`:
 * ferramenta de conferência que depende de resolvedor experimental é ferramenta
 * que quebra sozinha. E ferramenta FORA de `src/` fica fora de toda invariante
 * do módulo — foi o que deixou o `conferir-estado` passar batido pelas duas
 * varreduras até ser movido (§3.1.144).
 */
import { PrismaClient } from '@prisma/client';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import { MODULO } from '../common/roles-rh.js';

const prisma = new PrismaClient();

/**
 * ⚠️ Formato, não existência. Não valida se a caixa recebe — isso só o envio
 * responde. Serve para separar "endereço plausível" de lixo digitado.
 */
const FORMATO = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Domínios que NÃO são endereço de gente de verdade neste ambiente.
 * ⚠️ Contá-los como cobertura infla o número que decide o desenho.
 */
const DOMINIOS_DE_TESTE = ['capul.test', 'teste.local', 'example.com', 'localhost'];

/**
 * ⚠️⚠️ NÃO EXISTE LISTA DE PREFIXOS QUE DECIDA ISSO — e a primeira versão deste
 * script tentou.
 *
 * Ela trazia `['rh','ti','contato','financeiro','sac','compras','fiscal','adm']`
 * e reportou **"e-mail de SETOR: 0"**. Na lista de endereços que casam com
 * colaborador havia três caixas de setor à vista — `pcp@`, `nfservicos@` e
 * `gerenciapostounai@`. Nenhuma estava nos prefixos. **Zero por não reconhecer,
 * não por não haver**, num número que decide se um canal de comunicação serve.
 *
 * Caixa de setor é **julgamento humano**: só quem conhece a empresa sabe que
 * `pcp@` é o Planejamento e Controle da Produção e não a pessoa. Então o script
 * parou de fingir que decide: ele **LISTA todos os endereços que casam com um
 * colaborador** e chama a coluna de *a conferir*. Uma lista de 13 linhas se lê
 * em dez segundos; uma heurística errada se acredita por meses.
 */

interface Pessoa {
  matricula: string;
  nome: string;
  centroCustoDescricao: string | null;
  centroCusto: string | null;
  email: string | null;
  temConta: boolean;
}

interface Balanco {
  total: number;
  semConta: number;
  contaSemEmail: number;
  emailInvalido: string[];
  emailDeTeste: string[];
  /** ⭐ Endereço existente, formato válido, domínio real. **A conferir se é de
   *  PESSOA ou de SETOR — isso o script não decide, ver o comentário acima.** */
  aConferir: string[];
}

function classificar(pessoas: Pessoa[]): Balanco {
  const b: Balanco = {
    total: pessoas.length,
    semConta: 0,
    contaSemEmail: 0,
    emailInvalido: [],
    emailDeTeste: [],
    aConferir: [],
  };
  for (const p of pessoas) {
    if (!p.temConta) { b.semConta++; continue; }
    if (!p.email) { b.contaSemEmail++; continue; }
    const email = p.email.trim().toLowerCase();
    const dominio = email.split('@')[1] ?? '';
    if (!FORMATO.test(email)) { b.emailInvalido.push(`${p.matricula} ${email}`); continue; }
    if (DOMINIOS_DE_TESTE.includes(dominio)) { b.emailDeTeste.push(`${p.matricula} ${email}`); continue; }
    b.aConferir.push(`${p.matricula} ${email} — ${p.centroCustoDescricao ?? p.centroCusto ?? '?'}`);
  }
  return b;
}

function imprimir(titulo: string, b: Balanco, pessoas: Pessoa[]) {
  const pct = (n: number) => (b.total === 0 ? '—' : `${((n / b.total) * 100).toFixed(1)}%`);
  const teto = b.aConferir.length;
  console.log(`\n${titulo}`);
  console.log('─'.repeat(72));
  console.log(`  pessoas ................................ ${b.total}`);
  console.log(`  ⭐ TETO de alcance por e-mail ........... ${teto}  (${pct(teto)})`);
  console.log(`  sem endereço nenhum .................... ${b.total - teto}  (${pct(b.total - teto)})`);
  console.log(`      sem conta na plataforma ........... ${b.semConta}`);
  console.log(`      conta sem e-mail .................. ${b.contaSemEmail}`);
  console.log(`      e-mail de domínio de TESTE ........ ${b.emailDeTeste.length}`);
  console.log(`      e-mail com formato inválido ....... ${b.emailInvalido.length}`);
  if (b.emailDeTeste.length)
    console.log(`        [teste] ${b.emailDeTeste.slice(0, 6).join(' · ')}${b.emailDeTeste.length > 6 ? ` … +${b.emailDeTeste.length - 6}` : ''}`);
  if (b.emailInvalido.length) console.log(`        [inválido] ${b.emailInvalido.join(' · ')}`);
  if (teto) {
    // ⚠️ TODOS, sem cortar: a lista existe para uma PESSOA julgar quais são
    // caixa de setor. Cortada em 6, o julgamento sai errado sem avisar.
    console.log(`  ⚠️ os ${teto} endereços — CONFERIR quais são de setor, não de pessoa:`);
    for (const e of b.aConferir) console.log(`        ${e}`);
  }

  // ── Distribuição por centro de custo: onde o buraco se concentra ──────────
  const porCC = new Map<string, { total: number; ok: number }>();
  for (const p of pessoas) {
    const cc = p.centroCustoDescricao ?? p.centroCusto ?? '(sem CC)';
    const e = porCC.get(cc) ?? { total: 0, ok: 0 };
    e.total++;
    const email = (p.email ?? '').trim().toLowerCase();
    const dom = email.split('@')[1] ?? '';
    if (p.temConta && email && FORMATO.test(email) && !DOMINIOS_DE_TESTE.includes(dom)) e.ok++;
    porCC.set(cc, e);
  }
  const linhas = [...porCC.entries()].sort((a, b2) => b2[1].total - a[1].total);
  console.log(`  por centro de custo (${linhas.length} CCs, os 12 maiores):`);
  for (const [cc, e] of linhas.slice(0, 12)) {
    const barra = e.total === 0 ? '' : ` ${((e.ok / e.total) * 100).toFixed(0)}%`;
    console.log(`      ${String(e.ok).padStart(4)}/${String(e.total).padEnd(5)}${barra.padStart(6)}  ${cc}`);
  }
  const semNenhum = linhas.filter(([, e]) => e.ok === 0).length;
  console.log(`      ⚠️ CCs com ZERO endereços: ${semNenhum} de ${linhas.length}`);
}

/** Junta colaboradores do `rh` com a conta do `core` — pela matrícula. */
async function comConta(ids: string[] | null): Promise<Pessoa[]> {
  const cols = await prisma.colaborador.findMany({
    where: {
      situacao: { in: SITUACOES_ELEGIVEIS as never },
      ...(ids ? { id: { in: ids } } : {}),
    },
    select: { matricula: true, nome: true, centroCusto: true, centroCustoDescricao: true },
    orderBy: { nome: 'asc' },
  });
  const matriculas = cols.map((c) => c.matricula);
  const contas = await prisma.$queryRaw<{ matricula: string; email: string | null }[]>`
    SELECT u.matricula, u.email
      FROM core.usuarios u
     WHERE u.matricula = ANY(${matriculas}::text[])`;
  const porMat = new Map(contas.map((c) => [c.matricula, c]));
  return cols.map((c) => ({
    matricula: c.matricula,
    nome: c.nome,
    centroCusto: c.centroCusto,
    centroCustoDescricao: c.centroCustoDescricao,
    email: porMat.get(c.matricula)?.email ?? null,
    temConta: porMat.has(c.matricula),
  }));
}

async function main() {
  const alvo = process.argv[2] ?? 'ENSAIO';

  console.log('COBERTURA DE E-MAIL — o que decide o desenho da notificação');
  console.log(`  fonte do e-mail ........... core.usuarios.email (UNIQUE)`);
  console.log(`  ⚠️ rh.colaborador ......... NÃO TEM campo de e-mail`);
  console.log(`  régua de elegibilidade .... ${SITUACOES_ELEGIVEIS.join(', ')}`);
  console.log(`  módulo .................... ${MODULO}`);

  // ── Nível 3: o cadastro inteiro (o número de produção) ────────────────────
  const todos = await comConta(null);
  imprimir('NÍVEL 3 — CADASTRO INTEIRO (o número de produção)', classificar(todos), todos);

  const ciclo = await prisma.ciclo.findFirst({
    where: { nome: { contains: alvo, mode: 'insensitive' } },
    select: { id: true, nome: true, status: true },
  });
  if (!ciclo) {
    console.log(`\n⚠️ Nenhum ciclo casa com "${alvo}".`);
    return;
  }

  // ── Nível 2: o público do ciclo (quem recebe devolutiva) ──────────────────
  const publico = await prisma.aplicacaoPublico.findMany({
    where: { aplicacao: { cicloId: ciclo.id } },
    select: { colaboradorId: true },
  });
  const idsPublico = [...new Set(publico.map((p) => p.colaboradorId))];
  const doPublico = await comConta(idsPublico);
  imprimir(
    `NÍVEL 2 — PÚBLICO DE "${ciclo.nome}" [${ciclo.status}] (quem recebe DEVOLUTIVA)`,
    classificar(doPublico),
    doPublico,
  );

  // ── Nível 1: os avaliadores (sem eles o ensaio integral não roda) ─────────
  const avaliadores = await prisma.avaliacao.groupBy({
    by: ['avaliadorId'],
    where: { cicloId: ciclo.id },
  });
  const idsAval = avaliadores.map((a) => a.avaliadorId);
  const osAvaliadores = await comConta(idsAval);
  imprimir(
    `NÍVEL 1 — AVALIADORES de "${ciclo.nome}" (sem eles o ensaio não roda)`,
    classificar(osAvaliadores),
    osAvaliadores,
  );

  /**
   * ── ⭐ O BURACO CONSERTÁVEL ────────────────────────────────────────────────
   *
   * A junção do módulo é `core.usuarios.matricula = rh.colaborador.matricula`.
   * Conta com e-mail REAL e **matrícula nula** é gente que o módulo não enxerga
   * — e o conserto é no Configurador, não aqui. Separar isto do buraco duro
   * (quem simplesmente não tem conta) muda a recomendação: um é cadastro, o
   * outro é 1.000 contas que não existem.
   *
   * ⚠️ O casamento aqui é por NOME, que é frágil de propósito: serve para
   * DIMENSIONAR o conserto, nunca para executá-lo. Homônimo entra na conta.
   */
  const semVinculo = await prisma.$queryRaw<
    { email: string; nome: string; matricula: string; cc: string | null }[]
  >`
    SELECT u.email, u.nome, c.matricula, c.centro_custo_descricao AS cc
      FROM core.usuarios u
      JOIN rh.colaborador c ON upper(btrim(c.nome)) = upper(btrim(u.nome))
     WHERE u.email IS NOT NULL AND u.matricula IS NULL
     ORDER BY u.nome`;
  console.log('\n⭐ BURACO CONSERTÁVEL — conta tem e-mail, falta a MATRÍCULA');
  console.log('─'.repeat(72));
  console.log(`  contas com e-mail e sem matrícula, cujo NOME casa com colaborador: ${semVinculo.length}`);
  console.log('  ⚠️ casamento por NOME — dimensiona o conserto, não o executa.');
  for (const v of semVinculo) console.log(`      ${v.matricula} ${v.email} — ${v.nome} (${v.cc ?? '?'})`);

  // ── A pergunta do e-mail repetido, respondida pelo DADO e não pelo schema ─
  const repetidos = await prisma.$queryRaw<{ email: string; quantos: number }[]>`
    SELECT lower(trim(email)) AS email, count(*)::int AS quantos
      FROM core.usuarios
     WHERE email IS NOT NULL
     GROUP BY 1 HAVING count(*) > 1`;
  console.log('\nE-MAIL REPETIDO ENTRE PESSOAS');
  console.log('─'.repeat(72));
  console.log(`  a coluna é UNIQUE, então a resposta esperada é zero: ${repetidos.length}`);
  for (const r of repetidos) console.log(`      ⚠️ ${r.email} → ${r.quantos} contas`);
  console.log(
    '  ⚠️ O que a UNIQUE NÃO impede é caixa de SETOR — única no banco e ainda\n' +
      '     assim lida por várias pessoas. Contada acima como não alcançável.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
