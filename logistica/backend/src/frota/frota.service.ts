import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, StatusViagem, TipoViagem, SituacaoVeiculo, StatusDespesa, StatusParada } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusCondutorService } from '../protheus/protheus-condutor.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { assertPodeOperarViagem } from '../common/frota-perms.js';
import { SaidaFrotaDto, SaidaIndividualDto, RetornoFrotaDto, AjusteGestorDto, AddParadaDto, RegistrarManutencaoDto, SaidaPortariaDto, PlanejarParadasDto, CheckinParadaDto, CriarLocalParadaDto, AtualizarLocalParadaDto } from './dto.js';

// Mesma normalização do toChapaPortal pra comparar matrículas com segurança.
const chapa = (m: string) => 'E' + (m || '').replace(/\D/g, '').slice(-5).padStart(5, '0');

// Quantos km antes da próxima revisão o Monitor começa a avisar.
const LIMIAR_AVISO_MANUTENCAO_KM = 500;

/**
 * Controle de FROTA (Fase 2) — viagens internas (saída/retorno), o "caderno
 * digital" da portaria. O CONDUTOR se identifica por matrícula+senha (Protheus,
 * só funcionário ativo); gestor de frota / supervisor do veículo podem ajustar.
 */
@Injectable()
export class FrotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly condutor: ProtheusCondutorService,
    private readonly core: CoreLookupService,
  ) {}

  /** Passo 1 da saída: identifica o condutor pelo nome (antes da senha). */
  async buscarCondutor(matricula: string) {
    const r = await this.condutor.buscarNome(matricula);
    if (!r) throw new NotFoundException('Matrícula não encontrada no Protheus.');
    return r;
  }

  /**
   * Validação matrícula+senha que SEMPRE responde 200 com {valida, motivo}
   * (mesmo padrão do Chamado PADRAO). O frontend valida por aqui ANTES de
   * registrar — assim a senha errada nunca vira 401/erro que desloga p/ o Hub.
   */
  async validarCondutor(matricula: string, senha: string) {
    const r = await this.condutor.validar(matricula, senha);
    if (r.status === 'VALIDO') return { valida: true as const, matricula: r.matricula, nome: r.nome };
    if (r.status === 'INVALIDO') return { valida: false as const, motivo: 'CREDENCIAIS_INVALIDAS' as const };
    return { valida: false as const, motivo: 'INDISPONIVEL' as const };
  }

  // Revalidação no momento de registrar (defesa em profundidade). 400 (não 401):
  // senha do condutor é dado do formulário, não expiração do JWT do usuário.
  private async validarOuErro(matricula: string, senha: string) {
    const r = await this.condutor.validar(matricula, senha);
    if (r.status === 'INDISPONIVEL') {
      throw new ServiceUnavailableException('Portal do RH indisponível. Tente novamente em instantes.');
    }
    if (r.status !== 'VALIDO') throw new BadRequestException('Matrícula ou senha inválidas.');
    return r;
  }

  /** Registrar SAÍDA do veículo (condutor autentica). Veículo → EM_USO. */
  async registrarSaida(dto: SaidaFrotaDto, user: JwtPayload) {
    // PADRAO: identifica o condutor por matrícula+senha do portal RH.
    const cond = await this.validarOuErro(dto.matricula, dto.senha);
    return this.criarSaida(user, cond.matricula, cond.nome, dto);
  }

  /**
   * INDIVIDUAL: usuário já autenticado é o próprio condutor — NÃO pede senha. A
   * matrícula/nome vêm do cadastro do usuário (core). Se o usuário não tiver
   * matrícula, orienta a cadastrar (ou usar o fluxo com matrícula+senha).
   */
  async registrarSaidaIndividual(dto: SaidaIndividualDto, user: JwtPayload) {
    const col = await this.core.colaboradorDoUsuario(user.sub);
    if (!col) {
      throw new BadRequestException(
        'Seu usuário não tem matrícula cadastrada. Peça ao administrador para cadastrá-la ou registre a saída informando matrícula e senha.',
      );
    }
    return this.criarSaida(user, col.matricula, col.nome, dto);
  }

  /** Núcleo da saída de frota — compartilhado pelos fluxos PADRAO e INDIVIDUAL. */
  private async criarSaida(
    user: JwtPayload,
    condutorMatricula: string,
    condutorNome: string,
    dados: { veiculoId: string; kmInicial: number; finalidade?: string; localSaida?: string; departamentoSolicitanteId?: string; paradasPlanejadas?: string[] },
  ) {
    const filialId = user.filialId;
    if (!filialId) throw new BadRequestException('Usuário sem filial definida.');

    const veiculo = await this.prisma.veiculo.findFirst({
      where: { id: dados.veiculoId, filialId, ativo: true },
    });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado nesta filial.');
    if (veiculo.situacao !== SituacaoVeiculo.DISPONIVEL) {
      throw new BadRequestException(`Veículo indisponível (situação: ${veiculo.situacao}).`);
    }
    if (dados.kmInicial < veiculo.kmAtual) {
      throw new BadRequestException(`KM inicial (${dados.kmInicial}) menor que o KM atual do veículo (${veiculo.kmAtual}).`);
    }

    const viagem = await this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSequencial.upsert({
        where: { filialId_escopo: { filialId, escopo: 'VIAGEM' } },
        create: { filialId, escopo: 'VIAGEM', ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      const v = await tx.viagem.create({
        data: {
          numero: contador.ultimoNumero,
          filialId,
          tipo: TipoViagem.FROTA,
          situacao: StatusViagem.EM_CURSO,
          veiculoId: veiculo.id,
          condutorMatricula,
          condutorNome,
          departamentoSolicitanteId: dados.departamentoSolicitanteId ?? null,
          kmInicial: dados.kmInicial,
          localSaida: dados.localSaida ?? null,
          observacoesSaida: dados.finalidade ?? null,
          dataHoraSaida: new Date(),
          criadoPorId: user.sub,
        },
      });
      await tx.veiculo.update({ where: { id: veiculo.id }, data: { situacao: SituacaoVeiculo.EM_USO } });
      return v;
    });
    await this.seedParadasPlanejadas(viagem.id, dados.paradasPlanejadas);
    // Anexa a placa/modelo p/ a confirmação do app ("PLACA · viagem #N").
    return { ...viagem, placa: veiculo.placa, modelo: veiculo.modelo };
  }

  /** Cria as paradas PLANEJADAS da rota informada na saída (opcional). */
  private async seedParadasPlanejadas(viagemId: string, locais?: string[]) {
    const limpos = (locais ?? []).map((l) => l.trim()).filter(Boolean);
    if (limpos.length === 0) return;
    let seq = 1;
    await this.prisma.parada.createMany({
      data: limpos.map((local) => ({
        viagemId, sequencia: seq++, status: StatusParada.PLANEJADA, planejadoLocal: local, local,
      })),
    });
  }

  /**
   * Busca condutores por NOME no Protheus (infoPortal) — para a EXCEÇÃO da
   * portaria. Não exige senha; é só consulta. Lista ordenada por nome.
   */
  async buscarCondutoresPorNome(nome: string) {
    if (!nome || nome.trim().length < 3) {
      throw new BadRequestException('Informe ao menos 3 letras do nome.');
    }
    return this.condutor.buscarPorNome(nome);
  }

  /**
   * Registrar SAÍDA pela PORTARIA (exceção): usuário autorizado aponta a viagem
   * ao condutor (escolhido na busca por nome) SEM a senha dele. A accountability
   * é do usuário logado (criadoPorId) — fica registrado `registradaPortaria=true`.
   * Mesma validação de veículo/KM da saída normal.
   */
  async registrarSaidaPortaria(dto: SaidaPortariaDto, user: JwtPayload) {
    const filialId = user.filialId;
    if (!filialId) throw new BadRequestException('Usuário sem filial definida.');

    const veiculo = await this.prisma.veiculo.findFirst({
      where: { id: dto.veiculoId, filialId, ativo: true },
    });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado nesta filial.');
    if (veiculo.situacao !== SituacaoVeiculo.DISPONIVEL) {
      throw new BadRequestException(`Veículo indisponível (situação: ${veiculo.situacao}).`);
    }
    if (dto.kmInicial < veiculo.kmAtual) {
      throw new BadRequestException(`KM inicial (${dto.kmInicial}) menor que o KM atual do veículo (${veiculo.kmAtual}).`);
    }

    const novaViagem = await this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSequencial.upsert({
        where: { filialId_escopo: { filialId, escopo: 'VIAGEM' } },
        create: { filialId, escopo: 'VIAGEM', ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      const viagem = await tx.viagem.create({
        data: {
          numero: contador.ultimoNumero,
          filialId,
          tipo: TipoViagem.FROTA,
          situacao: StatusViagem.EM_CURSO,
          veiculoId: veiculo.id,
          condutorMatricula: dto.condutorMatricula.trim(),
          condutorNome: dto.condutorNome.trim(),
          registradaPortaria: true,
          departamentoSolicitanteId: dto.departamentoSolicitanteId ?? null,
          kmInicial: dto.kmInicial,
          localSaida: dto.localSaida ?? null,
          observacoesSaida: dto.finalidade ?? null,
          dataHoraSaida: new Date(),
          criadoPorId: user.sub,
        },
      });
      await tx.veiculo.update({ where: { id: veiculo.id }, data: { situacao: SituacaoVeiculo.EM_USO } });
      return viagem;
    });
    await this.seedParadasPlanejadas(novaViagem.id, dto.paradasPlanejadas);
    return novaViagem;
  }

  /** Registrar RETORNO (só o próprio condutor). Veículo → DISPONIVEL + km atualizado. */
  async registrarRetorno(id: string, dto: RetornoFrotaDto, user: JwtPayload) {
    const v = await this.prisma.viagem.findUnique({ where: { id } });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    if (v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('A viagem não está em curso.');

    const cond = await this.validarOuErro(dto.matricula, dto.senha);
    if (chapa(cond.matricula) !== chapa(v.condutorMatricula ?? '')) {
      throw new ForbiddenException('Só o condutor que iniciou pode fechar a viagem. Para corrigir, peça ao gestor de frota.');
    }
    if (dto.kmFinal < (v.kmInicial ?? 0)) {
      throw new BadRequestException(`KM final (${dto.kmFinal}) menor que o KM de saída (${v.kmInicial}).`);
    }
    return this.fechar(id, v.veiculoId, dto.kmFinal, dto.observacoes ?? null);
  }

  /** Ajuste/fechamento por GESTOR_FROTA ou supervisor do veículo. */
  async ajustarPorGestor(id: string, dto: AjusteGestorDto, user: JwtPayload, role?: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { veiculo: { select: { supervisorId: true } } } });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    if (v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');

    const ehGestor = role === 'GESTOR_FROTA' || role === 'ADMIN';
    const ehSupervisor = v.veiculo?.supervisorId === user.sub;
    if (!ehGestor && !ehSupervisor) {
      throw new ForbiddenException('Apenas gestor de frota ou o supervisor do veículo podem ajustar.');
    }

    const kmFinal = dto.kmFinal ?? v.kmFinal ?? undefined;
    if (dto.concluir) {
      if (kmFinal == null) throw new BadRequestException('Informe o KM final para concluir.');
      if (kmFinal < (dto.kmInicial ?? v.kmInicial ?? 0)) throw new BadRequestException('KM final menor que o KM de saída.');
      return this.fechar(id, v.veiculoId, kmFinal, dto.observacoesChegada ?? v.observacoesChegada ?? null, {
        kmInicial: dto.kmInicial, observacoesSaida: dto.observacoesSaida,
      });
    }
    // Só edita (sem fechar).
    return this.prisma.viagem.update({
      where: { id },
      data: {
        kmInicial: dto.kmInicial ?? undefined,
        kmFinal: dto.kmFinal ?? undefined,
        observacoesSaida: dto.observacoesSaida ?? undefined,
        observacoesChegada: dto.observacoesChegada ?? undefined,
      },
    });
  }

  /**
   * Registra manutenção feita: marca o odômetro da revisão (kmUltimaManutencao)
   * e agenda a próxima (km + intervalo). Reseta o alerta preventivo do veículo.
   * Gestor de frota ou supervisor do veículo (mesma governança do ajuste).
   */
  async registrarManutencao(veiculoId: string, dto: RegistrarManutencaoDto, user: JwtPayload, role?: string) {
    const veiculo = await this.prisma.veiculo.findUnique({ where: { id: veiculoId } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado.');
    if (veiculo.filialId !== user.filialId) throw new ForbiddenException('Veículo de outra filial.');
    const ehGestor = role === 'GESTOR_FROTA' || role === 'ADMIN';
    if (!ehGestor && veiculo.supervisorId !== user.sub) {
      throw new ForbiddenException('Apenas gestor de frota ou o supervisor do veículo podem registrar manutenção.');
    }

    const km = dto.km ?? veiculo.kmAtual;
    if (km < 0) throw new BadRequestException('KM inválido.');
    const intervalo = dto.intervaloKm ?? veiculo.intervaloManutencaoKm ?? null;
    const proxima = intervalo != null ? km + intervalo : null;

    return this.prisma.veiculo.update({
      where: { id: veiculoId },
      data: {
        kmUltimaManutencao: km,
        kmProximaManutencao: proxima,
        // Se o intervalo veio na chamada, persiste como o padrão do veículo.
        ...(dto.intervaloKm != null ? { intervaloManutencaoKm: dto.intervaloKm } : {}),
      },
    });
  }

  private async fechar(id: string, veiculoId: string | null, kmFinal: number, obsChegada: string | null, extra?: { kmInicial?: number; observacoesSaida?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const viagem = await tx.viagem.update({
        where: { id },
        data: {
          situacao: StatusViagem.CONCLUIDA,
          kmFinal,
          dataHoraChegada: new Date(),
          observacoesChegada: obsChegada,
          ...(extra?.kmInicial != null ? { kmInicial: extra.kmInicial } : {}),
          ...(extra?.observacoesSaida != null ? { observacoesSaida: extra.observacoesSaida } : {}),
        },
      });
      if (veiculoId) {
        await tx.veiculo.update({
          where: { id: veiculoId },
          data: { situacao: SituacaoVeiculo.DISPONIVEL, kmAtual: kmFinal },
        });
      }
      return viagem;
    });
  }

  // ---- Linha do KM (hodômetro) — segmentos por viagem + lacunas "não apontadas" ----
  /**
   * Monta a "linha do KM" do veículo: cada viagem (kmInicial→kmFinal) vira um
   * segmento rotulado (finalidade) e as lacunas de KM entre uma viagem e a
   * próxima (e até o KM atual) viram "não apontadas" — prestação de contas do
   * odômetro. Leitura, qualquer papel da logística (escopo de filial).
   */
  async hodometro(veiculoId: string, user: JwtPayload, mes?: number, ano?: number) {
    const filialId = user.filialId;
    if (!filialId) throw new BadRequestException('Usuário sem filial definida.');
    const veiculo = await this.prisma.veiculo.findFirst({ where: { id: veiculoId, filialId } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado nesta filial.');

    const where: Prisma.ViagemWhereInput = { veiculoId, filialId, kmInicial: { not: null }, kmFinal: { not: null } };
    if (mes && ano) where.dataHoraSaida = { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) };
    const viagens = await this.prisma.viagem.findMany({
      where,
      select: { numero: true, kmInicial: true, kmFinal: true, observacoesSaida: true, dataHoraSaida: true, condutorNome: true, tipo: true },
      orderBy: { kmInicial: 'asc' },
    });

    type Seg = { tipo: 'viagem' | 'gap'; kmInicio: number; kmFim: number; km: number; label: string; viagemNumero?: number; data?: string | null; condutor?: string | null };
    const segViagens: Seg[] = viagens
      .filter((v) => v.kmInicial != null && v.kmFinal != null && v.kmFinal > v.kmInicial)
      .map((v) => ({
        tipo: 'viagem' as const, kmInicio: v.kmInicial!, kmFim: v.kmFinal!, km: v.kmFinal! - v.kmInicial!,
        label: v.observacoesSaida?.trim() || `Viagem #${v.numero}`,
        viagemNumero: v.numero, data: v.dataHoraSaida?.toISOString() ?? null, condutor: v.condutorNome,
      }))
      .sort((a, b) => a.kmInicio - b.kmInicio);

    const segmentos: Seg[] = [];
    let cursor: number | null = null;
    for (const s of segViagens) {
      if (cursor != null && s.kmInicio > cursor) {
        segmentos.push({ tipo: 'gap', kmInicio: cursor, kmFim: s.kmInicio, km: s.kmInicio - cursor, label: 'Não apontadas' });
      }
      segmentos.push(s);
      cursor = Math.max(cursor ?? s.kmFim, s.kmFim);
    }
    // Lacuna final: do último kmFinal até o KM atual do veículo.
    if (cursor != null && veiculo.kmAtual > cursor) {
      segmentos.push({ tipo: 'gap', kmInicio: cursor, kmFim: veiculo.kmAtual, km: veiculo.kmAtual - cursor, label: 'Não apontadas (até o KM atual)' });
      cursor = veiculo.kmAtual;
    }

    const kmMin = segmentos.length ? segmentos[0].kmInicio : 0;
    const kmMax = segmentos.length ? cursor! : veiculo.kmAtual;
    const kmViagens = segmentos.filter((s) => s.tipo === 'viagem').reduce((a, s) => a + s.km, 0);
    const kmNaoApontadas = segmentos.filter((s) => s.tipo === 'gap').reduce((a, s) => a + s.km, 0);

    return { placa: veiculo.placa, modelo: veiculo.modelo, kmAtual: veiculo.kmAtual, kmMin, kmMax, kmViagens, kmNaoApontadas, segmentos };
  }

  // ---- Painel tempo real da frota (monitoramento com recorte interno) ----
  async painelFrota(user: JwtPayload, role: string | undefined, mes: number, ano: number) {
    const filialId = user.filialId;
    if (!filialId) throw new BadRequestException('Usuário sem filial definida.');
    const ehGestor = role === 'GESTOR_FROTA' || role === 'ADMIN';
    const ini = new Date(Date.UTC(ano, mes - 1, 1));
    const fimExcl = new Date(Date.UTC(ano, mes, 1));

    // Despesas pendentes: gestor vê a filial; supervisor só os veículos dele.
    const veicSupervisor = ehGestor
      ? null
      : (await this.prisma.veiculo.findMany({ where: { filialId, supervisorId: user.sub }, select: { id: true } })).map((v) => v.id);
    const despesaScope = veicSupervisor ? { veiculoId: { in: veicSupervisor } } : {};

    const [
      veicDisponiveis, veicEmUso, veicManutencao, veicBaixados,
      emCurso, manutencaoLista, preventivaLista, despesasPendentes,
      concluidasMes, despesasMes, viagensMes,
    ] = await Promise.all([
      this.prisma.veiculo.count({ where: { filialId, ativo: true, situacao: SituacaoVeiculo.DISPONIVEL } }),
      this.prisma.veiculo.count({ where: { filialId, ativo: true, situacao: SituacaoVeiculo.EM_USO } }),
      this.prisma.veiculo.count({ where: { filialId, ativo: true, situacao: SituacaoVeiculo.EM_MANUTENCAO } }),
      this.prisma.veiculo.count({ where: { filialId, ativo: true, situacao: SituacaoVeiculo.BAIXADO } }),
      // "Na rua agora": TODAS as viagens em curso (ENTREGA + FROTA) — alinha com o
      // mapa ao vivo (que mostra os dois tipos). O nome do condutor de ENTREGA
      // vem do motoristaId (core), resolvido logo abaixo.
      this.prisma.viagem.findMany({
        where: { filialId, situacao: StatusViagem.EM_CURSO },
        select: {
          id: true, numero: true, tipo: true, condutorNome: true, motoristaId: true,
          dataHoraSaida: true, observacoesSaida: true, kmInicial: true,
          veiculo: { select: { placa: true, modelo: true } },
          _count: { select: { paradas: true } },
        },
        orderBy: { dataHoraSaida: 'asc' },
      }),
      this.prisma.veiculo.findMany({
        where: { filialId, ativo: true, situacao: SituacaoVeiculo.EM_MANUTENCAO },
        select: { placa: true, modelo: true },
      }),
      // Manutenção preventiva: veículos com próxima revisão definida cujo odômetro
      // já chegou perto (LIMIAR) ou passou do alvo.
      this.prisma.veiculo.findMany({
        where: { filialId, ativo: true, kmProximaManutencao: { not: null } },
        select: { id: true, placa: true, modelo: true, kmAtual: true, kmProximaManutencao: true },
      }),
      this.prisma.despesaVeiculo.count({ where: { filialId, situacao: StatusDespesa.PENDENTE, ...despesaScope } }),
      // Concluídas no mês (km rodado) — janela pela chegada.
      this.prisma.viagem.findMany({
        where: { filialId, tipo: TipoViagem.FROTA, situacao: StatusViagem.CONCLUIDA, dataHoraChegada: { gte: ini, lt: fimExcl } },
        select: { kmInicial: true, kmFinal: true, veiculoId: true, veiculo: { select: { placa: true } } },
      }),
      this.prisma.despesaVeiculo.findMany({
        where: { filialId, situacao: StatusDespesa.APROVADA, dataDespesa: { gte: ini, lt: fimExcl } },
        select: { valor: true },
      }),
      // Viagens de frota do mês p/ ranking por departamento solicitante (pela saída).
      this.prisma.viagem.findMany({
        where: { filialId, tipo: TipoViagem.FROTA, dataHoraSaida: { gte: ini, lt: fimExcl } },
        select: { departamentoSolicitanteId: true },
      }),
    ]);

    // Nome do condutor das viagens de ENTREGA em curso (motoristaId → core).
    const nomesCondutor = await this.core.nomesUsuarios(
      emCurso.map((v) => v.motoristaId).filter((x): x is string => !!x),
    );

    const kmRodadoMes = concluidasMes.reduce((s, v) => s + ((v.kmFinal ?? 0) - (v.kmInicial ?? 0)), 0);
    const custoTotalMes = despesasMes.reduce((s, d) => s + Number(d.valor), 0);

    // Ranking de uso por veículo (km rodado no mês).
    const kmPorVeiculo = new Map<string, number>();
    for (const v of concluidasMes) {
      const placa = v.veiculo?.placa ?? '—';
      kmPorVeiculo.set(placa, (kmPorVeiculo.get(placa) ?? 0) + ((v.kmFinal ?? 0) - (v.kmInicial ?? 0)));
    }
    const rankingVeiculo = [...kmPorVeiculo.entries()]
      .map(([placa, km]) => ({ placa, km })).sort((a, b) => b.km - a.km).slice(0, 5);

    // Ranking por departamento solicitante (nº de viagens) — resolve nome via core.
    const porDepto = new Map<string, number>();
    for (const v of viagensMes) {
      if (!v.departamentoSolicitanteId) continue;
      porDepto.set(v.departamentoSolicitanteId, (porDepto.get(v.departamentoSolicitanteId) ?? 0) + 1);
    }
    const nomesDepto = await this.core.nomesDepartamentos([...porDepto.keys()]);
    const rankingDepartamento = [...porDepto.entries()]
      .map(([id, viagens]) => ({ departamento: nomesDepto.get(id) ?? id.slice(0, 8), viagens }))
      .sort((a, b) => b.viagens - a.viagens).slice(0, 5);

    return {
      veiculos: {
        disponivel: veicDisponiveis, emUso: veicEmUso, manutencao: veicManutencao, baixado: veicBaixados,
        total: veicDisponiveis + veicEmUso + veicManutencao + veicBaixados,
      },
      emCurso: emCurso.map((v) => ({
        id: v.id, numero: v.numero, tipo: v.tipo,
        placa: v.veiculo?.placa ?? '—', modelo: v.veiculo?.modelo ?? null,
        condutorNome: v.condutorNome ?? (v.motoristaId ? nomesCondutor.get(v.motoristaId) ?? null : null),
        dataHoraSaida: v.dataHoraSaida, finalidade: v.observacoesSaida,
        kmInicial: v.kmInicial, paradas: v._count.paradas,
      })),
      alertas: {
        veiculosManutencao: manutencaoLista.map((v) => v.placa + (v.modelo ? ` (${v.modelo})` : '')),
        manutencaoPreventiva: preventivaLista
          .map((v) => ({
            id: v.id, placa: v.placa, modelo: v.modelo,
            kmAtual: v.kmAtual, kmProxima: v.kmProximaManutencao!,
            faltam: v.kmProximaManutencao! - v.kmAtual,
            vencida: v.kmAtual >= v.kmProximaManutencao!,
          }))
          .filter((v) => v.faltam <= LIMIAR_AVISO_MANUTENCAO_KM)
          .sort((a, b) => a.faltam - b.faltam),
        despesasPendentes,
      },
      indicadores: {
        custoTotalMes, kmRodadoMes,
        custoPorKm: kmRodadoMes > 0 ? custoTotalMes / kmRodadoMes : null,
        rankingVeiculo, rankingDepartamento,
      },
    };
  }

  // ---- Paradas (pontos de rota / "caderno" da viagem de frota) ----

  /** Garante que a viagem existe, é de frota e da filial do usuário. */
  private async viagemDaFilial(id: string, user: JwtPayload) {
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: { veiculo: { select: { supervisorId: true } } },
    });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    if (v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    return v;
  }

  // Próxima sequência da rota.
  private async proximaSequencia(viagemId: string): Promise<number> {
    const ultima = await this.prisma.parada.findFirst({
      where: { viagemId }, orderBy: { sequencia: 'desc' }, select: { sequencia: true },
    });
    return (ultima?.sequencia ?? 0) + 1;
  }

  /** Lista as paradas da viagem (ordem da rota) — com status/planejamento/GPS. */
  async listarParadas(id: string, user: JwtPayload) {
    await this.viagemDaFilial(id, user);
    const paradas = await this.prisma.parada.findMany({
      where: { viagemId: id },
      orderBy: { sequencia: 'asc' },
      select: {
        id: true, sequencia: true, status: true, local: true, planejadoLocal: true,
        km: true, dataHora: true, realizadaEm: true, observacao: true, latitude: true, longitude: true,
      },
    });
    return paradas.map((p) => ({
      ...p,
      latitude: p.latitude != null ? Number(p.latitude) : null,
      longitude: p.longitude != null ? Number(p.longitude) : null,
    }));
  }

  /** Adiciona uma parada REALIZADA (ad-hoc) ao log da viagem (não em cancelada). */
  async adicionarParada(id: string, dto: AddParadaDto, user: JwtPayload) {
    const v = await this.viagemDaFilial(id, user);
    assertPodeOperarViagem(user, v);
    if (v.situacao === StatusViagem.CANCELADA) throw new BadRequestException('Viagem cancelada não recebe paradas.');
    // Idempotência (fila offline): se já chegou com essa chave, devolve a existente.
    if (dto.idempotencyKey) {
      const ja = await this.prisma.parada.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (ja) return ja;
    }
    return this.prisma.parada.create({
      data: {
        viagemId: id,
        sequencia: await this.proximaSequencia(id),
        status: StatusParada.REALIZADA,
        local: dto.local,
        km: dto.km ?? null,
        observacao: dto.observacao ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        dataHora: new Date(),
        realizadaEm: new Date(),
        idempotencyKey: dto.idempotencyKey ?? null,
      },
      select: { id: true, sequencia: true, status: true, local: true, km: true, dataHora: true, observacao: true },
    });
  }

  /** Planeja N paradas (status PLANEJADA) — visitas que o condutor pretende fazer. */
  async planejarParadas(id: string, dto: PlanejarParadasDto, user: JwtPayload) {
    const v = await this.viagemDaFilial(id, user);
    assertPodeOperarViagem(user, v);
    if (v.situacao === StatusViagem.CANCELADA) throw new BadRequestException('Viagem cancelada não recebe paradas.');
    const locais = dto.locais.map((l) => l.trim()).filter(Boolean);
    if (locais.length === 0) throw new BadRequestException('Informe ao menos um local.');
    let seq = await this.proximaSequencia(id);
    await this.prisma.parada.createMany({
      data: locais.map((local) => ({
        viagemId: id, sequencia: seq++, status: StatusParada.PLANEJADA, planejadoLocal: local, local,
      })),
    });
    return this.listarParadas(id, user);
  }

  /** Check-in numa parada planejada → REALIZADA (KM + GPS opcional + obs). */
  async checkinParada(id: string, paradaId: string, dto: CheckinParadaDto, user: JwtPayload) {
    const v = await this.viagemDaFilial(id, user);
    assertPodeOperarViagem(user, v);
    if (v.situacao === StatusViagem.CANCELADA) throw new BadRequestException('Viagem cancelada.');
    const p = await this.prisma.parada.findUnique({ where: { id: paradaId } });
    if (!p || p.viagemId !== id) throw new NotFoundException('Parada não encontrada nesta viagem.');
    return this.prisma.parada.update({
      where: { id: paradaId },
      data: {
        status: StatusParada.REALIZADA,
        local: dto.local?.trim() || p.local || p.planejadoLocal,
        km: dto.km ?? p.km,
        observacao: dto.observacao?.trim() || p.observacao,
        latitude: dto.latitude ?? p.latitude,
        longitude: dto.longitude ?? p.longitude,
        dataHora: new Date(),
        realizadaEm: new Date(),
      },
      select: { id: true, sequencia: true, status: true, local: true, km: true, realizadaEm: true },
    });
  }

  /** Marca uma parada planejada como PULADA (visita não realizada). */
  async pularParada(id: string, paradaId: string, user: JwtPayload) {
    const v = await this.viagemDaFilial(id, user);
    assertPodeOperarViagem(user, v);
    const p = await this.prisma.parada.findUnique({ where: { id: paradaId } });
    if (!p || p.viagemId !== id) throw new NotFoundException('Parada não encontrada nesta viagem.');
    return this.prisma.parada.update({
      where: { id: paradaId }, data: { status: StatusParada.PULADA },
      select: { id: true, status: true },
    });
  }

  /** Remove uma parada do log da viagem. */
  async removerParada(id: string, paradaId: string, user: JwtPayload) {
    const v = await this.viagemDaFilial(id, user);
    assertPodeOperarViagem(user, v);
    const p = await this.prisma.parada.findUnique({ where: { id: paradaId } });
    if (!p || p.viagemId !== id) throw new NotFoundException('Parada não encontrada nesta viagem.');
    await this.prisma.parada.delete({ where: { id: paradaId } });
    return { ok: true };
  }

  // ---- Cadastro de locais/pontos de parada (pick-list do planejamento) ----
  /**
   * Lista locais. Sem `scope` → cadastro (todos, com os campos de escopo).
   * Com `scope` (saída) → só os RELEVANTES: da filial (ou globais) E do veículo
   * selecionado OU do depto solicitante OU globais (sem veículo nem depto).
   */
  listarLocais(opts: { somenteAtivos?: boolean; scope?: boolean; filialId?: string; veiculoId?: string; departamentoId?: string }) {
    const where: Prisma.LocalParadaWhereInput = {};
    if (opts.somenteAtivos) where.ativo = true;
    const and: Prisma.LocalParadaWhereInput[] = [];
    // Filial: da filial informada OU global (todas) — vale com ou sem scope.
    if (opts.filialId) and.push({ OR: [{ filialId: opts.filialId }, { filialId: null }] });
    // Scope da saída: veículo selecionado OU depto solicitante OU global.
    if (opts.scope) {
      and.push({
        OR: [
          ...(opts.veiculoId ? [{ veiculoId: opts.veiculoId }] : []),
          ...(opts.departamentoId ? [{ departamentoId: opts.departamentoId }] : []),
          { veiculoId: null, departamentoId: null },
        ],
      });
    }
    if (and.length) where.AND = and;
    return this.prisma.localParada.findMany({ where, orderBy: { nome: 'asc' } });
  }

  async criarLocal(dto: CriarLocalParadaDto) {
    const nome = dto.nome.trim();
    // Dedup no MESMO escopo (mesmo nome pode existir em filiais/escopos distintos).
    const existe = await this.prisma.localParada.findFirst({
      where: { nome, filialId: dto.filialId || null, departamentoId: dto.departamentoId || null, veiculoId: dto.veiculoId || null },
    });
    if (existe) throw new BadRequestException('Já existe um local com esse nome neste escopo.');
    return this.prisma.localParada.create({
      data: {
        nome,
        filialId: dto.filialId || null,
        departamentoId: dto.departamentoId || null,
        veiculoId: dto.veiculoId || null,
      },
    });
  }

  async atualizarLocal(id: string, dto: AtualizarLocalParadaDto) {
    const l = await this.prisma.localParada.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Local não encontrado.');
    return this.prisma.localParada.update({
      where: { id },
      data: {
        nome: dto.nome?.trim() ?? undefined,
        ativo: dto.ativo ?? undefined,
        // string vazia limpa o escopo (vira global/todas); undefined não toca.
        filialId: dto.filialId !== undefined ? (dto.filialId || null) : undefined,
        departamentoId: dto.departamentoId !== undefined ? (dto.departamentoId || null) : undefined,
        veiculoId: dto.veiculoId !== undefined ? (dto.veiculoId || null) : undefined,
      },
    });
  }

  /** Lista as viagens de FROTA da filial (com nome do veículo). */
  async listar(filialId: string, situacao?: StatusViagem) {
    const viagens = await this.prisma.viagem.findMany({
      where: { tipo: TipoViagem.FROTA, filialId, ...(situacao ? { situacao } : {}) },
      include: { veiculo: { select: { placa: true, modelo: true } }, _count: { select: { paradas: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
    return viagens.map((v) => ({
      id: v.id, numero: v.numero, situacao: v.situacao,
      placa: v.veiculo?.placa ?? '—', modelo: v.veiculo?.modelo ?? null,
      condutorNome: v.condutorNome, condutorMatricula: v.condutorMatricula,
      kmInicial: v.kmInicial, kmFinal: v.kmFinal,
      kmRodado: v.kmFinal != null && v.kmInicial != null ? v.kmFinal - v.kmInicial : null,
      finalidade: v.observacoesSaida, localSaida: v.localSaida,
      dataHoraSaida: v.dataHoraSaida, dataHoraChegada: v.dataHoraChegada,
      paradas: v._count.paradas,
    }));
  }

  /** Despesas lançadas numa viagem de frota (lista da tela de detalhe). */
  async despesasDaViagem(viagemId: string, filialId: string) {
    const v = await this.prisma.viagem.findFirst({ where: { id: viagemId, filialId }, select: { id: true } });
    if (!v) throw new NotFoundException('Viagem de frota não encontrada.');
    const despesas = await this.prisma.despesaVeiculo.findMany({
      where: { viagemId },
      include: { tipoDespesa: { select: { nome: true } }, fornecedorRef: { select: { nome: true } } },
      orderBy: { criadoEm: 'desc' },
    });
    return despesas.map((d) => ({
      id: d.id,
      tipo: d.tipoDespesa?.nome ?? '—',
      valor: Number(d.valor),
      fornecedor: d.fornecedorRef?.nome ?? d.fornecedor ?? null,
      situacao: d.situacao,
      dataDespesa: d.dataDespesa,
    }));
  }

  /** Uma viagem de FROTA por id (detalhe — mesma forma do listar). */
  async obterViagem(id: string, filialId: string) {
    const v = await this.prisma.viagem.findFirst({
      where: { id, tipo: TipoViagem.FROTA, filialId },
      include: { veiculo: { select: { placa: true, modelo: true } }, _count: { select: { paradas: true } } },
    });
    if (!v) throw new NotFoundException('Viagem de frota não encontrada.');
    return {
      id: v.id, numero: v.numero, situacao: v.situacao,
      placa: v.veiculo?.placa ?? '—', modelo: v.veiculo?.modelo ?? null,
      condutorNome: v.condutorNome, condutorMatricula: v.condutorMatricula,
      kmInicial: v.kmInicial, kmFinal: v.kmFinal,
      kmRodado: v.kmFinal != null && v.kmInicial != null ? v.kmFinal - v.kmInicial : null,
      finalidade: v.observacoesSaida, localSaida: v.localSaida,
      dataHoraSaida: v.dataHoraSaida, dataHoraChegada: v.dataHoraChegada,
      paradas: v._count.paradas,
    };
  }
}
