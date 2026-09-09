/**
 * ⭐⭐ REABRIR O CICLO É ATO EM MASSA — e o mínimo do motivo tem de dizer isso.
 *
 * Ele nasceu com `MOTIVO_MINIMO` (3), por analogia com o reabrir AVALIAÇÃO:
 * mesmo verbo, alcance oposto. Reabrir o ciclo devolve designação, público e
 * apuração do ciclo INTEIRO, e quem estava fora volta a poder entrar — é o
 * alcance que `MOTIVO_MINIMO_EM_MASSA` descreve.
 *
 * ⚠️ Este teste existe porque a mudança 3 → 15 **não quebrou nada** (09/09):
 * nenhum dos 564 testes cobria o mínimo do reabrir. Regra sem teste é regra que
 * a próxima refatoração desfaz em silêncio.
 */
import { BadRequestException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { CicloService } from './ciclo.service.js';
import { MOTIVO_MINIMO, MOTIVO_MINIMO_EM_MASSA } from '../common/motivo.js';

const CICLO = 'ciclo-1';
const RH = 'user-rh';

describe('CicloService.reabrir — mínimo do motivo', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: CicloService;

  beforeEach(() => {
    prisma = createPrismaMock();
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new CicloService(prisma as never, auditoria as never);
    prisma.ciclo.findUnique.mockResolvedValue({
      id: CICLO, nome: 'Piloto', status: 'ENCERRADO', encerradoEm: new Date(),
    });
    prisma.ciclo.update.mockResolvedValue({ id: CICLO, status: 'ABERTO' });
  });

  it('recusa motivo vazio', async () => {
    await expect(service.reabrir(CICLO, '   ', RH)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa o mínimo de UMA LINHA — é o erro que ele tinha', async () => {
    // "xpt" tem 3: passava antes, e é exatamente o que não responde nada.
    const curto = 'x'.repeat(MOTIVO_MINIMO);
    await expect(service.reabrir(CICLO, curto, RH)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ciclo.update).not.toHaveBeenCalled();
  });

  it('recusa 1 caractere abaixo do mínimo em massa, e DIZ quantos faltam', async () => {
    const quase = 'a'.repeat(MOTIVO_MINIMO_EM_MASSA - 1);
    await expect(service.reabrir(CICLO, quase, RH)).rejects.toThrow(/faltam 1\b/);
  });

  it('aceita no mínimo em massa e grava o motivo', async () => {
    const bom = 'b'.repeat(MOTIVO_MINIMO_EM_MASSA);
    await service.reabrir(CICLO, bom, RH);
    expect(prisma.ciclo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ motivoReabertura: bom }) }),
    );
  });

  it('o mínimo em massa é MAIOR que o de uma linha — senão o teste acima não prova nada', () => {
    expect(MOTIVO_MINIMO_EM_MASSA).toBeGreaterThan(MOTIVO_MINIMO);
  });
});
