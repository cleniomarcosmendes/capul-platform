/**
 * ⭐⭐ REABRIR APAGA O RESULTADO APURADO — e registra a nota que apagou.
 *
 * Decisão de 09/09, entre três opções:
 *   RECUSAR com resultado → transformaria "apurei cedo para conferir o cálculo"
 *     (que a tela de Resultados diz ser legítimo) em porta fechada para o ciclo
 *     inteiro;
 *   MARCAR COMO VENCIDO → um terceiro estado que ninguém pediu, com o resultado
 *     antigo visível enquanto a avaliação está EM_ANDAMENTO;
 *   APAGAR → o que a reapuração já faz, disparado antes.
 *
 * ⚠️ O que este arquivo protege não é a exclusão em si: é o **rastro**.
 * Resultado apagado sem a nota na auditoria deixa "por que a média do ciclo
 * mudou" sem resposta — e a média de Resultados é calculada sobre as linhas que
 * existem.
 */
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { AvaliacaoService } from './avaliacao.service.js';
import { apagarResultadoDe } from '../apuracao/apagar-resultado.js';

const AVALIACAO = 'aval-1';
const CONTEXTO = { usuarioId: 'u-rh', colaboradorId: 'c-rh', ip: '10.0.0.1' } as never;

describe('apagarResultadoDe — a sequência, isolada', () => {
  it('apaga a memória de cálculo ANTES do resultado — a FK não perdoa a ordem', async () => {
    const ordem: string[] = [];
    const tx = {
      resultadoAvaliacao: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r1', notaFinal: '88.00', conceitoDescricao: 'BOM', calculadoEm: new Date('2026-09-09'),
        }),
        delete: jest.fn(async () => { ordem.push('resultado'); }),
      },
      resultadoCriterio: { deleteMany: jest.fn(async () => { ordem.push('criterios'); }) },
    };

    const apagado = await apagarResultadoDe(tx as never, AVALIACAO);

    expect(ordem).toEqual(['criterios', 'resultado']);
    expect(apagado).toMatchObject({ notaFinal: '88.00', conceitoDescricao: 'BOM' });
  });

  it('sem resultado devolve null — o caso normal de quem reabre antes de apurar', async () => {
    const tx = {
      resultadoAvaliacao: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn() },
      resultadoCriterio: { deleteMany: jest.fn() },
    };
    expect(await apagarResultadoDe(tx as never, AVALIACAO)).toBeNull();
    expect(tx.resultadoCriterio.deleteMany).not.toHaveBeenCalled();
  });
});

describe('AvaliacaoService.reabrir', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let acesso: { carregarParaAcao: jest.Mock };
  let service: AvaliacaoService;

  const montar = (resultado: Record<string, unknown> | null) => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    acesso = {
      carregarParaAcao: jest.fn().mockResolvedValue({ id: AVALIACAO, cicloId: 'ciclo-1' }),
      contextoDe: jest.fn(),
    } as never;
    service = new AvaliacaoService(prisma as never, acesso as never, auditoria as never);
    prisma.ciclo.findUniqueOrThrow.mockResolvedValue({ status: 'ABERTO', encerradoEm: null });
    prisma.resultadoAvaliacao.findUnique.mockResolvedValue(resultado);
    prisma.avaliacao.findUniqueOrThrow.mockResolvedValue({ id: AVALIACAO, status: 'EM_ANDAMENTO' });
    return service;
  };

  const COM_RESULTADO = {
    id: 'r1', notaFinal: '88.00', conceitoDescricao: 'BOM', calculadoEm: new Date('2026-09-09T13:02:00Z'),
  };

  it('recusa sem motivo — antes de qualquer leitura', async () => {
    await expect(montar(null).reabrir(CONTEXTO, AVALIACAO, '   ')).rejects.toThrow(/motivo/i);
  });

  it('⭐ apaga o resultado apurado e zera a nota do envio', async () => {
    const s = montar(COM_RESULTADO);
    await s.reabrir(CONTEXTO, AVALIACAO, 'respondeu a pessoa errada');

    expect(prisma.resultadoCriterio.deleteMany).toHaveBeenCalledWith({ where: { resultadoId: 'r1' } });
    expect(prisma.resultadoAvaliacao.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(prisma.avaliacao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EM_ANDAMENTO', notaAvaliacao: null }),
      }),
    );
  });

  /** ⚠️ O ponto do arquivo: sem isto o resultado some sem rastro. */
  it('⭐⭐ a auditoria guarda a NOTA apagada, não só o ato', async () => {
    const s = montar(COM_RESULTADO);
    await s.reabrir(CONTEXTO, AVALIACAO, 'nota lançada no colaborador errado');

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'REABRIR',
        justificativa: 'nota lançada no colaborador errado',
        valorAnterior: { resultadoApagado: expect.objectContaining({ notaFinal: '88.00', conceito: 'BOM' }) },
      }),
    );
  });

  it('sem resultado apurado, reabre igual e a auditoria não inventa valor anterior', async () => {
    const s = montar(null);
    await s.reabrir(CONTEXTO, AVALIACAO, 'ainda não apurada');

    expect(prisma.resultadoAvaliacao.delete).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'REABRIR', valorAnterior: undefined }),
    );
  });

  /** A prévia sai do MESMO registro que o ato vai apagar — nunca de uma conta da tela. */
  it('a prévia diz o que vai sumir, com a nota', async () => {
    const s = montar(COM_RESULTADO);
    const efeito = await s.efeitoDaReabertura(CONTEXTO, AVALIACAO);

    expect(efeito).toMatchObject({ apagaResultado: true, notaFinal: 88, conceito: 'BOM' });
    expect(acesso.carregarParaAcao).toHaveBeenCalledWith(CONTEXTO, AVALIACAO, 'reabrir');
  });

  it('a prévia passa pela MESMA porta do ato — quem não pode reabrir não vê nota alheia', async () => {
    const s = montar(COM_RESULTADO);
    acesso.carregarParaAcao.mockRejectedValueOnce(new Error('403'));
    await expect(s.efeitoDaReabertura(CONTEXTO, AVALIACAO)).rejects.toThrow('403');
  });
});
