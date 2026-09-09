/**
 * ⭐⭐ O instrumento do sinal #5 do piloto: se a designação do cadastro
 * corresponde à chefia real. O que ele NÃO pode fazer é tão importante quanto o
 * que faz — por isso as duas primeiras asserções são sobre o que fica INTACTO.
 */
import { ForbiddenException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { AvaliacaoService } from './avaliacao.service.js';
import { ACAO_FALTA_GENTE, ACAO_NAO_E_MINHA_EQUIPE } from './contestacao.js';

const CONTEXTO = { usuarioId: 'user-1', colaboradorId: 'chefe-1', ip: '10.0.0.1' };

describe('"não é minha equipe" — registra e não muda nada', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let acesso: { carregarParaAcao: jest.Mock };
  let service: AvaliacaoService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn() };
    acesso = {
      carregarParaAcao: jest.fn().mockResolvedValue({
        id: 'av-1', avaliadoId: 'colab-9', avaliadorId: 'chefe-1', cicloId: 'ciclo-1',
      }),
    };
    prisma.colaborador.findUnique.mockResolvedValue({
      nome: 'JOANA DA SILVA', matricula: '004321', centroCusto: '21010101',
    });
    service = new AvaliacaoService(prisma as never, acesso as never, auditoria as never);
  });

  it('NÃO altera a designação nem a avaliação — só escreve na trilha', async () => {
    await service.contestarDesignacao(CONTEXTO as never, 'av-1', 'Ela saiu do meu setor em julho.');
    expect(prisma.avaliacao.update).not.toHaveBeenCalled();
    expect(prisma.designacaoPadrao.create).not.toHaveBeenCalled();
    expect(prisma.designacaoPadrao.update).not.toHaveBeenCalled();
  });

  it('passa pela porta da designação — quem contesta é quem está com a linha', async () => {
    await service.contestarDesignacao(CONTEXTO as never, 'av-1', 'Não é da minha equipe.');
    expect(acesso.carregarParaAcao).toHaveBeenCalledWith(CONTEXTO, 'av-1', 'contestar');
  });

  it('a trilha guarda QUEM, QUEM foi apontado e o motivo escrito', async () => {
    await service.contestarDesignacao(CONTEXTO as never, 'av-1', 'Ela é do CD, não da loja.');
    const registro = auditoria.registrar.mock.calls[0][0];
    expect(registro).toMatchObject({
      entidade: 'Avaliacao', entidadeId: 'av-1', acao: ACAO_NAO_E_MINHA_EQUIPE, usuarioId: 'user-1',
    });
    expect(registro.justificativa).toBe('Ela é do CD, não da loja.');
    expect(registro.valorNovo).toMatchObject({
      avaliadoNome: 'JOANA DA SILVA', avaliadoMatricula: '004321', designacaoAlterada: false,
    });
  });

  /**
   * ⚠️ A parte que não pode faltar. Sem ela o avaliador clica, entende que
   * resolveu, não responde — e o ciclo perde a avaliação sem ninguém saber.
   */
  it('a confirmação DIZ que a avaliação continua com ele, e diz o nome', async () => {
    const r = await service.contestarDesignacao(CONTEXTO as never, 'av-1', 'Não é minha.');
    expect(r.frase).toMatch(/CONTINUA COM VOCÊ/);
    expect(r.frase).toMatch(/respondida/);
    expect(r.frase).toContain('JOANA DA SILVA');
  });
});

describe('"falta gente na minha equipe" — a outra metade do sinal', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: AvaliacaoService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn() };
    service = new AvaliacaoService(prisma as never, {} as never, auditoria as never);
  });

  it('registra no CICLO — não tem linha para pendurar, é sobre quem NÃO está', async () => {
    prisma.avaliacao.count.mockResolvedValue(23);
    const r = await service.relatarFaltaDeGente(CONTEXTO as never, 'ciclo-1', 'Falta o TIAGO, da expedição.');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: 'Ciclo', entidadeId: 'ciclo-1', acao: ACAO_FALTA_GENTE }),
    );
    expect(r.frase).toMatch(/responda as avaliações que já estão na sua fila/i);
  });

  it('só quem tem fila no ciclo relata — senão qualquer um escreve na trilha alheia', async () => {
    prisma.avaliacao.count.mockResolvedValue(0);
    await expect(
      service.relatarFaltaDeGente(CONTEXTO as never, 'ciclo-1', 'Falta gente.'),
    ).rejects.toThrow(ForbiddenException);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });
});
