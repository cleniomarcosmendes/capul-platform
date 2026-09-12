/**
 * ⭐⭐ A PRÓPRIA NOTA NÃO FICA VISÍVEL — em nenhuma superfície, em nenhum papel.
 *
 * Extensão da separação de funções decidida em 11/09/2026: a regra vale para
 * **LER**, não só para AGIR. Antes disso:
 *
 *   CSV do ciclo ........ omitia a própria linha        ✅
 *   tela de Resultados .. mostrava nota, conceito e o    🔴
 *                         botão da memória de cálculo
 *   memória de cálculo .. devolvia tudo, e apenas         🔴
 *                         REGISTRAVA `proprioResultado`
 *
 * Mesma regra, três superfícies, duas esquecidas — e a dispensa do invariante
 * afirmava por escrito que na tela bastava marcar. É o padrão "cinco certos,
 * dois esquecidos": o que falha não é a regra, é a varredura.
 *
 * ⚠️ Este spec existe para que a próxima superfície que devolver nota tenha de
 * passar por aqui. Se você está lendo isto porque um teste quebrou ao criar uma
 * rota nova: a rota precisa aplicar a regra, não o teste precisa de exceção.
 */
import { ForbiddenException } from '@nestjs/common';
import { ResultadoService } from './resultado.service.js';
import { createPrismaMock } from '../common/testing/prisma-mock.js';

const EU = 'colab-eu';
const OUTRA = 'colab-outra';

function linhaCrua(id: string, avaliadoId: string, colaboradorId: string) {
  return {
    id,
    avaliacaoId: `av-${id}`,
    colaboradorId,
    notaAvaliacao: 80,
    notaCriterios: 60,
    notaFinal: 75,
    conceitoDescricao: 'Atende',
    houveRenormalizacao: true,
    calculadoEm: new Date('2026-09-11'),
    avaliacao: {
      avaliadoId,
      cargoSnapshot: 'Analista',
      centroCustoSnapshot: 'CC1',
      filialSnapshot: '01',
      aplicacao: { nome: 'Administrativo' },
    },
  };
}

function servico() {
  const prisma = createPrismaMock();
  prisma.resultadoAvaliacao.findMany.mockResolvedValue([
    linhaCrua('r1', EU, EU),
    linhaCrua('r2', OUTRA, OUTRA),
  ]);
  prisma.colaborador.findMany.mockResolvedValue([
    { id: EU, nome: 'Eu Mesma', matricula: '000001', cargoDescricao: 'Analista' },
    { id: OUTRA, nome: 'Outra Pessoa', matricula: '000002', cargoDescricao: 'Analista' },
  ]);
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const avaliacoes = { notaPorGrupoDa: jest.fn().mockResolvedValue([]),
    // ⚠️ Fixture nova em 12/09: a memória passou a trazer pergunta a pergunta.
    questoesRespondidasDa: jest.fn().mockResolvedValue([]) };
  return {
    svc: new ResultadoService(prisma as never, avaliacoes as never, auditoria as never),
    prisma,
    auditoria,
  };
}

describe('lista do ciclo — a linha aparece, o conteúdo não', () => {
  it('a própria linha vem SEM nota, conceito nem renormalização', async () => {
    const linhas = await servico().svc.doCiclo('c1', EU);
    const minha = linhas.find((l) => l.avaliadoId === EU)!;
    expect(minha.restrita).toBe(true);
    expect(minha.notaFinal).toBeNull();
    expect(minha.notaAvaliacao).toBeNull();
    expect(minha.notaCriterios).toBeNull();
    expect(minha.conceito).toBeNull();
    expect(minha.houveRenormalizacao).toBe(false);
  });

  /**
   * ⭐ A LINHA FICA. Omiti-la faria o total da tela divergir do total do ciclo
   * sem explicação — e quem não conhece a regra leria como avaliação faltando.
   */
  it('mas a linha CONTINUA na lista, com nome e matrícula', async () => {
    const linhas = await servico().svc.doCiclo('c1', EU);
    expect(linhas).toHaveLength(2);
    const minha = linhas.find((l) => l.avaliadoId === EU)!;
    expect(minha.nome).toBe('Eu Mesma');
    expect(minha.matricula).toBe('000001');
    expect(minha.motivoRestricao).toBeTruthy();
  });

  it('a linha dos OUTROS não muda', async () => {
    const linhas = await servico().svc.doCiclo('c1', EU);
    const dela = linhas.find((l) => l.avaliadoId === OUTRA)!;
    expect(dela.restrita).toBe(false);
    expect(dela.notaFinal).toBe(75);
    expect(dela.conceito).toBe('Atende');
  });

  /** RH que não é funcionário não tem linha própria — a lista sai inteira. */
  it('sem colaborador resolvido, nada é omitido', async () => {
    const linhas = await servico().svc.doCiclo('c1', null);
    expect(linhas.every((l) => l.notaFinal === 75)).toBe(true);
  });
});

describe('memória de cálculo — 403 na própria, em qualquer papel', () => {
  function comResultado(avaliadoId: string) {
    const { svc, prisma, auditoria } = servico();
    prisma.resultadoAvaliacao.findUnique.mockResolvedValue({
      id: 'r1',
      criterios: [],
      notaAvaliacao: 80,
      pesoAvaliacao: 60,
      notaCriterios: 60,
      notaFinal: 75,
      conceitoDescricao: 'Atende',
      houveRenormalizacao: false,
      calculadoEm: new Date(),
      colaboradorId: avaliadoId,
      avaliacaoId: 'av-1',
      ciclo: { nome: 'Ciclo', dataBase: new Date() },
      avaliacao: {
        id: 'av-1',
        avaliadoId,
        enviadaEm: new Date(),
        observacaoAvaliador: null,
        avaliadorId: 'chefe',
        cargoSnapshot: null,
        centroCustoSnapshot: null,
        aplicacao: { nome: 'Administrativo', pesoAvaliacao: 60 },
      },
    });
    prisma.criterio.findMany.mockResolvedValue([]);
    prisma.criterioFaixa.findMany.mockResolvedValue([]);
    prisma.colaborador.findUnique.mockResolvedValue({ nome: 'x', matricula: '1' });
    return { svc, auditoria };
  }

  it('recusa a memória da PRÓPRIA avaliação', async () => {
    const { svc } = comResultado(EU);
    await expect(
      svc.memoria('r1', { colaboradorId: EU, usuarioId: 'u1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  /** Tentativa é informação — o acesso negado também vira linha de auditoria. */
  it('e registra a tentativa em auditoria', async () => {
    const { svc, auditoria } = comResultado(EU);
    await expect(svc.memoria('r1', { colaboradorId: EU, usuarioId: 'u1' })).rejects.toThrow();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'ACESSO_NEGADO_PROPRIO_AVALIADO:memoria' }),
    );
  });

  it('a memória de OUTRA pessoa continua abrindo', async () => {
    const { svc } = comResultado(OUTRA);
    await expect(svc.memoria('r1', { colaboradorId: EU, usuarioId: 'u1' })).resolves.toBeTruthy();
  });

  /**
   * ⚠️ Sem `colaboradorId` a regra NÃO se aplica — e isso é deliberado: quem
   * não tem colaborador resolvido não tem avaliação própria. Não usar `===`
   * aqui é o que impede dois nulos de virarem "é o próprio".
   */
  it('sem colaborador resolvido não recusa', async () => {
    const { svc } = comResultado(EU);
    await expect(
      svc.memoria('r1', { colaboradorId: null, usuarioId: 'u1' }),
    ).resolves.toBeTruthy();
  });
});
