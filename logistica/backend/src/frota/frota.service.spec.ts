import { NotFoundException } from '@nestjs/common';
import { FrotaService } from './frota.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const dep = () => ({}) as any;
const locaisMock = () => ({ consolidar: jest.fn().mockResolvedValue({}), criar: jest.fn().mockResolvedValue({ id: 'lc1' }), listarPorCliente: jest.fn() }) as any;
const comRole = (role: string, sub = 'u1') => ({ sub, filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;

describe('FrotaService — escopo de visibilidade das viagens de frota', () => {
  let prisma: any;
  let svc: FrotaService;
  beforeEach(() => {
    prisma = createPrismaMock();
    // `listar` resolve o nome do condutor da ENTREGA pelo motoristaId (core), então
    // o core aqui precisa ser um mock de verdade — não o `dep()` vazio.
    const core = { nomesUsuarios: jest.fn().mockResolvedValue(new Map()) } as any;
    svc = new FrotaService(prisma, dep(), core, dep(), locaisMock());
  });

  // ⭐ Vazamento pego 05/07: a lista mostrava TODAS as viagens da filial p/ qualquer papel.
  it('listar (operador): filtra pelas SUAS — criadoPorId OU supervisor do veículo', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('OPERADOR_ENTREGA'));
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ criadoPorId: 'u1' }, { veiculo: { supervisorId: 'u1' } }]);
  });

  // Filtro de tipo (12/08): a rota de ENTREGA roda no mesmo veículo e move o mesmo
  // odômetro — a Linha do KM e o custo/km já a somavam, só a LISTA a ignorava.
  it('listar: sem ?tipo → só FROTA (comportamento histórico da tela)', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('GESTOR_FROTA'));
    expect(prisma.viagem.findMany.mock.calls[0][0].where.tipo).toBe('FROTA');
  });

  it('listar tipo=ENTREGA: traz as rotas de entrega', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('GESTOR_FROTA'), undefined, 'ENTREGA');
    expect(prisma.viagem.findMany.mock.calls[0][0].where.tipo).toBe('ENTREGA');
  });

  // ⭐ TODAS não pode virar "sem filtro": SUPERVISOR (RDV) é container MENSAL da
  // prestação de contas, não uma saída de veículo — não pode entrar na lista.
  it('listar tipo=TODAS: FROTA + ENTREGA, nunca SUPERVISOR', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('GESTOR_FROTA'), undefined, 'TODAS');
    expect(prisma.viagem.findMany.mock.calls[0][0].where.tipo).toEqual({ in: ['FROTA', 'ENTREGA'] });
  });

  // O escopo do não-gestor continua valendo com o filtro de tipo ligado — o recorte
  // de tipo não pode virar porta de entrada para viagem de outro departamento.
  it('listar tipo=TODAS (operador): mantém o recorte pelas SUAS', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('OPERADOR_ENTREGA'), undefined, 'TODAS');
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.tipo).toEqual({ in: ['FROTA', 'ENTREGA'] });
    expect(where.OR).toEqual([{ criadoPorId: 'u1' }, { veiculo: { supervisorId: 'u1' } }]);
  });

  // Na ENTREGA o condutor é o motoristaId (usuário), não o par condutorMatricula/Nome.
  it('listar: condutor da ENTREGA vem do motoristaId (coluna não sai vazia)', async () => {
    prisma.viagem.findMany.mockResolvedValue([
      { id: 'v1', numero: 1, situacao: 'CONCLUIDA', tipo: 'ENTREGA', motoristaId: 'm1', condutorNome: null, criadoPorId: 'u1', veiculo: { placa: 'SUP01' }, _count: { paradas: 3 } },
    ]);
    const core = { nomesUsuarios: jest.fn().mockResolvedValue(new Map([['m1', 'Wanderson']])) } as any;
    const s2 = new FrotaService(prisma, dep(), core, dep(), locaisMock());
    const [linha] = await s2.listar(comRole('GESTOR_FROTA'), undefined, 'ENTREGA');
    expect(linha).toMatchObject({ tipo: 'ENTREGA', condutorNome: 'Wanderson', paradas: 3 });
  });

  // ⭐ 25/08 — o APP é execução individual; gestão (alterar/cancelar viagem de
  // outro) é ato de DESKTOP. Relato do Clenio na HLG: entrou como ADMIN no app e
  // viu a saída registrada por outra pessoa. A Frota era a última lista do app
  // consumindo a visão do desktop crua (o RDV já mandava `escopo=meus` e a
  // Entrega tem endpoint próprio).
  it('listar escopo=meus (ADMIN): passa a filtrar pelas SUAS', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('ADMIN'), undefined, 'FROTA', 'meus');
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ criadoPorId: 'u1' }, { veiculo: { supervisorId: 'u1' } }]);
    expect(where.filialId).toBe('f1'); // volta a respeitar a filial, como qualquer não-gestor
  });

  it('listar escopo=meus (Gestor de Frota): idem — o papel não abre a lista', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('GESTOR_FROTA'), undefined, 'FROTA', 'meus');
    expect(prisma.viagem.findMany.mock.calls[0][0].where.OR)
      .toEqual([{ criadoPorId: 'u1' }, { veiculo: { supervisorId: 'u1' } }]);
  });

  // O desktop NÃO pode mudar de comportamento: quem não manda escopo continua
  // vendo a frota inteira. É a mesma rota servindo as duas telas.
  it('listar sem escopo (ADMIN): segue vendo todas — o desktop é a tela de gestão', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('ADMIN'));
    expect(prisma.viagem.findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it('listar (Gestor de Frota): SEM filtro — vê todas da filial', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('GESTOR_FROTA'));
    expect(prisma.viagem.findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it('listar (ADMIN): SEM filtro', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('ADMIN'));
    expect(prisma.viagem.findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it('obterViagem (operador) de viagem que NÃO é dele → 404 (não vaza)', async () => {
    prisma.viagem.findFirst.mockResolvedValue({ id: 'v1', criadoPorId: 'OUTRO', veiculo: { supervisorId: 'OUTRO' }, _count: { paradas: 0 } });
    await expect(svc.obterViagem('v1', comRole('OPERADOR_ENTREGA'))).rejects.toThrow(NotFoundException);
  });

  it('obterViagem (operador) da SUA viagem (registrante) → ok', async () => {
    prisma.viagem.findFirst.mockResolvedValue({ id: 'v1', criadoPorId: 'u1', veiculo: { supervisorId: 'OUTRO', placa: 'ABC', modelo: 'X' }, _count: { paradas: 0 } });
    await expect(svc.obterViagem('v1', comRole('OPERADOR_ENTREGA'))).resolves.toMatchObject({ id: 'v1' });
  });

  it('despesasDaViagem (operador) de viagem alheia → 404', async () => {
    prisma.viagem.findFirst.mockResolvedValue({ id: 'v1', criadoPorId: 'OUTRO', veiculo: { supervisorId: 'OUTRO' } });
    await expect(svc.despesasDaViagem('v1', comRole('OPERADOR_ENTREGA'))).rejects.toThrow(NotFoundException);
  });

  // ⭐ Supervisor de Departamento (SUPERVISOR_FROTA): escopo POR DEPARTAMENTO
  // (departamentos onde é encarregado de ≥1 veículo), não por veículo individual.
  it('listar (Supervisor de Departamento): filtra por criadoPorId OU veículo do(s) seu(s) departamento(s)', async () => {
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]); // deptosSupervisionados
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('SUPERVISOR_FROTA'));
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ criadoPorId: 'u1' }, { veiculo: { departamentoLotacaoId: { in: ['d1'] } } }]);
  });

  it('obterViagem (Supervisor de Departamento) de veículo do SEU depto → ok', async () => {
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]);
    prisma.viagem.findFirst.mockResolvedValue({ id: 'v1', criadoPorId: 'OUTRO', veiculo: { supervisorId: 'OUTRO', departamentoLotacaoId: 'd1', placa: 'ABC', modelo: 'X' }, _count: { paradas: 0 } });
    await expect(svc.obterViagem('v1', comRole('SUPERVISOR_FROTA'))).resolves.toMatchObject({ id: 'v1' });
  });

  it('obterViagem (Supervisor de Departamento) de veículo de OUTRO depto → 404', async () => {
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]);
    prisma.viagem.findFirst.mockResolvedValue({ id: 'v1', criadoPorId: 'OUTRO', veiculo: { supervisorId: 'OUTRO', departamentoLotacaoId: 'd2' }, _count: { paradas: 0 } });
    await expect(svc.obterViagem('v1', comRole('SUPERVISOR_FROTA'))).rejects.toThrow(NotFoundException);
  });
});

// O custo da manutenção era gravado em manutencao_veiculo.custo e NUNCA somado —
// Análise e indicadores leem só despesa_veiculo. Estes testes travam a correção:
// custo → despesa (uma, aprovada, vinculada); sem custo → nenhuma despesa.
describe('FrotaService — manutenção com custo gera despesa', () => {
  let prisma: any;
  let svc: FrotaService;
  const gestor = comRole('GESTOR_FROTA');

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new FrotaService(prisma, dep(), dep(), dep(), locaisMock());
    prisma.veiculo.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', kmAtual: 1000, intervaloManutencaoKm: 10000, supervisorId: 'u1' });
    prisma.veiculo.update.mockResolvedValue({ id: 'v1' });
    prisma.tipoDespesa.findFirst.mockResolvedValue({ id: 'tp-manut', nome: 'Manutenção', ativo: true });
    prisma.despesaVeiculo.create.mockResolvedValue({ id: 'desp-1' });
    prisma.manutencaoVeiculo.create.mockResolvedValue({ id: 'm1' });
  });

  it('com custo → cria 1 despesa APROVADA no veículo e vincula à manutenção', async () => {
    await svc.registrarManutencao('v1', { custo: 450.5, km: 1200, observacao: 'Troca de óleo' } as any, gestor, ['GESTOR_FROTA']);

    expect(prisma.despesaVeiculo.create).toHaveBeenCalledTimes(1);
    const despesa = prisma.despesaVeiculo.create.mock.calls[0][0].data;
    expect(despesa).toMatchObject({
      filialId: 'f1',
      veiculoId: 'v1',
      tipoDespesaId: 'tp-manut',
      situacao: 'APROVADA',
      semNota: true,
    });
    expect(Number(despesa.valor)).toBe(450.5);
    expect(despesa.observacao).toContain('KM 1200');

    // O vínculo é o que impede custo órfão e contagem dupla.
    expect(prisma.manutencaoVeiculo.create.mock.calls[0][0].data.despesaId).toBe('desp-1');
  });

  it('sem custo → NÃO cria despesa (manutenção segue sendo só histórico de KM)', async () => {
    await svc.registrarManutencao('v1', { km: 1200 } as any, gestor, ['GESTOR_FROTA']);
    expect(prisma.despesaVeiculo.create).not.toHaveBeenCalled();
    expect(prisma.manutencaoVeiculo.create.mock.calls[0][0].data.despesaId).toBeNull();
  });

  it('custo zero → NÃO cria despesa (lançamento de R$ 0 só polui a Análise)', async () => {
    await svc.registrarManutencao('v1', { custo: 0, km: 1200 } as any, gestor, ['GESTOR_FROTA']);
    expect(prisma.despesaVeiculo.create).not.toHaveBeenCalled();
  });

  it('tipo "Manutenção" desativado → reativa em vez de estourar no meio do registro', async () => {
    prisma.tipoDespesa.findFirst.mockResolvedValue({ id: 'tp-manut', nome: 'Manutenção', ativo: false });
    prisma.tipoDespesa.update.mockResolvedValue({ id: 'tp-manut', ativo: true });
    await svc.registrarManutencao('v1', { custo: 100 } as any, gestor, ['GESTOR_FROTA']);
    expect(prisma.tipoDespesa.update).toHaveBeenCalledWith({ where: { id: 'tp-manut' }, data: { ativo: true } });
    expect(prisma.despesaVeiculo.create).toHaveBeenCalledTimes(1);
  });
});

/**
 * ⭐ 5b (09/08) — de quem é a despesa da viagem.
 *
 * O departamento aprovador é resolvido na SAÍDA e congelado. A cascata existe porque
 * nem todo condutor é usuário da plataforma, e porque o login PADRÃO é do POSTO
 * (`portaria01` está em T.I.), não da pessoa.
 */
describe('FrotaService.previaAprovacao — cascata do departamento aprovador', () => {
  let prisma: any;
  let svc: FrotaService;
  let core: any;
  const user = (departamentoId?: string) =>
    ({ sub: 'u1', filialId: 'f1', departamentoId, modulos: [{ codigo: 'LOGISTICA', role: 'PORTARIA' }] }) as any;

  beforeEach(() => {
    prisma = createPrismaMock();
    core = {
      colaboradorDoUsuario: jest.fn().mockResolvedValue(null),
      deptoDoColaboradorPorMatricula: jest.fn().mockResolvedValue(null),
      aprovadoresDoDepartamento: jest.fn().mockResolvedValue([{ id: 's1', nome: 'Supervisor' }]),
      nomesDepartamentos: jest.fn().mockResolvedValue(new Map([['dPessoa', 'Agroveterinaria'], ['dLogin', 'Portaria']])),
    };
    svc = new FrotaService(prisma, dep(), core, dep(), locaisMock());
  });

  it('1º: a matrícula do condutor manda — mesmo com o login noutro depto', async () => {
    core.deptoDoColaboradorPorMatricula.mockResolvedValue('dPessoa');
    const r = await svc.previaAprovacao(user('dLogin'), 'E01047');
    expect(r.departamentoId).toBe('dPessoa');
    expect(r.origem).toBe('COLABORADOR');
  });

  // O elo fraco, e por isso a tela mostra: a despesa de um colaborador da
  // Agroveterinária que sai pela portaria cairia no supervisor da PORTARIA.
  it('2º: colaborador sem usuário → cai no depto do LOGIN, marcado como tal', async () => {
    const r = await svc.previaAprovacao(user('dLogin'), 'E09999');
    expect(r.departamentoId).toBe('dLogin');
    expect(r.origem).toBe('LOGIN');
  });

  it('escolha do operador vence a cascata inteira', async () => {
    core.deptoDoColaboradorPorMatricula.mockResolvedValue('dPessoa');
    const r = await svc.previaAprovacao(user('dLogin'), 'E01047', 'dEscolhido');
    expect(r.departamentoId).toBe('dEscolhido');
    expect(r.origem).toBe('ESCOLHIDO');
  });

  // ⭐ 1º dos "três silêncios": sem ninguém com o papel, a despesa nasceria PENDENTE
  // para sempre — sem erro e sem aviso. A saída avisa no ato.
  it('departamento SEM aprovador → devolve lista vazia para a tela avisar', async () => {
    core.deptoDoColaboradorPorMatricula.mockResolvedValue('dPessoa');
    core.aprovadoresDoDepartamento.mockResolvedValue([]);
    const r = await svc.previaAprovacao(user('dLogin'), 'E01047');
    expect(r.aprovadores).toEqual([]);
  });

  // ⭐ Login INDIVIDUAL não digita matrícula: a prévia tem de usar a do CADASTRO, senão
  // avisa "veio do login" enquanto a saída grava o departamento do colaborador.
  it('INDIVIDUAL sem matrícula digitada → usa a do cadastro, não o depto do login', async () => {
    core.colaboradorDoUsuario.mockResolvedValue({ matricula: 'E01047', nome: 'Fulano' });
    core.deptoDoColaboradorPorMatricula.mockImplementation(async (m: string | null) => (m === 'E01047' ? 'dPessoa' : null));
    const r = await svc.previaAprovacao(user('dLogin'));
    expect(r.departamentoId).toBe('dPessoa');
    expect(r.origem).toBe('COLABORADOR');
  });

  it('sem matrícula e sem depto no login → nada a resolver (não inventa)', async () => {
    const r = await svc.previaAprovacao(user(undefined), '');
    expect(r.departamentoId).toBeNull();
    expect(r.origem).toBe('NENHUMA');
    expect(r.aprovadores).toEqual([]);
  });
});

/**
 * ⭐ Ponto 3 (09/08) — "Registro de Viagem": viagem SEM veículo da empresa.
 *
 * Há viagens feitas em outro meio de transporte, em que o registro é só prestação de
 * contas (adiantamento + despesas). Sem veículo não há hodômetro nem situação a mudar,
 * e as despesas entram como INDIVÍDUO — fora do rateio por veículo (precedente do RDV).
 */
describe('FrotaService.registrarSaidaIndividual — veículo opcional (ponto 3)', () => {
  let prisma: any;
  let svc: FrotaService;
  let core: any;
  const user = { sub: 'u1', filialId: 'f1', tipo: 'INDIVIDUAL', departamentoId: 'd1', modulos: [{ codigo: 'LOGISTICA', role: 'OPERADOR_ENTREGA' }] } as any;

  beforeEach(() => {
    prisma = createPrismaMock();
    core = {
      colaboradorDoUsuario: jest.fn().mockResolvedValue({ matricula: 'E01047', nome: 'Fulano' }),
      deptoDoColaboradorPorMatricula: jest.fn().mockResolvedValue('dPessoa'),
    };
    svc = new FrotaService(prisma, dep(), core, dep(), locaisMock());
    prisma.viagem.findMany.mockResolvedValue([]);
    prisma.contadorSequencial.upsert.mockResolvedValue({ ultimoNumero: 7 });
    prisma.viagem.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'vg1', ...data }));
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
  });

  it('SEM veículo → cria a viagem, não toca em nenhum veículo e não grava KM', async () => {
    const r: any = await svc.registrarSaidaIndividual({ adiantamento: 250 } as any, user);
    expect(r.veiculoId).toBeNull();
    expect(r.kmInicial).toBeNull();
    expect(prisma.veiculo.update).not.toHaveBeenCalled();
    expect(r.placa).toBeNull();
  });

  it('SEM veículo → o departamento aprovador continua sendo resolvido (é o acerto)', async () => {
    const r: any = await svc.registrarSaidaIndividual({} as any, user);
    expect(r.departamentoAprovadorId).toBe('dPessoa');
  });

  // A frouxidão do DTO existe só para o caso sem veículo — com veículo o hodômetro
  // alimenta custo por km e manutenção preventiva, e segue obrigatório.
  it('COM veículo e SEM KM → recusa', async () => {
    prisma.veiculo.findFirst.mockResolvedValue({ id: 'v1', situacao: 'DISPONIVEL', kmAtual: 100, placa: 'ABC', modelo: 'X' });
    await expect(svc.registrarSaidaIndividual({ veiculoId: 'v1' } as any, user))
      .rejects.toThrow(/KM de saída/i);
  });

  it('COM veículo e KM → caminho normal: veículo vai para EM_USO', async () => {
    prisma.veiculo.findFirst.mockResolvedValue({ id: 'v1', situacao: 'DISPONIVEL', kmAtual: 100, placa: 'ABC', modelo: 'X' });
    const r: any = await svc.registrarSaidaIndividual({ veiculoId: 'v1', kmInicial: 120 } as any, user);
    expect(r.kmInicial).toBe(120);
    expect(prisma.veiculo.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { situacao: 'EM_USO' } });
  });

  it('veículo informado que não existe → 404 (não vira viagem sem veículo por engano)', async () => {
    prisma.veiculo.findFirst.mockResolvedValue(null);
    await expect(svc.registrarSaidaIndividual({ veiculoId: 'sumiu', kmInicial: 1 } as any, user))
      .rejects.toThrow(NotFoundException);
  });
});

/**
 * ⭐ KM rodado do mês — as DUAS pontas (achado em 09/08, no roteiro 8).
 *
 * Ao incluir a ENTREGA no cômputo, uma rota encerrada À FORÇA sem KM de saída
 * (kmFinal 60540, kmInicial null) somou 60.540 km: o `?? 0` transformava a leitura
 * inteira do odômetro em distância. O indicador do mês foi de 41 para 65.621.
 * A viagem de FROTA nunca expôs isso porque o KM de saída é obrigatório na saída.
 */
describe('FrotaService.painelFrota — KM rodado exige as duas pontas', () => {
  it('a consulta do KM do mês filtra kmInicial E kmFinal não-nulos', async () => {
    const prisma = createPrismaMock();
    const core = { nomesDepartamentos: jest.fn().mockResolvedValue(new Map()), nomesUsuarios: jest.fn().mockResolvedValue(new Map()) } as any;
    const svc = new FrotaService(prisma as any, dep(), core, dep(), locaisMock());
    prisma.veiculo.findMany.mockResolvedValue([]);
    prisma.veiculo.count.mockResolvedValue(0);
    prisma.viagem.findMany.mockResolvedValue([]);
    prisma.despesaVeiculo.count.mockResolvedValue(0);
    prisma.despesaVeiculo.findMany.mockResolvedValue([]);
    await svc.painelFrota({ sub: 'u1', filialId: 'f1' } as any, ['GESTOR_FROTA'], 8, 2026);

    const doKm = prisma.viagem.findMany.mock.calls
      .map((c: any) => c[0].where)
      .find((w: any) => w?.situacao === 'CONCLUIDA' && w?.dataHoraChegada);
    expect(doKm.kmInicial).toEqual({ not: null });
    expect(doKm.kmFinal).toEqual({ not: null });
    // E a ENTREGA continua no cômputo — a correção não pode desfazer o item 6.
    expect(doKm.tipo).toEqual({ in: ['FROTA', 'ENTREGA'] });
  });
});

/**
 * ⭐ 5a — no login PADRÃO, ser `criadoPorId` não basta (achado no roteiro 4, item 4.3).
 *
 * A conta de caixa é compartilhada. Como a saída foi registrada por ela, o "dono" dava
 * verdadeiro e o ADIANTAMENTO podia ser alterado sem identificação — enquanto a DESPESA
 * era recusada (ela usa `assertOpera`). Autoridade vinha da CONTA, não da PESSOA.
 */
describe('FrotaService.ajustarPorGestor — PADRÃO precisa se identificar', () => {
  let prisma: any;
  let svc: FrotaService;
  let token: any;
  const viagem = { id: 'v1', filialId: 'f1', tipo: 'FROTA', situacao: 'EM_CURSO', criadoPorId: 'caixa1', veiculo: { supervisorId: 'x', departamentoLotacaoId: 'd1' }, acertoEncerradoEm: null, kmInicial: 10 };
  const caixa = { sub: 'caixa1', filialId: 'f1', tipo: 'PADRAO', modulos: [{ codigo: 'LOGISTICA', role: 'REGISTRADOR_FROTA' }] } as any;
  const pessoal = { sub: 'caixa1', filialId: 'f1', tipo: 'INDIVIDUAL', modulos: [{ codigo: 'LOGISTICA', role: 'OPERADOR_ENTREGA' }] } as any;

  beforeEach(() => {
    prisma = createPrismaMock();
    token = { verificar: jest.fn() };
    svc = new FrotaService(prisma, dep(), dep(), token, locaisMock());
    prisma.viagem.findUnique.mockResolvedValue(viagem);
    prisma.viagem.update.mockResolvedValue({ id: 'v1' });
  });

  it('PADRÃO SEM identificação → recusa, mesmo tendo registrado a saída', async () => {
    await expect(svc.ajustarPorGestor('v1', { adiantamento: 50 } as any, caixa, ['REGISTRADOR_FROTA']))
      .rejects.toThrow(/Identifique o condutor/i);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('PADRÃO COM o token do condutor → ajusta', async () => {
    await expect(svc.ajustarPorGestor('v1', { adiantamento: 50 } as any, caixa, ['REGISTRADOR_FROTA'], 'tk'))
      .resolves.toBeDefined();
    expect(token.verificar).toHaveBeenCalledWith('tk', 'v1');
  });

  // INDIVIDUAL é a pessoa: quem registrou a saída segue ajustando a própria viagem.
  it('INDIVIDUAL que registrou a saída continua ajustando sem token', async () => {
    await expect(svc.ajustarPorGestor('v1', { adiantamento: 50 } as any, pessoal, ['OPERADOR_ENTREGA']))
      .resolves.toBeDefined();
  });
});
