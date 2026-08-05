import { LimiteDiarioService } from './limite-diario.service';
import { LimiteDiarioAtingidoException } from './limite-diario.exception';
import { ConsumoIndevidoBloqueadoException } from './consumo-indevido.exception';

/**
 * Freio automático de consumo indevido (cStat=656).
 *
 * O que estes testes protegem: o 656 é a marcação que a SEFAZ põe no
 * CERTIFICADO consulente. Como o mTLS usa um certificado único para todas as
 * filiais, não existe "tentar por outra filial" que escape — a única resposta
 * correta é parar TODAS as consultas. Se alguma dessas regras cair, a
 * plataforma volta a mandar consulta com o CNPJ já marcado.
 */

/** `dataContador` de hoje na leitura do serviço (Y/M/D em UTC == dia BRT). */
function hojeBrt(): Date {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

function cfgBase(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    limiteDiario: 2000,
    alertaAmarelo: 1600,
    alertaVermelho: 1800,
    contadorHoje: 10,
    dataContador: hojeBrt(),
    pausadoAutomatico: false,
    pausadoEm: null,
    alertasEnviadosHoje: null,
    bloqueio656Ate: null,
    bloqueio656Em: null,
    bloqueio656Motivo: null,
    atualizadoEm: new Date(),
    atualizadoPor: null,
    ...over,
  };
}

describe('LimiteDiarioService — freio de consumo indevido (cStat=656)', () => {
  let service: LimiteDiarioService;
  let update: jest.Mock;
  let findUnique: jest.Mock;
  let send: jest.Mock;

  function build(cfg: Record<string, unknown>) {
    findUnique = jest.fn().mockResolvedValue(cfg);
    // Simula o `{ increment: n }` do Prisma — sem isso o contador do retorno
    // viria como o próprio objeto de operação.
    update = jest.fn().mockImplementation(({ data }) => {
      const aplicado: Record<string, unknown> = { ...data };
      if (data?.contadorHoje && typeof data.contadorHoje === 'object') {
        aplicado.contadorHoje = (cfg.contadorHoje as number) + data.contadorHoje.increment;
      }
      return Promise.resolve({ ...cfg, ...aplicado });
    });
    send = jest.fn().mockResolvedValue({ sent: true });
    const prisma = { limiteDiario: { findUnique, update, create: jest.fn() } };
    const mail = { send };
    const destinatarios = {
      resolveByRoles: jest.fn().mockResolvedValue({
        destinatarios: [{ email: 'fiscal@capul.com.br' }],
        fallback: false,
      }),
    };
    service = new LimiteDiarioService(prisma as never, mail as never, destinatarios as never);
  }

  it('bloqueio ativo → recusa a consulta e NÃO incrementa o contador', async () => {
    build(cfgBase({ bloqueio656Ate: new Date(Date.now() + 30 * 60_000) }));

    await expect(service.checkAndIncrement()).rejects.toBeInstanceOf(
      ConsumoIndevidoBloqueadoException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('bloqueio 656 tem precedência sobre o corte diário', async () => {
    // Se caísse no LimiteDiarioAtingido, o operador leria "limite diário" e
    // esperaria a virada do dia — diagnóstico errado para uma marcação SEFAZ.
    build(
      cfgBase({
        pausadoAutomatico: true,
        contadorHoje: 2000,
        bloqueio656Ate: new Date(Date.now() + 30 * 60_000),
      }),
    );

    await expect(service.checkAndIncrement()).rejects.toBeInstanceOf(
      ConsumoIndevidoBloqueadoException,
    );
    await expect(service.checkAndIncrement()).rejects.not.toBeInstanceOf(
      LimiteDiarioAtingidoException,
    );
  });

  it('bloqueio vencido → volta a deixar consultar', async () => {
    build(cfgBase({ bloqueio656Ate: new Date(Date.now() - 60_000) }));

    await expect(service.checkAndIncrement()).resolves.toBe(11);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { contadorHoje: { increment: 1 } } }),
    );
  });

  it('bloquearPorConsumoIndevido grava janela de ~1h e o motivo', async () => {
    build(cfgBase());
    const antes = Date.now();

    await service.bloquearPorConsumoIndevido('NFeDistribuicaoDFe/consChNFe', 'Consumo Indevido');

    const data = update.mock.calls[0]![0].data;
    const janelaMs = (data.bloqueio656Ate as Date).getTime() - antes;
    expect(janelaMs).toBeGreaterThan(59 * 60_000);
    expect(janelaMs).toBeLessThanOrEqual(60 * 60_000 + 1_000);
    expect(data.bloqueio656Motivo).toContain('NFeDistribuicaoDFe/consChNFe');
    expect(data.bloqueio656Motivo).toContain('Consumo Indevido');
  });

  it('falha ao gravar o freio não mascara o 656 original', async () => {
    build(cfgBase());
    update.mockRejectedValue(new Error('banco fora'));

    // Não pode lançar: quem chama está no meio de propagar o SefazConsultaError,
    // e trocar aquele erro por "banco fora" esconderia a causa real.
    await expect(
      service.bloquearPorConsumoIndevido('NfeConsultaProtocolo', 'Consumo Indevido'),
    ).resolves.toBeUndefined();
  });

  it('reset diário NÃO limpa o freio 656', async () => {
    // Um 656 às 23:50 tem que seguir valendo depois das 00:05 — a SEFAZ não
    // zera a marcação dela porque o nosso contador virou o dia.
    build(cfgBase({ bloqueio656Ate: new Date(Date.now() + 30 * 60_000) }));

    await service.reset('sistema:cron');

    const data = update.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty('bloqueio656Ate');
    expect(data).toHaveProperty('pausadoAutomatico', false);
  });

  it('liberarManual limpa o freio 656 (escape hatch do ADMIN_TI)', async () => {
    build(cfgBase({ bloqueio656Ate: new Date(Date.now() + 30 * 60_000) }));

    await service.liberarManual('admin@capul.com.br');

    const data = update.mock.calls[0]![0].data;
    expect(data.bloqueio656Ate).toBeNull();
    expect(data.bloqueio656Motivo).toBeNull();
    expect(data.pausadoAutomatico).toBe(false);
  });

  it('getStatus expõe o freio ativo com minutos restantes', async () => {
    build(cfgBase({ bloqueio656Ate: new Date(Date.now() + 30 * 60_000), bloqueio656Motivo: 'x' }));

    const status = await service.getStatus();

    expect(status.bloqueio656Ativo).toBe(true);
    expect(status.bloqueio656MinutosRestantes).toBeGreaterThan(25);
    expect(status.bloqueio656MinutosRestantes).toBeLessThanOrEqual(30);
  });

  it('getStatus não reporta freio vencido como ativo', async () => {
    build(cfgBase({ bloqueio656Ate: new Date(Date.now() - 60_000), bloqueio656Motivo: 'x' }));

    const status = await service.getStatus();

    expect(status.bloqueio656Ativo).toBe(false);
    expect(status.bloqueio656Motivo).toBeNull();
    expect(status.bloqueio656MinutosRestantes).toBe(0);
  });
});
