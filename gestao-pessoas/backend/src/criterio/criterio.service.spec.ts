import { BadRequestException } from '@nestjs/common';
import { CriterioService } from './criterio.service.js';
import { createPrismaMock } from '../common/testing/prisma-mock.js';

function servico() {
  const prisma = createPrismaMock();
  prisma.criterio.findUnique.mockResolvedValue(null);
  prisma.criterio.create.mockImplementation(({ data }: never) => Promise.resolve({ id: 'c1', ...(data as object) }));
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  return { svc: new CriterioService(prisma as never, auditoria as never), prisma };
}

const base = {
  codigo: 'ZZ',
  nome: 'Zé',
  origem: 'INFORMADO' as const,
  tipoValor: 'NUMERICO' as const,
};

describe('CriterioService — o que a casca não pode desfazer', () => {
  /**
   * ⭐⭐ REGRESSÃO de um defeito real (11/09): a primeira versão zerava o
   * `codigoCalculo` por origem ANTES de validar —
   * `origem === 'CALCULADO' ? dto.codigoCalculo : null`. Com isso a regra
   * escrita em `criterio.validator` ("INFORMADO com código de cálculo: recuse")
   * **nunca era alcançada**: o service limpava o campo e o validador não via
   * nada errado.
   *
   * Sanitizar em silêncio o que a regra manda recusar é pior que não validar —
   * some com o sintoma e deixa quem trocou a origem achando que o cálculo
   * continua valendo. Pego exercitando o serviço contra o banco, não pela suíte.
   */
  it('INFORMADO com codigoCalculo preenchido é RECUSADO, não silenciosamente limpo', async () => {
    const { svc, prisma } = servico();
    await expect(
      svc.criar({ ...base, codigoCalculo: 'TEMPO_EMPRESA' }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.criterio.create).not.toHaveBeenCalled();
  });

  it('CALCULADO com código que não existe no registry é recusado', async () => {
    const { svc, prisma } = servico();
    await expect(
      svc.criar({ ...base, origem: 'CALCULADO', codigoCalculo: 'NAO_EXISTE' }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.criterio.create).not.toHaveBeenCalled();
  });

  it('CALCULADO com código registrado passa', async () => {
    const { svc } = servico();
    await expect(
      svc.criar({ ...base, origem: 'CALCULADO', codigoCalculo: 'TEMPO_EMPRESA' }, 'u1'),
    ).resolves.toMatchObject({ codigoCalculo: 'TEMPO_EMPRESA' });
  });

  /** INFORMADO grava `null`, mesmo tendo passado pela validação com o cru. */
  it('INFORMADO sem código de cálculo grava null', async () => {
    const { svc } = servico();
    await expect(svc.criar(base, 'u1')).resolves.toMatchObject({ codigoCalculo: null });
  });

  it('o código é normalizado para MAIÚSCULA — é identificador, não texto', async () => {
    const { svc } = servico();
    await expect(svc.criar({ ...base, codigo: 'meta_mensal' }, 'u1')).resolves.toMatchObject({
      codigo: 'META_MENSAL',
    });
  });
});
