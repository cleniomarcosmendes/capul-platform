/**
 * AJUSTAR O PERÍODO — e só o período.
 *
 * `periodoInicio`/`periodoFim` são rótulo: dizem de que intervalo o ciclo fala,
 * aparecem no painel e viram o prazo na fila do avaliador. Nenhuma conta os usa.
 * Quem ancora todo cálculo temporal é a `dataBase` — e é justamente por isso que
 * ela NÃO entra aqui.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { CicloService } from './ciclo.service.js';

const CICLO = 'ciclo-1';
const RH = 'user-rh';
const SETEMBRO = { inicio: new Date('2026-09-01'), fim: new Date('2026-09-30') };

describe('CicloService.ajustarPeriodo', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: CicloService;

  const cicloNoBanco = (status: string, dataBase = new Date('2026-09-15')) =>
    prisma.ciclo.findUnique.mockResolvedValue({
      id: CICLO,
      nome: 'Piloto',
      status,
      dataBase,
      periodoInicio: new Date('2026-01-01'),
      periodoFim: new Date('2026-12-31'),
      janelaTreinamentoMeses: 12,
    });

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new CicloService(prisma as never, auditoria as never);
    prisma.ciclo.update.mockResolvedValue({ id: CICLO });
  });

  it('ajusta e registra o de ANTES na auditoria', async () => {
    cicloNoBanco('ABERTO');
    await service.ajustarPeriodo(CICLO, SETEMBRO.inicio, SETEMBRO.fim, RH);

    expect(prisma.ciclo.update).toHaveBeenCalledWith({
      where: { id: CICLO },
      data: { periodoInicio: SETEMBRO.inicio, periodoFim: SETEMBRO.fim },
    });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'AJUSTAR_PERIODO',
        valorAnterior: expect.objectContaining({ periodoFim: new Date('2026-12-31') }),
      }),
    );
  });

  it('ciclo ABERTO pode: o período é rótulo, não entra em conta nenhuma', async () => {
    cicloNoBanco('ABERTO');
    await expect(service.ajustarPeriodo(CICLO, SETEMBRO.inicio, SETEMBRO.fim, RH)).resolves.toBeDefined();
  });

  it('⚠️ ciclo ENCERRADO não muda', async () => {
    // O resultado já foi materializado e a memória de cálculo dele fala de um
    // período que ficaria diferente do gravado.
    cicloNoBanco('ENCERRADO');
    await expect(service.ajustarPeriodo(CICLO, SETEMBRO.inicio, SETEMBRO.fim, RH)).rejects.toThrow(
      /ENCERRADO.*não muda/s,
    );
    expect(prisma.ciclo.update).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ `validarPeriodo` junta os problemas num ARRAY e o Nest o devolve dentro
   * do corpo, não na `message` da exceção — a tela mostra todos de uma vez. Por
   * isso o teste lê o payload: asserção em `.toThrow(/texto/)` passaria batido
   * aqui, porque `.message` é só "Bad Request Exception".
   */
  const problemasDe = async (fn: Promise<unknown>): Promise<string[]> => {
    try {
      await fn;
      throw new Error('não recusou');
    } catch (e) {
      const corpo = (e as BadRequestException).getResponse() as { message?: string[] };
      return corpo.message ?? [];
    }
  };

  it('⭐ período que deixa a DATA-BASE de fora é recusado', async () => {
    // A data-base ancora todo cálculo temporal. Deixá-la fora do período faria o
    // ciclo medir um momento que ele não cobre.
    cicloNoBanco('ABERTO', new Date('2026-11-20'));
    const problemas = await problemasDe(
      service.ajustarPeriodo(CICLO, SETEMBRO.inicio, SETEMBRO.fim, RH),
    );
    expect(problemas.join(' ')).toMatch(/data-base precisa estar dentro do período/);
    expect(prisma.ciclo.update).not.toHaveBeenCalled();
  });

  it('fim antes do início é recusado', async () => {
    cicloNoBanco('ABERTO');
    const problemas = await problemasDe(
      service.ajustarPeriodo(CICLO, SETEMBRO.fim, SETEMBRO.inicio, RH),
    );
    expect(problemas.join(' ')).toMatch(/fim do período é anterior/);
  });

  it('ciclo inexistente', async () => {
    prisma.ciclo.findUnique.mockResolvedValue(null);
    await expect(service.ajustarPeriodo(CICLO, SETEMBRO.inicio, SETEMBRO.fim, RH)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('⚠️ a data-base NÃO é tocada — mudá-la moveria a nota de quem já respondeu', async () => {
    cicloNoBanco('ABERTO');
    await service.ajustarPeriodo(CICLO, SETEMBRO.inicio, SETEMBRO.fim, RH);
    const [[chamada]] = prisma.ciclo.update.mock.calls;
    expect(chamada.data).not.toHaveProperty('dataBase');
    expect(chamada.data).not.toHaveProperty('janelaTreinamentoMeses');
  });
});
