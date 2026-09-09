/**
 * ⭐⭐ A aplicação deixou de ser imutável — e o que ela NÃO deixa mudar é o que
 * este arquivo guarda primeiro. O erro que isto evita acontece no PRIMEIRO USO:
 * a gestora monta a aplicação sozinha, sem treino, e "escolhi o modelo errado e
 * não dá para corrigir" era o defeito mais provável do piloto.
 */
import { efeitoDeApagar, motivoParaNaoEditar } from './efeito-de-editar.js';

const RASCUNHO = { cicloStatus: 'RASCUNHO', avaliacoesQueContam: 0, avaliacoesTotais: 0, publico: 0 };
const ABERTO = { cicloStatus: 'ABERTO', avaliacoesQueContam: 12, avaliacoesTotais: 12, publico: 32 };

describe('o que muda numa aplicação, e quando', () => {
  it('nome muda sempre — é rótulo, não muda nota de ninguém', () => {
    expect(motivoParaNaoEditar('nome', RASCUNHO)).toBeNull();
    expect(motivoParaNaoEditar('nome', ABERTO)).toBeNull();
  });

  it('peso e critérios só em RASCUNHO — depois mudariam a NOTA de quem já respondeu', () => {
    expect(motivoParaNaoEditar('pesoAvaliacao', RASCUNHO)).toBeNull();
    expect(motivoParaNaoEditar('criterios', RASCUNHO)).toBeNull();
    const motivo = motivoParaNaoEditar('pesoAvaliacao', ABERTO);
    expect(motivo).toMatch(/RASCUNHO/);
    expect(motivo).toMatch(/ABERTO/);
    // ⭐ A recusa diz a CONSEQUÊNCIA, não só a regra.
    expect(motivo).toMatch(/nota de quem já respondeu/i);
  });

  /**
   * ⛔ O caso mais perigoso: público montado para um questionário passa a
   * responder outro, sem nada mudar de aparência na tela.
   */
  it('o MODELO não troca nunca — nem com o ciclo em rascunho e sem ninguém no público', () => {
    expect(motivoParaNaoEditar('modeloVersaoId', RASCUNHO)).not.toBeNull();
    expect(motivoParaNaoEditar('modeloVersaoId', ABERTO)).not.toBeNull();
  });

  it('e a recusa do modelo DIZ A SAÍDA — que muda conforme já haver avaliação', () => {
    expect(motivoParaNaoEditar('modeloVersaoId', RASCUNHO)).toMatch(/apague-a e crie outra/i);
    expect(motivoParaNaoEditar('modeloVersaoId', ABERTO)).toMatch(/nem apagar resolve/i);
  });
});

describe('o que apagar leva junto', () => {
  it('com avaliação gerada, RECUSA — e manda excluir na Designação, que não apaga nada', () => {
    const e = efeitoDeApagar({ cicloStatus: 'ABERTO', avaliacoesQueContam: 12, avaliacoesTotais: 12, publico: 32 });
    expect(e.podeApagar).toBe(false);
    expect(e.frase).toMatch(/avaliações: 12/);
    expect(e.frase).toMatch(/CANCELADAS/);
  });

  /**
   * ⭐⭐ "Sem avaliação" não quer dizer "vazia": o público de 32 foi montado a
   * mão, centro de custo por centro de custo. Confirmação que diz só "apagar
   * esta aplicação?" esconde justamente o trabalho que vai embora.
   */
  it('sem avaliação mas COM público, a frase diz o NÚMERO de pessoas que vão junto', () => {
    const e = efeitoDeApagar({ cicloStatus: 'RASCUNHO', avaliacoesQueContam: 0, avaliacoesTotais: 0, publico: 32 });
    expect(e.podeApagar).toBe(true);
    expect(e.frase).toMatch(/pessoas no público: 32/);
    expect(e.frase).toMatch(/não são apagadas do cadastro/i);
  });

  it('sem público e sem avaliação, diz que não leva nada — e não inventa alarme', () => {
    const e = efeitoDeApagar({ cicloStatus: 'RASCUNHO', avaliacoesQueContam: 0, avaliacoesTotais: 0, publico: 0 });
    expect(e.podeApagar).toBe(true);
    expect(e.frase).toMatch(/não leva nada junto/i);
    expect(e.frase).not.toMatch(/pessoas no público: 0/);
  });

  /**
   * ⭐⭐ O CASO QUE O INVARIANTE DAS CONTAGENS FEZ APARECER (09/09).
   *
   * Eu tinha UM número ("avaliações") e o invariante recusou o `_count` sem
   * filtro. Ao separar em dois, o caso do meio ficou visível: **nenhuma
   * avaliação viva, mas há cancelada.** Não há trabalho a preservar — há
   * TRILHA, e o motivo do cancelamento é o que responde por que aquelas pessoas
   * ficaram sem nota. Com um número só, este caso teria virado "pode apagar",
   * e a resposta iria junto.
   */
  it('só canceladas: recusa por causa da TRILHA, não do trabalho', () => {
    const e = efeitoDeApagar({
      cicloStatus: 'RASCUNHO',
      avaliacoesQueContam: 0,
      avaliacoesTotais: 5,
      publico: 9,
    });
    expect(e.podeApagar).toBe(false);
    expect(e.frase).toMatch(/canceladas: 5/);
    expect(e.frase).toMatch(/motivo de ter ficado sem nota/i);
    // ⚠️ E não repete a frase do trabalho: a razão da recusa é outra.
    expect(e.frase).not.toMatch(/trabalho dos avaliadores/);
  });
});
