import { describe, it, expect } from 'vitest';
import { ITENS_DO_MENU, filtrarPorPapel } from './Sidebar';
import { ROLES, temPapel } from '../lib/roles';

/**
 * ⭐⭐ A MATRIZ DO MENU — o que cada papel vê, gerada da LISTA DE VERDADE.
 *
 * ⚠️ Por que é teste e não documento: uma matriz escrita à mão envelhece no
 * primeiro item novo, e o sintoma de estar errada é MUDO — ninguém recebe erro,
 * o item simplesmente não existe (§3.1.112). Esta quebra.
 *
 * ⭐ Serve a um uso operacional: quando uma varredura relatar *"não achei o
 * item X"*, esta lista diz na hora se é **tela** (deveria aparecer e não
 * aparece) ou **papel** (não é para aparecer mesmo).
 */
const rotulos = (roles: string[]) =>
  filtrarPorPapel(ITENS_DO_MENU, (...alvos) => temPapel(roles, ...alvos))
    .map((i) => ('secao' in i ? `[${i.secao}]` : i.rotulo));

describe('o que cada papel vê no menu', () => {
  it('RH_ADMIN — tudo', () => {
    expect(rotulos([ROLES.RH_ADMIN])).toEqual([
      'Minhas avaliações',
      '[CADASTROS]',
      'Quem avalia quem',
      'Questionários',
      'Acervo de questões',
      'Classificações',
      'Critérios da nota',
      '[CICLO]',
      'Ciclos',
    ]);
  });

  /**
   * ⭐ Monta o INSTRUMENTO: lê os questionários, mexe no acervo e nas
   * classificações. **Não vê Ciclos** — quem monta ciclo é o RH_CICLO — nem
   * "Quem avalia quem" nem "Critérios da nota", que são do RH_ADMIN.
   */
  it('RH_MODELO — o instrumento, sem ciclo', () => {
    expect(rotulos([ROLES.RH_MODELO])).toEqual([
      'Minhas avaliações',
      '[CADASTROS]',
      'Questionários',
      'Acervo de questões',
      'Classificações',
    ]);
  });

  /**
   * ⭐ Monta o CICLO. LÊ o instrumento (escolher modelo por nome, sem ver o
   * conteúdo, é decidir às cegas) mas não o edita: sem Classificações.
   */
  it('RH_CICLO — o ciclo, e leitura do instrumento', () => {
    expect(rotulos([ROLES.RH_CICLO])).toEqual([
      'Minhas avaliações',
      '[CADASTROS]',
      'Questionários',
      'Acervo de questões',
      '[CICLO]',
      'Ciclos',
    ]);
  });

  /**
   * ⚠️ "Minhas avaliações" NÃO tem condição de papel, de propósito (§3.1.3):
   * ser avaliador é fato do DADO, não papel do JWT — a gestora de RH avalia 13
   * pessoas tendo só RH_ADMIN.
   */
  it('AVALIADOR — só a própria fila', () => {
    expect(rotulos([ROLES.AVALIADOR])).toEqual(['Minhas avaliações']);
  });

  it('sem papel nenhum no módulo — só a fila, que o backend filtra por designação', () => {
    expect(rotulos([])).toEqual(['Minhas avaliações']);
  });

  /** ⚠️ ADMIN tem bypass: quem varre com ADMIN nunca vê item faltar. */
  it('ADMIN vê o mesmo que RH_ADMIN — e é por isso que não serve para testar RBAC', () => {
    expect(rotulos([ROLES.ADMIN])).toEqual(rotulos([ROLES.RH_ADMIN]));
  });

  it('papéis somados: RH_MODELO + RH_CICLO vê a união dos dois', () => {
    const uniao = new Set([...rotulos([ROLES.RH_MODELO]), ...rotulos([ROLES.RH_CICLO])]);
    expect(new Set(rotulos([ROLES.RH_MODELO, ROLES.RH_CICLO]))).toEqual(uniao);
  });
});

describe('a limpeza dos cabeçalhos de seção', () => {
  /**
   * ⚠️ Cabeçalho de seção sem item embaixo vira título órfão. O `AVALIADOR` não
   * vê CADASTROS nem CICLO justamente porque nenhum item deles sobra.
   */
  it('seção sem item nenhum não aparece', () => {
    expect(rotulos([ROLES.AVALIADOR])).not.toContain('[CADASTROS]');
    expect(rotulos([ROLES.AVALIADOR])).not.toContain('[CICLO]');
  });

  /**
   * ⭐ Eu escrevi este teste esperando um ACHADO — que o `RH_MODELO` visse o
   * cabeçalho `[CICLO]` órfão, porque ele é o ÚLTIMO da lista e a condição
   * `proximo != null` parecia deixá-lo passar. **Errei**: `proximo` é
   * `undefined` no fim da lista, `undefined != null` é `false`, e a seção sai.
   *
   * ⚠️ Fica como teste porque o caso do FIM DA LISTA é o único que a leitura
   * do código não resolve à primeira vista — e o próximo item de menu
   * acrescentado ao fim muda quem é o último.
   */
  it('a seção ÓRFÃ no fim da lista também some — RH_MODELO não vê [CICLO]', () => {
    expect(rotulos([ROLES.RH_MODELO])).not.toContain('[CICLO]');
    // ...e a de quem TEM o item continua aparecendo, com ele embaixo.
    const doCiclo = rotulos([ROLES.RH_CICLO]);
    expect(doCiclo[doCiclo.indexOf('[CICLO]') + 1]).toBe('Ciclos');
  });
});
