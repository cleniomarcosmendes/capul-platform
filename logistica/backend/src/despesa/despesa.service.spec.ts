import { DespesaService } from './despesa.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const dep = () => ({}) as any;

// ⭐ Vazamento pego no teste E2E por API (12/07): GET /despesas?veiculoId=<fora do
// escopo> sobrepunha o filtro de escopo e retornava despesa de outro departamento.
//
// 09/08: o ESCOPO mudou de fonte. Antes vinha dos VEÍCULOS que a pessoa supervisiona;
// agora vem da PERMISSÃO (papel + departamento) — a MESMA que decide se ela pode
// aprovar. As duas discordavam, e o supervisor podia aprovar o que não conseguia ver.
// A proteção contra o vazamento continua: `?veiculoId` INTERSECTA o escopo (é outra
// chave do mesmo `where`, então o Prisma faz AND), nunca o substitui.
describe('DespesaService — escopo da listagem (SUPERVISOR_FROTA)', () => {
  let prisma: any;
  let svc: DespesaService;
  /** Supervisor com SUPERVISOR_FROTA no departamento `d1` (via permissão no JWT). */
  const supDe = (...deptos: string[]) =>
    ({
      sub: 'u1', filialId: 'f1',
      modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR_FROTA',
        departamentos: deptos.map((id) => ({ id, nome: id, role: 'SUPERVISOR_FROTA' })) }],
    }) as any;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new DespesaService(prisma, dep(), dep(), dep());
    prisma.despesaVeiculo.findMany.mockResolvedValue([]);
  });

  const whereDaChamada = () => prisma.despesaVeiculo.findMany.mock.calls[0][0].where;

  it('escopo sai da PERMISSÃO — o RETRATO da viagem manda, com o legado por baixo', async () => {
    await svc.listar(supDe('d1'), ['SUPERVISOR_FROTA'], {} as any);
    expect(whereDaChamada().OR).toEqual([
      { viagem: { departamentoAprovadorId: { in: ['d1'] } } },
      { viagem: { departamentoAprovadorId: null, veiculo: { departamentoLotacaoId: { in: ['d1'] } } } },
      { viagemId: null, veiculo: { departamentoLotacaoId: { in: ['d1'] } } },
    ]);
    // Não consulta mais os veículos supervisionados — aquela fonte saiu de cena.
    expect(prisma.veiculo.findMany).not.toHaveBeenCalled();
  });

  it('multi-role: responde por 2 departamentos → os dois entram no escopo', async () => {
    await svc.listar(supDe('d1', 'd2'), ['SUPERVISOR_FROTA'], {} as any);
    expect(whereDaChamada().OR[0]).toEqual({ viagem: { departamentoAprovadorId: { in: ['d1', 'd2'] } } });
  });

  // ⭐ A proteção do /security-review, na regra nova: o filtro por veículo entra JUNTO
  // do escopo (AND), não no lugar dele.
  it('?veiculoId INTERSECTA o escopo — não o substitui', async () => {
    await svc.listar(supDe('d1'), ['SUPERVISOR_FROTA'], { veiculoId: 'v-out' } as any);
    const where = whereDaChamada();
    expect(where.veiculoId).toBe('v-out');
    expect(where.OR).toBeDefined();       // o escopo continua no where
    expect(where.filialId).toBe('f1');    // e a filial também
  });

  it('sem departamento na permissão → não vê nada (não cai em "tudo")', async () => {
    const semDepto = { sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR_FROTA', departamentos: [] }] } as any;
    prisma.$queryRaw.mockResolvedValue([{ departamento_id: null }]); // nem lotação tem
    const r = await svc.listar(semDepto, ['SUPERVISOR_FROTA'], {} as any);
    expect(r).toEqual([]);
    expect(prisma.despesaVeiculo.findMany).not.toHaveBeenCalled();
  });
});

/**
 * ⭐ 5b (09/08) — quem aprova a despesa de frota.
 *
 * Antes a autoridade era derivada do CADASTRO DO VEÍCULO: pegar um carro de outro
 * departamento mandava a aprovação para um gerente sem nenhuma relação com quem
 * gastou. Agora ela vem da PERMISSÃO (papel por departamento) e o departamento é o
 * RETRATO gravado na viagem no ato da saída.
 */
describe('DespesaService.aprovar — autoridade por DEPARTAMENTO (5b)', () => {
  let prisma: any;
  let svc: DespesaService;

  /** Usuário com SUPERVISOR_FROTA nos departamentos informados (multi-role no JWT). */
  const supDe = (...deptos: string[]) =>
    ({
      sub: 'u1',
      filialId: 'f1',
      modulos: [{
        codigo: 'LOGISTICA',
        role: 'SUPERVISOR_FROTA',
        departamentos: deptos.map((id) => ({ id, nome: id, role: 'SUPERVISOR_FROTA' })),
      }],
    }) as any;

  const despesaPendente = (viagemId: string | null) => ({
    id: 'dsp1', filialId: 'f1', situacao: 'PENDENTE', criadoPorId: 'quem-gastou',
    veiculoId: 'v1', viagemId,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new DespesaService(prisma, dep(), dep(), dep());
    prisma.despesaVeiculo.update.mockResolvedValue({ id: 'dsp1' });
  });

  it('supervisor do departamento GRAVADO na viagem → aprova', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg1'));
    prisma.viagem.findUnique.mockResolvedValue({ departamentoAprovadorId: 'dA' });
    await expect(svc.aprovar('dsp1', supDe('dA'), ['SUPERVISOR_FROTA'])).resolves.toBeDefined();
  });

  // ⭐ O caso relatado: o carro é de outro depto, mas quem gastou não é de lá.
  it('supervisor de OUTRO departamento → recusa, mesmo sendo o do veículo', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg1'));
    prisma.viagem.findUnique.mockResolvedValue({ departamentoAprovadorId: 'dA' });
    await expect(svc.aprovar('dsp1', supDe('dB'), ['SUPERVISOR_FROTA'])).rejects.toThrow(/supervisor de departamento/i);
  });

  it('multi-role: responde por 2 deptos e a viagem é de um deles → aprova', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg1'));
    prisma.viagem.findUnique.mockResolvedValue({ departamentoAprovadorId: 'dB' });
    await expect(svc.aprovar('dsp1', supDe('dA', 'dB'), ['SUPERVISOR_FROTA'])).resolves.toBeDefined();
  });

  it('ADMIN aprova sem depender de departamento', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg1'));
    const admin = { sub: 'a1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'ADMIN' }] } as any;
    await expect(svc.aprovar('dsp1', admin, ['ADMIN'])).resolves.toBeDefined();
  });

  // Viagem antiga (anterior à mudança) não tem o retrato: cai na regra de antes,
  // seguindo o departamento de quem lançou. Sem isso, despesa velha ficaria órfã.
  it('viagem SEM retrato → volta ao departamento de quem lançou', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg-antiga'));
    prisma.viagem.findUnique.mockResolvedValue({ departamentoAprovadorId: null });
    prisma.$queryRaw.mockResolvedValue([{ departamento_id: 'dLegado' }]);
    await expect(svc.aprovar('dsp1', supDe('dLegado'), ['SUPERVISOR_FROTA'])).resolves.toBeDefined();
  });

  it('GESTOR_FROTA não aprova acerto (só contesta) — regra preservada', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg1'));
    prisma.viagem.findUnique.mockResolvedValue({ departamentoAprovadorId: 'dA' });
    const gestor = { sub: 'g1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'GESTOR_FROTA' }] } as any;
    await expect(svc.aprovar('dsp1', gestor, ['GESTOR_FROTA'])).rejects.toThrow(/gestor de frota/i);
  });
});

/**
 * ⭐ 5a (09/08) — acerto pelo desktop com login PADRÃO.
 *
 * A conta PADRÃO é compartilhada (caixa/portaria): a autoridade sobre o acerto não
 * pode vir da CONTA, tem de vir da PESSOA que digitou matrícula+senha. Antes só o
 * gestor/supervisor mexia em despesa lançada — quem usa login de caixa não conseguia
 * prestar contas pelo desktop, e o acerto virava privilégio de quem tem INDIVIDUAL.
 */
describe('DespesaService — acerto pelo condutor identificado (5a)', () => {
  let prisma: any;
  let svc: DespesaService;
  let token: any;
  const caixa = { sub: 'caixa1', filialId: 'f1', tipo: 'PADRAO', modulos: [{ codigo: 'LOGISTICA', role: 'REGISTRADOR_FROTA' }] } as any;
  // `situacao`/`aprovadoPorId` explícitos: no banco eles SEMPRE existem (a coluna tem
  // default PENDENTE) e a trava do valor decidido falha FECHADA — sem eles o fixture
  // era lido como "já analisada" e não representava o caso que este teste descreve.
  const despesa = {
    id: 'dsp1', filialId: 'f1', veiculoId: 'v1', viagemId: 'vg1', comprovanteObjectKey: null,
    situacao: 'PENDENTE', aprovadoPorId: null,
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    token = { verificar: jest.fn(), emitir: jest.fn(), assertOpera: jest.fn() };
    svc = new DespesaService(prisma, { remove: jest.fn() } as any, dep(), token);
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesa);
    prisma.despesaVeiculo.update.mockResolvedValue(despesa);
    prisma.despesaVeiculo.delete.mockResolvedValue(despesa);
    prisma.anexoDespesa.findMany.mockResolvedValue([]);
    prisma.viagem.findUnique.mockResolvedValue({ acertoEncerradoEm: null });
  });

  it('com token do condutor → edita a despesa da viagem dele', async () => {
    await expect(svc.atualizar('dsp1', {} as any, caixa, ['REGISTRADOR_FROTA'], 'tk')).resolves.toBeDefined();
    expect(token.verificar).toHaveBeenCalledWith('tk', 'vg1');
  });

  it('com token do condutor → exclui a despesa', async () => {
    await expect(svc.excluir('dsp1', caixa, ['REGISTRADOR_FROTA'], 'tk')).resolves.toEqual({ ok: true });
  });

  // O token é preso a {viagem, condutor}: não serve para mexer no acerto de outra.
  it('token de OUTRA viagem → recusado pelo verificador', async () => {
    token.verificar.mockImplementation(() => { throw new Error('403'); });
    await expect(svc.atualizar('dsp1', {} as any, caixa, ['REGISTRADOR_FROTA'], 'tk-outra')).rejects.toThrow();
  });

  // A conta de caixa por si só não basta — a autoridade é da PESSOA.
  it('SEM token → cai na regra de gestor/supervisor e recusa a conta de caixa', async () => {
    prisma.veiculo.findFirst.mockResolvedValue({ id: 'v1', filialId: 'f1', supervisorId: 'OUTRO', departamentoLotacaoId: 'd9' });
    await expect(svc.atualizar('dsp1', {} as any, caixa, ['REGISTRADOR_FROTA'])).rejects.toThrow(/gestor de frota|supervisor/i);
  });

  // Encerrar o acerto é o que fecha o financeiro — vale inclusive para o condutor.
  it('acerto ENCERRADO → nem o condutor identificado altera', async () => {
    prisma.viagem.findUnique.mockResolvedValue({ acertoEncerradoEm: new Date() });
    await expect(svc.atualizar('dsp1', {} as any, caixa, ['REGISTRADOR_FROTA'], 'tk')).rejects.toThrow(/Acerto encerrado/);
  });
});

/**
 * ⭐ A DECISÃO VALE PARA O VALOR DECIDIDO — lado da FROTA (achado do
 * /security-review de 15/08).
 *
 * O acesso do condutor ao acerto (`x-condutor-token`) foi aberto sem esta trava: o
 * ramo do token só checava `acertoEncerradoEm`, e **aprovar não fecha o acerto**
 * (quem fecha é a ação explícita de encerrar). Logo APROVADA com acerto aberto é o
 * estado NORMAL, e nessa janela o próprio beneficiário reescrevia o valor: R$ 50
 * aprovados viravam R$ 5.000 e seguiam APROVADA, com o carimbo do supervisor colado
 * no número novo. `acertoViagem` soma as APROVADA em `saldo = adiantamento -
 * totalDespesas` — isto é dinheiro a pagar ao condutor.
 *
 * O módulo RDV já tinha a regra (`SupervisorService.editarDespesa`); a frota não.
 */
describe('DespesaService — condutor não mexe no valor já decidido', () => {
  let prisma: any;
  let svc: DespesaService;
  const condutorToken = { verificar: jest.fn(), emitir: jest.fn() } as any;
  const gestor = () => ({ sub: 'g1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'GESTOR_FROTA' }] }) as any;
  const condutor = () => ({ sub: 'caixa', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'REGISTRADOR_FROTA' }] }) as any;

  const despesa = (over: Record<string, unknown> = {}) => ({
    id: 'd1', filialId: 'f1', veiculoId: 'v1', viagemId: 'vg1', criadoPorId: 'caixa',
    situacao: 'PENDENTE', aprovadoPorId: null, tipoDespesaId: 't1',
    numeroDocumento: null, semNota: false, comprovanteObjectKey: null,
    ...over,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new DespesaService(prisma, dep(), dep(), condutorToken);
    // Acerto ABERTO: é o estado em que a despesa já pode estar aprovada.
    prisma.viagem.findUnique.mockResolvedValue({ acertoEncerradoEm: null });
    prisma.despesaVeiculo.update.mockResolvedValue({});
    prisma.despesaVeiculo.delete.mockResolvedValue({});
    prisma.anexoDespesa.findMany.mockResolvedValue([]);
  });

  it('APROVADA: condutor NÃO altera o valor — o beneficiário não reescreve o que foi aprovado', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(
      despesa({ situacao: 'APROVADA', aprovadoPorId: 'sup1' }),
    );
    await expect(
      svc.atualizar('d1', { valor: 5000 } as any, condutor(), ['REGISTRADOR_FROTA'], 'tok'),
    ).rejects.toThrow(/já passou por análise/i);
    expect(prisma.despesaVeiculo.update).not.toHaveBeenCalled();
  });

  it('CONTESTADA: condutor NÃO apaga — senão a rejeição sumia e ele relançava limpa', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(
      despesa({ situacao: 'CONTESTADA', aprovadoPorId: 'sup1' }),
    );
    await expect(
      svc.excluir('d1', condutor(), ['REGISTRADOR_FROTA'], 'tok'),
    ).rejects.toThrow(/só o gestor/i);
    expect(prisma.despesaVeiculo.delete).not.toHaveBeenCalled();
  });

  it('voltou a PENDENTE mas JÁ FOI analisada: continua travada — o marcador é aprovadoPorId', async () => {
    // Olhar só a `situacao` deixaria lavar a decisão com uma edição intermediária.
    prisma.despesaVeiculo.findUnique.mockResolvedValue(
      despesa({ situacao: 'PENDENTE', aprovadoPorId: 'sup1' }),
    );
    await expect(
      svc.atualizar('d1', { valor: 5000 } as any, condutor(), ['REGISTRADOR_FROTA'], 'tok'),
    ).rejects.toThrow(/já passou por análise/i);
  });

  it('PENDENTE e nunca analisada: o condutor edita à vontade — é dele e ninguém decidiu', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesa());
    await svc.atualizar('d1', { valor: 80 } as any, condutor(), ['REGISTRADOR_FROTA'], 'tok');
    expect(prisma.despesaVeiculo.update).toHaveBeenCalled();
    // Sem carimbo de aprovação: nada foi decidido.
    expect(prisma.despesaVeiculo.update.mock.calls[0][0].data.aprovadoPorId).toBeUndefined();
  });

  it('APROVADA: condutor ainda ajusta o que NÃO é dinheiro (observação)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(
      despesa({ situacao: 'APROVADA', aprovadoPorId: 'sup1' }),
    );
    await svc.atualizar('d1', { observacao: 'nota fiscal reenviada' } as any, condutor(), ['REGISTRADOR_FROTA'], 'tok');
    expect(prisma.despesaVeiculo.update).toHaveBeenCalled();
  });

  it('AUTORIDADE corrige valor decidido: mantém a aprovação, mas REFAZ o carimbo', async () => {
    // O aval passa a ser de quem editou, sobre o valor novo — o acerto nunca exibe
    // aprovação de um número que não foi o aprovado.
    prisma.despesaVeiculo.findUnique.mockResolvedValue(
      despesa({ situacao: 'APROVADA', aprovadoPorId: 'sup1' }),
    );
    prisma.veiculo.findFirst.mockResolvedValue({ id: 'v1', filialId: 'f1' });
    await svc.atualizar('d1', { valor: 120 } as any, gestor(), ['GESTOR_FROTA']);
    const data = prisma.despesaVeiculo.update.mock.calls[0][0].data;
    expect(data.aprovadoPorId).toBe('g1');
    expect(data.aprovadoEm).toBeInstanceOf(Date);
  });
});
