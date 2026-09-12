import { describe, it, expect } from 'vitest';
import { motivoCicloEncerrado } from './ciclo-encerrado';

/**
 * ⭐⭐ Gêmeo de `backend/ciclo/ciclo-operavel.ts`. A divergência aqui é MUDA:
 * mais frouxa deixa clicar onde a API recusa (o clique volta com erro); mais
 * dura trava um botão que a API aceitaria, e **ninguém reclama de um botão
 * cinza** — a pessoa conclui que não pode e vai embora.
 */
describe('motivoCicloEncerrado — `null` quando pode escrever', () => {
  it.each(['RASCUNHO', 'ABERTO'])('%s aceita escrita', (status) => {
    expect(motivoCicloEncerrado({ status })).toBeNull();
  });

  it('ENCERRADO devolve o motivo', () => {
    expect(motivoCicloEncerrado({ status: 'ENCERRADO' })).toMatch(/Ciclo encerrado/);
  });

  /**
   * ⚠️ O contrato com o chamador é `disabled={!!motivo}` + `title={motivo}`.
   * Devolver string vazia em vez de `null` faria o botão ficar habilitado com
   * title vazio — passa no olho e quebra o padrão.
   */
  it('nunca devolve string vazia — ou é null, ou tem texto', () => {
    for (const status of ['RASCUNHO', 'ABERTO', 'ENCERRADO', 'QUALQUER_COISA']) {
      const m = motivoCicloEncerrado({ status });
      expect(m === null || m.length > 20).toBe(true);
    }
  });

  /** ⚠️ Status desconhecido NÃO trava: o certo é deixar a API decidir. */
  it('status desconhecido não bloqueia', () => {
    expect(motivoCicloEncerrado({ status: 'STATUS_QUE_NAO_EXISTE' })).toBeNull();
  });

  it('a data entra quando existe, e a frase funciona sem ela', () => {
    expect(motivoCicloEncerrado({ status: 'ENCERRADO', encerradoEm: '2026-09-10' })).toContain(
      'em 10/09/2026',
    );
    expect(motivoCicloEncerrado({ status: 'ENCERRADO', encerradoEm: null })).not.toContain(' em ');
  });

  /**
   * ⭐ A frase é `title` nativo, que o navegador CORTA — e o que se perde é
   * sempre o fim. Por isso a ação e o responsável vêm antes do detalhe, e o
   * conjunto é curto. Testado porque o tamanho é a razão de a frase ser assim.
   */
  it('cabe num title: curta, com a ação e o responsável dentro', () => {
    const m = motivoCicloEncerrado({ status: 'ENCERRADO', encerradoEm: '2026-09-10' })!;
    expect(m.length).toBeLessThan(140);
    expect(m).toMatch(/Reabra/);
    expect(m).toMatch(/RH_ADMIN/);
  });
});
