import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntregaService } from './entrega.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const coreMock = () => ({ validarFilial: jest.fn().mockResolvedValue(undefined), colaboradorDoUsuario: jest.fn().mockResolvedValue(null) }) as any;
const cofreMock = () => ({ gravar: jest.fn().mockResolvedValue({ comprovanteId: 'cmp1', objectKey: 'k', hash: 'h' }) }) as any;
const geocodeMock = () => ({ geocodificar: jest.fn().mockResolvedValue(null), statusCacheLote: jest.fn().mockResolvedValue([]) }) as any;
const condutorMock = () => ({ validar: jest.fn().mockResolvedValue({ status: 'VALIDO', matricula: 'E00001', nome: 'Op' }) }) as any;
// Aprendizado de campo roda em background depois da baixa — aqui só não pode
// estourar. O comportamento dele tem suíte própria (local-aprendido.service.spec).
const localAprendidoMock = () => ({ reavaliar: jest.fn().mockResolvedValue({ promovido: false, amostras: 0, desvioM: null }) }) as any;
// Operador da filial f1 (não vê outras filiais) — exercita o escopo por filial.
const userF1 = { sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'OPERADOR_ENTREGA' }] } as any;

describe('EntregaService', () => {
  let prisma: any;
  let core: any;
  let cofre: any;
  let svc: EntregaService;

  beforeEach(() => {
    prisma = createPrismaMock();
    core = coreMock();
    cofre = cofreMock();
    svc = new EntregaService(prisma, core, cofre, geocodeMock(), condutorMock(), localAprendidoMock());
  });

  describe('create', () => {
    it('valida a filial no core e numera a entrega', async () => {
      prisma.contadorSequencial.upsert.mockResolvedValue({ ultimoNumero: 7 });
      prisma.entrega.create.mockResolvedValue({ id: 'e1', numero: 7, cupons: [] });
      const dto = { filialId: 'f1', tipoCliente: 'EVENTUAL', destinatarioNome: 'Cliente X', endLogradouro: 'Rua A', quantidadeVolumes: 1 } as any;
      const r = await svc.create(dto, userF1);
      expect(core.validarFilial).toHaveBeenCalledWith('f1');
      expect(prisma.entrega.create).toHaveBeenCalled();
      expect(r.numero).toBe(7);
    });
  });

  describe('cancelar', () => {
    it('404 se a entrega não existe', async () => {
      prisma.entrega.findUnique.mockResolvedValue(null);
      await expect(svc.cancelar('e1', undefined, 'u1', 'f1')).rejects.toThrow(NotFoundException);
    });
    it('403 se a entrega é de outra filial', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ status: 'PENDENTE', filialId: 'f2', parada: null });
      await expect(svc.cancelar('e1', undefined, 'u1', 'f1')).rejects.toThrow(ForbiddenException);
    });
    it('400 se a entrega não está PENDENTE', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ status: 'EM_VIAGEM', filialId: 'f1', parada: null });
      await expect(svc.cancelar('e1', undefined, 'u1', 'f1')).rejects.toThrow(BadRequestException);
    });
    it('400 se a entrega já está montada numa viagem (parada)', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ status: 'PENDENTE', filialId: 'f1', parada: { viagem: { numero: 5 } } });
      await expect(svc.cancelar('e1', undefined, 'u1', 'f1')).rejects.toThrow(BadRequestException);
    });
    it('happy path: cancela a entrega PENDENTE livre', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ status: 'PENDENTE', filialId: 'f1', parada: null });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'CANCELADA', cupons: [] });
      const r = await svc.cancelar('e1', 'cliente desistiu', 'u1', 'f1');
      expect(prisma.entrega.update).toHaveBeenCalled();
      expect(r.status).toBe('CANCELADA');
    });
  });

  describe('baixar', () => {
    it('404 se a entrega não existe', async () => {
      prisma.entrega.findUnique.mockResolvedValue(null);
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, {}, userF1)).rejects.toThrow(NotFoundException);
    });

    it('403 se a entrega é de outra filial (operador)', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'OUTRA', cupons: [], parada: null });
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, {}, userF1)).rejects.toThrow(ForbiddenException);
    });

    it('400 se a entrega não está EM_VIAGEM (ainda não despachada)', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'PENDENTE', filialId: 'f1', numero: 1, cupons: [], parada: null });
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, {}, userF1)).rejects.toThrow(BadRequestException);
    });

    it('idempotente: entrega já ENTREGUE devolve o estado atual sem regravar', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', filialId: 'f1', numero: 1, comprovanteId: 'cmp0', cupons: [], parada: null });
      const r = await svc.baixar('e1', { resultado: 'ENTREGUE' } as any, { foto: { buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 1 } }, userF1);
      expect(r.status).toBe('ENTREGUE');
      expect(cofre.gravar).not.toHaveBeenCalled();
      expect(prisma.entrega.update).not.toHaveBeenCalled();
    });

    it('400 NAO_ENTREGUE sem motivo', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 1, cupons: [], parada: { viagemId: 'v1' } });
      await expect(svc.baixar('e1', { resultado: 'NAO_ENTREGUE' } as any, {}, userF1)).rejects.toThrow(BadRequestException);
    });

    it('ENTREGUE com prova grava no cofre e seta temComprovante/comprovanteId', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, matricula: 'E01', cupons: [{ numeroCupom: 'C1' }], parada: { viagemId: 'v1' } });
      prisma.viagem.findUnique.mockResolvedValue({ situacao: 'EM_CURSO', veiculoId: 'vc1', paradas: [{ entrega: { status: 'ENTREGUE' } }] });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', temComprovante: true, comprovanteId: 'cmp1', cupons: [] });
      const r = await svc.baixar('e1', { resultado: 'ENTREGUE', tipoProva: 'FOTO' } as any, { foto: { buffer: Buffer.from('img'), mimetype: 'image/jpeg', size: 3 } }, userF1);
      expect(cofre.gravar).toHaveBeenCalledWith(expect.objectContaining({ entregaId: 'e1', entregaNumero: 9, filialId: 'f1', cupom: 'C1', tipo: 'FOTO' }));
      expect(r.temComprovante).toBe(true);
      // Auto-conclusão DESLIGADA (30/06): a baixa NÃO fecha mais a viagem — o
      // encerramento é explícito (ViagemService.concluir) p/ capturar o KM final.
      expect(prisma.viagem.update).not.toHaveBeenCalled();
      expect(prisma.veiculo.update).not.toHaveBeenCalled();
    });

    it('aceita FOTO + ASSINATURA juntas → grava 2 comprovantes no cofre', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, cupons: [], parada: { viagemId: 'v1' } });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', cupons: [] });
      await svc.baixar('e1', { resultado: 'ENTREGUE' } as any, { foto: { buffer: Buffer.from('f'), mimetype: 'image/jpeg', size: 1 }, assinatura: { buffer: Buffer.from('a'), mimetype: 'image/png', size: 1 } }, userF1);
      expect(cofre.gravar).toHaveBeenCalledTimes(2);
      expect(cofre.gravar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'FOTO' }));
      expect(cofre.gravar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'ASSINATURA' }));
    });

    it('não conclui a viagem se ainda há entrega pendente de baixa', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, cupons: [], parada: { viagemId: 'v1' } });
      prisma.viagem.findUnique.mockResolvedValue({ situacao: 'EM_CURSO', veiculoId: 'vc1', paradas: [{ entrega: { status: 'ENTREGUE' } }, { entrega: { status: 'EM_VIAGEM' } }] });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', cupons: [] });
      await svc.baixar('e1', { resultado: 'ENTREGUE', recebedorNome: 'Maria' } as any, {}, userF1);
      expect(prisma.viagem.update).not.toHaveBeenCalled();
      expect(prisma.veiculo.update).not.toHaveBeenCalled();
    });

    // ── Prova flexível (meio-termo): foto opcional, mas exige ALGUMA prova ──
    it('400 ENTREGUE sem prova (foto/assinatura) e sem recebedor', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, cupons: [], parada: { viagemId: 'v1' } });
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, {}, userF1)).rejects.toThrow(BadRequestException);
    });

    it('ENTREGUE só com recebedor (sem arquivo) baixa sem tocar o cofre', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, cupons: [], parada: { viagemId: 'v1' } });
      prisma.viagem.findUnique.mockResolvedValue({ situacao: 'EM_CURSO', veiculoId: 'vc1', paradas: [{ entrega: { status: 'EM_VIAGEM' } }] });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', temComprovante: false, cupons: [] });
      const r = await svc.baixar('e1', { resultado: 'ENTREGUE', recebedorNome: 'João Portaria' } as any, {}, userF1);
      expect(cofre.gravar).not.toHaveBeenCalled();
      expect(r.status).toBe('ENTREGUE');
    });
  });

  // A baixa pode gerar FOTO e ASSINATURA, mas `entrega.comprovanteId` guarda só
  // a primária (a foto). A lista precisa devolver TODAS, senão a assinatura fica
  // sem como ser aberta na tela de Comprovantes.
  describe('buscarBaixadas — provas da entrega', () => {
    const entregaBaixada = { id: 'e1', numero: 7, comprovanteId: 'cmp-foto', cupons: [] };

    it('devolve as duas provas quando a baixa tem foto e assinatura', async () => {
      prisma.entrega.findMany.mockResolvedValue([entregaBaixada]);
      cofre.provasPorEntregas = jest.fn().mockResolvedValue(
        new Map([['e1', [{ id: 'cmp-foto', tipo: 'FOTO' }, { id: 'cmp-assin', tipo: 'ASSINATURA' }]]]),
      );

      const [r] = await svc.buscarBaixadas({ filialId: 'f1' });

      expect(r.provas).toEqual([
        { id: 'cmp-foto', tipo: 'FOTO' },
        { id: 'cmp-assin', tipo: 'ASSINATURA' },
      ]);
      expect(r.comprovanteTipo).toBe('FOTO'); // badge segue a primária
    });

    it('cofre indisponível não derruba a lista (degrada sem as provas)', async () => {
      prisma.entrega.findMany.mockResolvedValue([entregaBaixada]);
      cofre.provasPorEntregas = jest.fn().mockRejectedValue(new Error('cofre fora'));

      const [r] = await svc.buscarBaixadas({ filialId: 'f1' });

      expect(r.provas).toEqual([]);
      expect(r.comprovanteTipo).toBeNull();
      expect(r.numero).toBe(7); // a linha continua utilizável
    });
  });
});

/**
 * ⭐ Ponto 2 (09/08) — DIA da entrega.
 *
 * Há locais atendidos em dias específicos: a rota daquela região só passa em certos
 * dias. O lançamento nasce com HOJE (caso normal do balcão) e a fila de montagem é
 * ordenada pelo dia.
 */
describe('EntregaService — data da entrega (ponto 2)', () => {
  let prisma: any;
  let svc: EntregaService;
  const criada = () => prisma.entrega.create.mock.calls[0][0].data;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new EntregaService(prisma, coreMock(), cofreMock(), geocodeMock(), condutorMock(), localAprendidoMock());
    prisma.contadorSequencial.upsert.mockResolvedValue({ ultimoNumero: 1 });
    prisma.entrega.create.mockResolvedValue({ id: 'e1', numero: 1, cupons: [] });
  });

  const dto = (extra: any = {}) =>
    ({ filialId: 'f1', tipoCliente: 'EVENTUAL', destinatarioNome: 'X', endLogradouro: 'Rua A', quantidadeVolumes: 1, ...extra }) as any;

  it('sem data informada → grava HOJE (não deixa nulo)', async () => {
    await svc.create(dto(), userF1);
    expect(criada().dataEntrega).toBeInstanceOf(Date);
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const gravado = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(criada().dataEntrega);
    expect(gravado).toBe(hoje);
  });

  // ⭐ Data-só ancorada ao MEIO-DIA: gravar meia-noite faria a entrega "pular" para o
  // dia anterior conforme o fuso — o mesmo cuidado que `dataDespesa` já tomava.
  it('data-só → meio-dia -03:00, e o DIA em São Paulo é o digitado', async () => {
    await svc.create(dto({ dataEntrega: '2026-08-15' }), userF1);
    const d: Date = criada().dataEntrega;
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)).toBe('2026-08-15');
    expect(d.toISOString()).toBe('2026-08-15T15:00:00.000Z'); // 12:00 -03:00
  });

  it('a fila de montagem ordena por DIA e, no mesmo dia, por chegada', async () => {
    prisma.entrega.findMany.mockResolvedValue([]);
    await svc.list({ filialId: 'f1' });
    expect(prisma.entrega.findMany.mock.calls[0][0].orderBy).toEqual([
      { dataEntrega: { sort: 'asc', nulls: 'last' } },
      { criadoEm: 'asc' },
    ]);
  });
});

/**
 * ⭐ Ponto 1 (09/08) — sem KM de SAÍDA não se dá baixa, e a regra vive no SERVIDOR.
 *
 * O app já travava o botão ("🔒 Registre o KM de saída"), mas client-side não é regra:
 * qualquer outro caminho — desktop, versão antiga do app, chamada direta — passava ao
 * largo e a rota rodava inteira sem hodômetro, sumindo do KM rodado e do custo por km.
 */
describe('EntregaService.baixar — exige o KM de saída da rota (ponto 1)', () => {
  let prisma: any;
  let svc: EntregaService;

  const entrega = (kmInicial: number | null) => ({
    id: 'e1', filialId: 'f1', status: 'EM_VIAGEM', cupons: [],
    parada: { viagemId: 'v1', viagem: { kmInicial, numero: 7 } },
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new EntregaService(prisma, coreMock(), cofreMock(), geocodeMock(), condutorMock(), localAprendidoMock());
  });

  it('rota SEM KM de saída → recusa, dizendo o número da rota', async () => {
    prisma.entrega.findUnique.mockResolvedValue(entrega(null));
    await expect(
      svc.baixar('e1', { resultado: 'ENTREGUE', recebedorNome: 'Fulano' } as any, {}, userF1),
    ).rejects.toThrow(/KM de saída da rota #7/);
    expect(prisma.entrega.update).not.toHaveBeenCalled();
  });

  it('rota COM KM de saída → deixa baixar', async () => {
    prisma.entrega.findUnique.mockResolvedValue(entrega(1200));
    prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', cupons: [] });
    await expect(
      svc.baixar('e1', { resultado: 'ENTREGUE', recebedorNome: 'Fulano' } as any, {}, userF1),
    ).resolves.toBeDefined();
  });

  // A recusa é ato do entregador e também precisa do KM — senão bastaria recusar tudo
  // para fugir da regra.
  it('a RECUSA também exige o KM de saída', async () => {
    prisma.entrega.findUnique.mockResolvedValue(entrega(null));
    await expect(
      svc.baixar('e1', { resultado: 'NAO_ENTREGUE', motivo: 'ausente' } as any, {}, userF1),
    ).rejects.toThrow(/KM de saída/);
  });
});
