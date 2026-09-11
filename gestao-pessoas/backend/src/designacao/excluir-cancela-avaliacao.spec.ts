/**
 * ⭐⭐ "EXCLUIR" PASSA A CANCELAR A AVALIAÇÃO — o beco de 08/09.
 *
 * Até aqui `decidir` escrevia UMA linha em `ciclo_elegibilidade` e mais nada: a
 * pessoa saía da vista do RH e a avaliação dela continuava PENDENTE na fila do
 * avaliador e no contador do `encerrar`. "Excluir" não fazia o que a palavra
 * promete — e a recusa do "Tirar do público" mandava cancelar a avaliação, ato
 * que não existia em lugar nenhum do módulo.
 */
import { BadRequestException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { DesignacaoService } from './designacao.service.js';

const CICLO = 'ciclo-1';
const PESSOA = 'c1';
const RH = 'user-rh';
const MOTIVO = 'Desligada em 05/09';

describe('DesignacaoService.decidir — EXCLUIR cancela a avaliação', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: DesignacaoService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new DesignacaoService(prisma as never, auditoria as never);
    prisma.ciclo.findUnique.mockResolvedValue({ status: 'ABERTO', encerradoEm: null });
    prisma.cicloElegibilidade.create.mockResolvedValue({ id: 'eleg-1' });
    prisma.colaborador.findUnique.mockResolvedValue({ nome: 'ADAO BATISTA' });
  });

  const avaliacaoNoBanco = (status: string, respostas = 0) =>
    prisma.avaliacao.findUnique.mockResolvedValue({
      id: 'av-1',
      status,
      avaliadorId: 'av-adao',
      _count: { respostas },
    });

  it('sem avaliação, só registra a decisão — como sempre fez', async () => {
    const r = await service.decidir(CICLO, PESSOA, 'EXCLUIR', MOTIVO, RH);
    expect(prisma.avaliacao.update).not.toHaveBeenCalled();
    expect(r.avaliacaoCancelada).toBe(false);
  });

  /**
   * ⭐⭐ MUDOU EM 11/09, e o teste antigo dizia o contrário: *"INCLUIR nem
   * procura avaliação — não é o assunto dele"*. Era, sim: o modal do Excluir
   * promete que o Incluir reverte, e ele não revertia nada. Agora o INCLUIR
   * OLHA a avaliação — é como cumpre a promessa.
   *
   * ⚠️ Mas só desfaz o que ELE causou: sem avaliação cancelada por `DECISAO_RH`,
   * não escreve nada.
   */
  it('INCLUIR procura a avaliação, e não escreve quando não há o que desfazer', async () => {
    await service.decidir(CICLO, PESSOA, 'INCLUIR', 'Volta pelo ciclo', RH);
    expect(prisma.avaliacao.findUnique).toHaveBeenCalled();
    expect(prisma.avaliacao.update).not.toHaveBeenCalled();
  });

  it.each(['PENDENTE', 'EM_ANDAMENTO'])('%s: cancela junto com a decisão', async (status) => {
    avaliacaoNoBanco(status, 3);
    const r = await service.decidir(CICLO, PESSOA, 'EXCLUIR', MOTIVO, RH);
    expect(r.avaliacaoCancelada).toBe(true);
    const dados = prisma.avaliacao.update.mock.calls[0][0].data;
    expect(dados.status).toBe('CANCELADA');
    expect(dados.canceladaPorId).toBe(RH);
    expect(dados.motivoCancelamento).toContain(MOTIVO);
  });

  /**
   * ⭐ A justificativa da exclusão É o motivo do cancelamento: são o mesmo ato,
   * e duas frases diferentes para ele só criariam dúvida seis meses depois.
   */
  it('o motivo do cancelamento carrega a justificativa da exclusão', async () => {
    avaliacaoNoBanco('PENDENTE');
    await service.decidir(CICLO, PESSOA, 'EXCLUIR', MOTIVO, RH);
    expect(prisma.avaliacao.update.mock.calls[0][0].data.motivoCancelamento).toBe(
      `Excluído do ciclo pelo RH: ${MOTIVO}`,
    );
  });

  it('a auditoria registra o cancelamento como ato próprio, além da decisão', async () => {
    avaliacaoNoBanco('EM_ANDAMENTO', 12);
    await service.decidir(CICLO, PESSOA, 'EXCLUIR', MOTIVO, RH);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Avaliacao',
        acao: 'CANCELAR',
        valorAnterior: { status: 'EM_ANDAMENTO', respostas: 12 },
      }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: 'CicloElegibilidade', acao: 'DECIDIR_EXCLUIR' }),
    );
  });

  /** ⚠️ Nenhuma resposta é apagada — cancelar tira a avaliação da CONTA. */
  it('não apaga resposta nenhuma', async () => {
    avaliacaoNoBanco('EM_ANDAMENTO', 12);
    await service.decidir(CICLO, PESSOA, 'EXCLUIR', MOTIVO, RH);
    expect(prisma.resposta.deleteMany).not.toHaveBeenCalled();
    expect(prisma.resposta.delete).not.toHaveBeenCalled();
  });

  describe('avaliação já ENVIADA', () => {
    beforeEach(() => avaliacaoNoBanco('ENVIADA', 15));

    it('recusa o Excluir inteiro — e ensina a ordem', async () => {
      await expect(service.decidir(CICLO, PESSOA, 'EXCLUIR', MOTIVO, RH)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.decidir(CICLO, PESSOA, 'EXCLUIR', MOTIVO, RH)).rejects.toThrow(
        /reabra a avaliação primeiro/i,
      );
    });

    /** ⚠️ A recusa é ANTES da transação: decisão registrada com avaliação
     *  enviada seria de novo o estado partido que este conserto veio fechar. */
    it('e não registra decisão nenhuma', async () => {
      await expect(service.decidir(CICLO, PESSOA, 'EXCLUIR', MOTIVO, RH)).rejects.toThrow();
      expect(prisma.cicloElegibilidade.create).not.toHaveBeenCalled();
      expect(prisma.avaliacao.update).not.toHaveBeenCalled();
    });
  });

  it('avaliação já CANCELADA: a decisão passa, sem cancelar de novo', async () => {
    avaliacaoNoBanco('CANCELADA', 3);
    const r = await service.decidir(CICLO, PESSOA, 'EXCLUIR', MOTIVO, RH);
    expect(r.avaliacaoCancelada).toBe(false);
    expect(prisma.avaliacao.update).not.toHaveBeenCalled();
  });

  it('ciclo ENCERRADO continua barrando antes de tudo', async () => {
    prisma.ciclo.findUnique.mockResolvedValue({ status: 'ENCERRADO', encerradoEm: new Date() });
    avaliacaoNoBanco('PENDENTE');
    await expect(service.decidir(CICLO, PESSOA, 'EXCLUIR', MOTIVO, RH)).rejects.toThrow(
      /reabra o ciclo/i,
    );
    expect(prisma.avaliacao.update).not.toHaveBeenCalled();
  });
});
