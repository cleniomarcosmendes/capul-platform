/**
 * ⭐⭐ INVARIANTE ESTRUTURAL — RBAC do backend × MENU do frontend (01/09/2026).
 *
 * Em 01/09 descobriu-se que `REGISTRADOR_FROTA` e `PORTARIA` logavam e viam **só
 * "Início"**: zero telas. O backend já as autorizava (o `frota.controller` inclui
 * REGISTRADOR_FROTA na classe, ~30 rotas; a PORTARIA tem fluxo dedicado em
 * `POST /frota/viagens/portaria`) e a `FrotaPage` até tem o modo PORTARIA embutido.
 * Faltava só o item de menu — e **não existe deep link**, então esconder do menu é
 * esconder a tela.
 *
 * O que torna esse defeito perigoso é o silêncio: ninguém recebe erro, a pessoa
 * simplesmente não vê a tela. E **teste com ADMIN nunca pega**, porque ADMIN tem
 * bypass — foi exatamente assim que passou despercebido.
 *
 * Este teste é a varredura, agora permanente. Lê o FONTE dos dois lados — os
 * `@Roles` dos controllers e as listas de `Layout.tsx` — e falha quando:
 *   A) alguma role da Logística fica sem NENHUM item de menu; ou
 *   B) o backend autoriza uma role na rota-âncora de uma tela e o menu não lhe
 *      oferece o item correspondente.
 *
 * Como no invariante do RDV (`supervisor.service.spec.ts`), toda exceção mora numa
 * lista de dispensados COM O MOTIVO: quem dispensar precisa dizer por quê.
 */
import * as fs from 'fs';
import * as path from 'path';

const DIR_BACK = path.join(__dirname, '..');
const ARQ_LAYOUT = path.join(
  __dirname, '..', '..', '..', 'frontend', 'src', 'layouts', 'Layout.tsx',
);

/**
 * Roles da Logística (espelha `core.roles_modulo` do módulo LOGISTICA). Role nova
 * no banco tem de entrar aqui — e aí o teste cobra o item de menu dela.
 */
const ROLES_LOGISTICA = [
  'ADMIN', 'COORDENADOR', 'ENTREGADOR', 'GESTOR_ENTREGA', 'GESTOR_FROTA',
  'OPERADOR_ENTREGA', 'PORTARIA', 'REGISTRADOR_ENTREGA', 'REGISTRADOR_FROTA',
  'SUPERVISOR', 'SUPERVISOR_FROTA',
];

/** Roles que PODEM ficar sem item de menu no web, com o motivo. */
const SEM_MENU_OK: Record<string, string> = {
  ADMIN: 'bypass — vê tudo pelo filtro `isAdmin` do Layout, não por lista',
  ENTREGADOR: 'role do APLICATIVO (Expo); não opera o web',
};

/**
 * Âncora = a rota que a tela do menu consome para existir. Se o backend autoriza
 * a role na âncora, ela deveria ter como chegar à tela.
 */
const ANCORAS: { item: string; lista: string; rota: RegExp; controller: string }[] = [
  { item: 'Registro de Viagem', lista: 'FROTA_SAIDA', controller: 'frota', rota: /^GET viagens$/ },
  { item: 'Monitor da Frota', lista: 'FROTA_OP', controller: 'frota', rota: /^GET painel$/ },
  { item: 'Veículos', lista: 'FROTA_GESTORES', controller: 'veiculo', rota: /^POST $/ },
  { item: 'Painel', lista: 'GESTAO_ENTREGAS', controller: 'painel', rota: /^GET $/ },
];

/**
 * Divergências CONHECIDAS e deliberadas (menu mais restrito que o backend). Não são
 * falha: o backend é a fonte da verdade e o menu apenas não oferece o atalho.
 */
const ANCORA_DISPENSADA: Record<string, string> = {
  'Painel/OPERADOR_ENTREGA': 'Painel é tela de GESTÃO de entregas; o operador lê a fila, não o consolidado',
  'Monitor da Frota/OPERADOR_ENTREGA': 'entra por FROTA_OP — verificado; se cair aqui, é regressão',
};

type Rota = { chave: string; roles: string[] };

/** Extrai as roles efetivas de cada rota de um controller (método SOBREPÕE classe). */
function lerControllers(): Map<string, Rota[]> {
  const mapa = new Map<string, Rota[]>();
  const arquivos: string[] = [];
  (function anda(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.endsWith('.controller.ts')) arquivos.push(p);
    }
  })(DIR_BACK);

  for (const arq of arquivos) {
    const linhas = fs.readFileSync(arq, 'utf8').split('\n');
    const nome = path.basename(arq).replace('.controller.ts', '');
    // @Roles da CLASSE: o último antes de `export class`.
    let rolesClasse: string[] = [];
    for (let i = 0; i < linhas.length; i++) {
      if (/export class/.test(linhas[i])) break;
      const m = /@Roles\(([^)]*)\)/.exec(linhas[i]);
      if (m) rolesClasse = [...m[1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
    }
    // Rotas: acumula decoradores até a assinatura do método.
    const rotas: Rota[] = [];
    let verbo: string | null = null;
    let caminho = '';
    let rolesMetodo: string[] | null = null;
    for (const l of linhas.slice(linhas.findIndex((x) => /export class/.test(x)))) {
      const mv = /@(Get|Post|Patch|Put|Delete)\(\s*'?([^')]*)'?\s*\)/.exec(l);
      if (mv) { verbo = mv[1].toUpperCase(); caminho = mv[2]; continue; }
      const mr = /@Roles\(([^)]*)\)/.exec(l);
      if (mr) { rolesMetodo = [...mr[1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]); continue; }
      // assinatura do método fecha o bloco
      if (verbo && /^\s{2}(?:async\s+)?[a-zA-Z][\w]*\s*\(/.test(l)) {
        rotas.push({ chave: `${verbo} ${caminho}`, roles: rolesMetodo ?? rolesClasse });
        verbo = null; rolesMetodo = null; caminho = '';
      }
    }
    mapa.set(nome, rotas);
  }
  return mapa;
}

/** Resolve as listas de roles do Layout.tsx, inclusive spread (`...FROTA_OP`). */
function lerListasDoLayout(src: string): Record<string, string[]> {
  const listas: Record<string, string[]> = {};
  const re = /const\s+([A-Z_]+)\s*=\s*\[([^\]]*)\]/g;
  for (const m of src.matchAll(re)) {
    const [, nome, corpo] = m;
    const diretas = [...corpo.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
    const herdadas = [...corpo.matchAll(/\.\.\.([A-Z_]+)/g)].flatMap((x) => listas[x[1]] ?? []);
    listas[nome] = [...new Set([...herdadas, ...diretas])];
  }
  return listas;
}

/** Item de menu → nome da lista que o gateia. */
function lerItensDoLayout(src: string): { label: string; lista: string | null }[] {
  return [...src.matchAll(/\{\s*to:\s*'[^']*',\s*label:\s*'([^']+)'[^}]*?\}/g)].map((m) => {
    const roles = /roles:\s*([A-Z_]+)/.exec(m[0]);
    return { label: m[1], lista: roles ? roles[1] : null };
  });
}

describe('RBAC — INVARIANTE: toda role autorizada no backend tem caminho até a tela', () => {
  const src = fs.readFileSync(ARQ_LAYOUT, 'utf8');
  const listas = lerListasDoLayout(src);
  const itens = lerItensDoLayout(src);
  const controllers = lerControllers();

  /**
   * Itens que a role de fato alcança. Conta só os GATEADOS: "Início" não tem
   * `roles` e apareceria para todo mundo — incluí-lo faria a role órfã parecer
   * atendida com o único item que não leva a lugar nenhum. Foi o que aconteceu na
   * validação por mutação deste teste: o invariante A passou com o bug de volta.
   */
  const menuDe = (role: string) =>
    itens.filter((i) => i.lista !== null && (listas[i.lista] ?? []).includes(role)).map((i) => i.label);

  it('o parser enxergou os dois lados (guarda contra teste que passa vazio)', () => {
    expect(Object.keys(listas).length).toBeGreaterThanOrEqual(6);
    expect(itens.length).toBeGreaterThanOrEqual(10);
    expect(controllers.get('frota')?.length ?? 0).toBeGreaterThan(10);
  });

  it('A) nenhuma role da Logística fica SEM item de menu', () => {
    const orfas = ROLES_LOGISTICA.filter(
      (r) => !(r in SEM_MENU_OK) && menuDe(r).length === 0,
    );
    expect(
      orfas.length === 0
        ? []
        : orfas.map((r) => `${r}: role existe e o menu não lhe oferece NENHUMA tela — sem deep link, é tela inacessível`),
    ).toEqual([]);
  });

  it('B) role autorizada na rota-âncora tem o item de menu correspondente', () => {
    const furos: string[] = [];
    for (const a of ANCORAS) {
      const rota = (controllers.get(a.controller) ?? []).find((r) => a.rota.test(r.chave));
      if (!rota) { furos.push(`âncora não encontrada: ${a.controller} ${a.rota} — a rota mudou de nome?`); continue; }
      const doMenu = listas[a.lista] ?? [];
      for (const role of rota.roles) {
        if (role === 'ADMIN' || doMenu.includes(role)) continue;
        if (`${a.item}/${role}` in ANCORA_DISPENSADA) continue;
        furos.push(`${a.item}: backend autoriza ${role} em "${rota.chave}" (${a.controller}) mas a lista ${a.lista} não o inclui`);
      }
    }
    expect(furos).toEqual([]);
  });

  it('C) toda role usada nos @Roles dos controllers é conhecida (role nova não passa batido)', () => {
    const usadas = new Set<string>();
    for (const rotas of controllers.values()) for (const r of rotas) r.roles.forEach((x) => usadas.add(x));
    const desconhecidas = [...usadas].filter((r) => !ROLES_LOGISTICA.includes(r));
    expect(
      desconhecidas.length === 0
        ? []
        : desconhecidas.map((r) => `${r}: role nova nos controllers — acrescente em ROLES_LOGISTICA e garanta o item de menu`),
    ).toEqual([]);
  });
});
