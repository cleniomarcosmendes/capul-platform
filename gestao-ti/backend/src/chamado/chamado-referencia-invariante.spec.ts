import * as fs from 'fs';
import * as path from 'path';

/**
 * ⭐⭐ INVARIANTE ESTRUTURAL — os laços `#numero` só saem por quem os PODA.
 *
 * Histórico curto de um mesmo defeito, três vezes:
 *  - 26/08 os laços entraram no `chamadoInclude`, compartilhado por listagem e detalhe;
 *  - 27/08 o `/security-review` achou que a relação ia CRUA para quem lê — título de
 *    chamado PRIVADO de outro departamento aparecia para quem não o atende. A poda
 *    (`podarReferencias`) foi posta em DOIS pontos: `findAll` e `findOne`;
 *  - 28/08, ao investigar outra coisa, apareceu que `chamadoInclude` é devolvido por
 *    **14** pontos. Os outros 12 — `create`, `assumir`, `resolver`, `fechar`,
 *    `reabrir`, `cancelar`, `avaliar`, `transferirEquipe`, `transferirTecnico`,
 *    `updateHeader`, `atualizarDadosClienteSac` — seguiam vazando.
 *
 * Revisão caso a caso já falhou duas vezes aqui, e no RDV o mesmo padrão voltou quatro
 * vezes antes de virar varredura. Então a garantia é dupla e estrutural:
 *
 *  1. quem não precisa dos laços NÃO OS CARREGA (eles saíram para
 *     `chamadoIncludeDetalhe`, usado só onde a tela desenha "Chamados relacionados");
 *  2. todo método que use esse include tem de podar na saída.
 *
 * Ponto novo que devolva `chamadoIncludeDetalhe` sem `podarReferencias` quebra aqui.
 */
describe('Chamado — INVARIANTE: laço `#numero` não sai sem poda', () => {
  const dir = __dirname;
  const constants = fs.readFileSync(
    path.join(dir, 'services', 'chamado.constants.ts'),
    'utf8',
  );
  const serviceBruto = fs.readFileSync(
    path.join(dir, 'services', 'chamado-core.service.ts'),
    'utf8',
  );

  /**
   * ⚠️ A varredura tem de ler CÓDIGO, não comentário. Este arquivo é muito comentado —
   * a 1ª versão do teste falhou porque o comentário que EXPLICA a regra cita o nome do
   * helper, e a busca por texto não distingue "usa" de "fala sobre". Varredura com
   * falso positivo é varredura que alguém desliga.
   */
  const semComentarios = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const service = semComentarios(serviceBruto);

  it('o `chamadoInclude` COMPARTILHADO não carrega os laços', () => {
    // Tudo antes da declaração do include do detalhe é o include compartilhado — o que
    // as 12 rotas de ação devolvem. Se um laço voltar para cá, volta para todas elas.
    const corte = constants.indexOf('export const chamadoIncludeDetalhe');
    expect(corte).toBeGreaterThan(-1);
    const compartilhado = constants.slice(0, corte);

    expect(compartilhado).not.toContain('referenciasFeitas');
    expect(compartilhado).not.toContain('referenciasRecebidas');
  });

  it('o include do detalhe traz os dois campos que a PODA precisa para decidir', () => {
    // Sem `departamentoId` e `visibilidade` no select, `podeLerChamado` não tem como
    // responder — e uma poda que não decide deixa passar tudo.
    const detalhe = constants.slice(
      constants.indexOf('export const chamadoIncludeDetalhe'),
    );
    for (const campo of ['departamentoId', 'visibilidade']) {
      expect(detalhe).toContain(campo);
    }
  });

  it('todo método que usa `chamadoIncludeDetalhe` também poda', () => {
    // Fatia o serviço por método (o mesmo recorte usado no invariante de guard) e
    // exige que quem carrega o laço também o pode, DENTRO do próprio método.
    const inicios: { nome: string; pos: number }[] = [];
    const re = /^ {2}(?:private\s+)?(?:async\s+)?([a-zA-Z][a-zA-Z0-9_]*)\s*(?:<[^>]*>)?\(/gm;
    for (let m = re.exec(service); m !== null; m = re.exec(service)) {
      inicios.push({ nome: m[1], pos: m.index });
    }
    expect(inicios.length).toBeGreaterThan(10); // o recorte ainda funciona

    const semPoda: string[] = [];
    inicios.forEach((ini, i) => {
      const fim = i + 1 < inicios.length ? inicios[i + 1].pos : service.length;
      const corpo = service.slice(ini.pos, fim);
      if (!corpo.includes('chamadoIncludeDetalhe')) return;
      if (!corpo.includes('podarReferencias')) semPoda.push(ini.nome);
    });

    expect(semPoda).toEqual([]);
  });

  it('a poda usa o gate de LEITURA, não a regra da listagem', () => {
    // 28/08: `criarReferencias` conferia contra `regraDeVisibilidade` (a FILA) e ficava
    // mais estreita que a leitura — quem ABRIA o chamado não conseguia citá-lo. As três
    // pontas (ler, escrever o laço, podar o laço) têm de fazer a MESMA pergunta.
    const corpoPoda = service.slice(
      service.indexOf('private podarReferencias'),
      service.indexOf('private regraDeVisibilidade'),
    );
    expect(corpoPoda).toContain('podeLerChamado');
    expect(corpoPoda).not.toContain('regraDeVisibilidade');

    const corpoCitar = service.slice(
      service.indexOf('private async criarReferencias'),
      service.indexOf('private podeLerChamado'),
    );
    expect(corpoCitar).toContain('podeLerChamado');
    expect(corpoCitar).not.toContain('regraDeVisibilidade');
  });
});
