import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, StatusPlanejamento, StatusViagem, TipoViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusCondutorService } from '../protheus/protheus-condutor.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { filialDoUsuario } from '../common/filial-scope.js';
import { AdicionarVisitaDto, ApontarVisitaDto, AtualizarAtividadeDto, AtualizarSupervisorDto, CriarAtividadeDto, CriarSupervisorDto, CriarViagemSupervisorDto, EditarDespesaSupervisorDto, EditarViagemSupervisorDto, LancarAdiantamentoDto, LancarDespesaSupervisorDto } from './dto.js';

/**
 * Catálogos do módulo Supervisores/RDV (Fase 3a): Atividade de visita e Região
 * (N:N com município). Escopo por filial: cada filial vê os SEUS + os globais
 * (filialId null). Escrita é gateada a gestor no controller.
 */
@Injectable()
export class SupervisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly condutor: ProtheusCondutorService,
    private readonly core: CoreLookupService,
  ) {}

  // ---- Cadastro de Supervisor de Área + vínculo com o coordenador (Fase 6a) ----
  async listarSupervisores(user: JwtPayload, somenteAtivos?: boolean) {
    const filialId = filialDoUsuario(user);
    const lista = await this.prisma.supervisor.findMany({
      where: { filialId, ...(somenteAtivos ? { ativo: true } : {}) },
      orderBy: { nome: 'asc' },
    });
    const coordIds = [...new Set(lista.map((s) => s.coordenadorId).filter((x): x is string => !!x))];
    const nomes = coordIds.length ? await this.core.nomesUsuarios(coordIds) : new Map<string, string>();
    return lista.map((s) => ({ ...s, coordenadorNome: s.coordenadorId ? (nomes.get(s.coordenadorId) ?? null) : null }));
  }

  async criarSupervisor(dto: CriarSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const matricula = dto.matricula.trim().toUpperCase();
    const ja = await this.prisma.supervisor.findFirst({ where: { filialId, matricula } });
    if (ja) throw new BadRequestException('Já existe um supervisor com essa matrícula nesta filial.');
    if (dto.coordenadorId) await this.core.validarUsuario(dto.coordenadorId, 'Coordenador');
    return this.prisma.supervisor.create({
      data: { matricula, nome: dto.nome.trim(), filialId, coordenadorId: dto.coordenadorId || null },
    });
  }

  async atualizarSupervisor(id: string, dto: AtualizarSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const s = await this.prisma.supervisor.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Supervisor não encontrado.');
    if (s.filialId !== filialId) throw new ForbiddenException('Supervisor de outra filial.');
    if (dto.coordenadorId) await this.core.validarUsuario(dto.coordenadorId, 'Coordenador');
    return this.prisma.supervisor.update({
      where: { id },
      data: {
        nome: dto.nome?.trim() ?? undefined,
        coordenadorId: dto.coordenadorId !== undefined ? (dto.coordenadorId || null) : undefined,
        ativo: dto.ativo ?? undefined,
      },
    });
  }

  // ---- Atividades ----
  listarAtividades(user: JwtPayload, somenteAtivas?: boolean) {
    const filialId = filialDoUsuario(user);
    return this.prisma.atividadeVisita.findMany({
      where: { OR: [{ filialId }, { filialId: null }], ...(somenteAtivas ? { ativo: true } : {}) },
      orderBy: { nome: 'asc' },
    });
  }
  async criarAtividade(dto: CriarAtividadeDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const nome = dto.nome.trim();
    const ja = await this.prisma.atividadeVisita.findFirst({ where: { filialId, nome } });
    if (ja) throw new BadRequestException('Já existe uma atividade com esse nome.');
    return this.prisma.atividadeVisita.create({ data: { nome, filialId } });
  }
  async atualizarAtividade(id: string, dto: AtualizarAtividadeDto, user: JwtPayload) {
    const a = await this.prisma.atividadeVisita.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Atividade não encontrada.');
    if (a.filialId && a.filialId !== user.filialId) throw new BadRequestException('Atividade de outra filial.');
    return this.prisma.atividadeVisita.update({
      where: { id },
      data: { nome: dto.nome?.trim() ?? undefined, ativo: dto.ativo ?? undefined },
    });
  }


  // ---- Viagem mensal do supervisor (container da RDV) ----
  async criarViagemSupervisor(dto: CriarViagemSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const mm = dto.mesReferencia % 100;
    if (mm < 1 || mm > 12) throw new BadRequestException('Mês de referência inválido — use AAAAMM (ex.: 202605).');
    if (dto.veiculoId) {
      const v = await this.prisma.veiculo.findFirst({ where: { id: dto.veiculoId, filialId } });
      if (!v) throw new BadRequestException('Veículo não encontrado nesta filial.');
    }

    // Supervisor identifica-se por matrícula+senha (Protheus loginPortal), como o
    // condutor da frota. Se veio matrícula, a senha é obrigatória e validada aqui
    // (400 se inválida — não 401, que deslogaria). O nome vem do Protheus (fonte).
    let supMatricula: string | null = null;
    let supNome: string | null = null;
    if (dto.supervisorMatricula?.trim()) {
      if (!dto.supervisorSenha?.trim()) throw new BadRequestException('Informe a senha do supervisor.');
      const r = await this.condutor.validar(dto.supervisorMatricula.trim(), dto.supervisorSenha);
      if (r.status === 'INDISPONIVEL') throw new ServiceUnavailableException('Portal do RH indisponível. Tente novamente em instantes.');
      if (r.status !== 'VALIDO') throw new BadRequestException('Matrícula ou senha do supervisor inválidas.');
      supMatricula = r.matricula ?? dto.supervisorMatricula.trim().toUpperCase();
      supNome = r.nome ?? null;
    }

    // Vincula ao Supervisor cadastrado (leva ao coordenador que aprova). Se não
    // estiver cadastrado, o planejamento nasce sem coordenador (não roteia).
    let supervisorRegistroId: string | null = null;
    if (supMatricula) {
      const reg = await this.prisma.supervisor.findFirst({ where: { filialId, matricula: supMatricula, ativo: true } });
      supervisorRegistroId = reg?.id ?? null;
    }

    return this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSequencial.upsert({
        where: { filialId_escopo: { filialId, escopo: 'VIAGEM' } },
        create: { filialId, escopo: 'VIAGEM', ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      return tx.viagem.create({
        data: {
          numero: contador.ultimoNumero,
          filialId,
          tipo: TipoViagem.SUPERVISOR,
          situacao: StatusViagem.EM_CURSO,
          // Planejamento nasce RASCUNHO (o supervisor envia p/ aprovação depois).
          statusPlanejamento: 'RASCUNHO',
          supervisorRegistroId,
          mesReferencia: dto.mesReferencia,
          veiculoId: dto.veiculoId ?? null,
          condutorMatricula: supMatricula,
          condutorNome: supNome,
          dataHoraSaida: new Date(),
          criadoPorId: user.sub,
        },
        include: { supervisorRegistro: { select: { id: true, nome: true, coordenadorId: true } } },
      });
    });
  }

  /** Role da Logística no token (p/ checar gestor/admin). */
  private roleLog(user: JwtPayload): string | undefined {
    return user.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role;
  }
  private ehGestor(user: JwtPayload): boolean {
    const r = this.roleLog(user);
    return r === 'GESTOR_FROTA' || r === 'GESTOR_ENTREGA' || r === 'ADMIN';
  }

  // ---- Workflow do planejamento (supervisor envia · coordenador decide) ----
  private async planejamentoOuErro(id: string, filialId: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { supervisorRegistro: { select: { coordenadorId: true } } } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Planejamento não encontrado.');
    if (v.filialId !== filialId) throw new ForbiddenException('Planejamento de outra filial.');
    return v;
  }

  async enviarPlanejamento(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    if (!['RASCUNHO', 'AJUSTADO', 'REJEITADO'].includes(v.statusPlanejamento ?? '')) {
      throw new BadRequestException('Só envia planejamento em rascunho, ajustado ou rejeitado.');
    }
    return this.prisma.viagem.update({ where: { id }, data: { statusPlanejamento: 'ENVIADO' } });
  }

  async decidirPlanejamento(id: string, decisao: 'APROVADO' | 'AJUSTADO' | 'REJEITADO', comentario: string | undefined, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    if (v.statusPlanejamento !== 'ENVIADO') throw new BadRequestException('Só decide planejamento que foi ENVIADO para aprovação.');
    // Só o coordenador do supervisor (ou gestor/admin) decide.
    const ehCoordenador = v.supervisorRegistro?.coordenadorId && v.supervisorRegistro.coordenadorId === user.sub;
    if (!this.ehGestor(user) && !ehCoordenador) {
      throw new ForbiddenException('Apenas o coordenador do supervisor (ou o gestor) pode aprovar/ajustar/rejeitar.');
    }
    if (decisao !== 'APROVADO' && !comentario?.trim()) throw new BadRequestException('Informe o comentário do ajuste/rejeição.');
    return this.prisma.viagem.update({
      where: { id },
      data: { statusPlanejamento: decisao, aprovadoPorId: user.sub, aprovadoEm: new Date(), comentarioCoordenador: comentario?.trim() || null },
    });
  }

  async iniciarExecucao(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    if (!['APROVADO', 'AJUSTADO'].includes(v.statusPlanejamento ?? '')) {
      throw new BadRequestException('Só inicia execução de planejamento aprovado/ajustado.');
    }
    return this.prisma.viagem.update({ where: { id }, data: { statusPlanejamento: 'EM_EXECUCAO' } });
  }

  /** Planejamentos que caem pro coordenador logado (via vínculo), por status. */
  listarPlanejamentosCoordenador(user: JwtPayload, status?: string) {
    const filialId = filialDoUsuario(user);
    return this.prisma.viagem.findMany({
      where: {
        filialId,
        tipo: TipoViagem.SUPERVISOR,
        supervisorRegistro: { coordenadorId: user.sub },
        ...(status ? { statusPlanejamento: status as StatusPlanejamento } : {}),
      },
      orderBy: [{ mesReferencia: 'desc' }, { numero: 'desc' }],
      include: {
        supervisorRegistro: { select: { id: true, nome: true, matricula: true } },
        _count: { select: { paradas: true, despesas: true } },
      },
    });
  }

  listarViagensSupervisor(user: JwtPayload, mes?: number, situacao?: string) {
    const filialId = filialDoUsuario(user);
    return this.prisma.viagem.findMany({
      where: {
        filialId,
        tipo: TipoViagem.SUPERVISOR,
        ...(mes ? { mesReferencia: mes } : {}),
        ...(situacao ? { situacao: situacao as StatusViagem } : {}),
      },
      orderBy: [{ mesReferencia: 'desc' }, { numero: 'desc' }],
      include: {
        _count: { select: { paradas: true, despesas: true } },
      },
    });
  }

  async obterViagemSupervisor(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: {
        supervisorRegistro: { select: { id: true, nome: true, coordenadorId: true } },
        paradas: {
          orderBy: { sequencia: 'asc' },
          include: { atividade: { select: { nome: true } } },
        },
        despesas: { include: { tipoDespesa: { select: { nome: true, categoria: true } } } },
      },
    });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    return v;
  }

  // ---- Visitas (paradas) da viagem ----
  async adicionarVisita(viagemId: string, dto: AdicionarVisitaDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id: viagemId } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para adicionar visitas.');
    if (dto.atividadeId) {
      const a = await this.prisma.atividadeVisita.findUnique({ where: { id: dto.atividadeId } });
      if (!a || (a.filialId && a.filialId !== filialId)) throw new BadRequestException('Atividade inválida para esta filial.');
    }
    // Na fase de PLANEJAMENTO (rascunho/ajustado/rejeitado) a visita nasce
    // PLANEJADA; durante a EXECUÇÃO ela é uma exceção (cliente incluído em campo)
    // e nasce REALIZADA.
    const emPlanejamento = ['RASCUNHO', 'AJUSTADO', 'REJEITADO'].includes(v.statusPlanejamento ?? '');
    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.parada.count({ where: { viagemId } })) + 1;
      return tx.parada.create({
        data: {
          viagemId,
          sequencia: seq,
          atividadeId: dto.atividadeId ?? null,
          clienteMatricula: dto.clienteMatricula?.trim().toUpperCase() || null,
          clienteNome: dto.clienteNome?.trim() || null,
          municipio: dto.municipio?.trim() || null,
          propriedade: dto.propriedade?.trim() || null,
          local: dto.local?.trim() || null,
          observacao: dto.observacao?.trim() || null,
          dataHora: this.parseData(dto.dataVisita),
          status: emPlanejamento ? 'PLANEJADA' : 'REALIZADA',
        },
        include: { atividade: { select: { nome: true } } },
      });
    });
  }

  /** Apontamento (6c): marca a visita PLANEJADA como REALIZADA (com a atividade
   *  efetiva / obs / data) ou PULADA. Só faz sentido em execução. */
  async apontarVisita(viagemId: string, paradaId: string, dto: ApontarVisitaDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id: viagemId } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Planejamento não encontrado.');
    if (v.filialId !== filialId) throw new ForbiddenException('Planejamento de outra filial.');
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Planejamento concluído — reabra para apontar.');
    const p = await this.prisma.parada.findUnique({ where: { id: paradaId } });
    if (!p || p.viagemId !== viagemId) throw new NotFoundException('Visita não encontrada.');
    if (dto.atividadeId) {
      const a = await this.prisma.atividadeVisita.findUnique({ where: { id: dto.atividadeId } });
      if (!a || (a.filialId && a.filialId !== filialId)) throw new BadRequestException('Atividade inválida para esta filial.');
    }
    return this.prisma.parada.update({
      where: { id: paradaId },
      data: {
        status: dto.status,
        atividadeId: dto.atividadeId !== undefined ? (dto.atividadeId || null) : undefined,
        observacao: dto.observacao !== undefined ? (dto.observacao?.trim() || null) : undefined,
        dataHora: dto.dataVisita ? this.parseData(dto.dataVisita) : undefined,
      },
      include: { atividade: { select: { nome: true } } },
    });
  }

  async removerVisita(viagemId: string, paradaId: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const p = await this.prisma.parada.findUnique({
      where: { id: paradaId },
      include: { viagem: { select: { id: true, tipo: true, filialId: true, situacao: true } } },
    });
    if (!p || p.viagemId !== viagemId || p.viagem.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Visita não encontrada.');
    if (p.viagem.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (p.viagem.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para remover visitas.');
    await this.prisma.parada.delete({ where: { id: paradaId } });
    return { ok: true };
  }

  async concluirViagemSupervisor(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao === StatusViagem.CONCLUIDA) return v;
    return this.prisma.viagem.update({
      where: { id },
      data: { situacao: StatusViagem.CONCLUIDA, statusPlanejamento: 'CONCLUIDO', dataHoraChegada: new Date() },
    });
  }

  // ---- Despesas da viagem do supervisor (compõem a RDV) ----
  async lancarDespesa(viagemId: string, dto: LancarDespesaSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id: viagemId } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para lançar despesas.');
    const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
    if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');
    // INDIVÍDUO não tem veículo; VEÍCULO usa o veículo da viagem (se houver).
    const veiculoId = tipo.categoria === 'INDIVIDUO' ? null : v.veiculoId;
    return this.prisma.despesaVeiculo.create({
      data: {
        filialId,
        veiculoId,
        viagemId,
        tipoDespesaId: tipo.id,
        valor: new Prisma.Decimal(dto.valor),
        dataDespesa: this.parseData(dto.data),
        fornecedor: dto.fornecedor?.trim() || null,
        observacao: dto.observacao?.trim() || null,
        // Redesenho 6d: despesa do supervisor nasce PENDENTE — o coordenador
        // aprova/rejeita (comprovante é opcional). Só APROVADA entra na RDV.
        situacao: 'PENDENTE',
        criadoPorId: user.sub,
      },
      include: { tipoDespesa: { select: { nome: true, categoria: true } } },
    });
  }

  /** Decisão do coordenador sobre a despesa (6d): APROVADA ou CONTESTADA (rejeita,
   *  com motivo). Só o coordenador do supervisor (ou gestor) decide. */
  async decidirDespesa(viagemId: string, despesaId: string, decisao: 'APROVADA' | 'CONTESTADA', motivo: string | undefined, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const d = await this.prisma.despesaVeiculo.findUnique({
      where: { id: despesaId },
      include: { viagem: { select: { tipo: true, filialId: true, supervisorRegistro: { select: { coordenadorId: true } } } } },
    });
    if (!d || d.viagemId !== viagemId || d.viagem?.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Despesa não encontrada.');
    if (d.filialId !== filialId) throw new ForbiddenException('Despesa de outra filial.');
    const ehCoordenador = d.viagem.supervisorRegistro?.coordenadorId && d.viagem.supervisorRegistro.coordenadorId === user.sub;
    if (!this.ehGestor(user) && !ehCoordenador) throw new ForbiddenException('Apenas o coordenador do supervisor (ou o gestor) pode aprovar/rejeitar despesas.');
    if (decisao === 'CONTESTADA' && !motivo?.trim()) throw new BadRequestException('Informe o motivo da rejeição da despesa.');
    return this.prisma.despesaVeiculo.update({
      where: { id: despesaId },
      data: {
        situacao: decisao,
        aprovadoPorId: user.sub,
        aprovadoEm: new Date(),
        motivoContestacao: decisao === 'CONTESTADA' ? motivo!.trim() : null,
      },
      include: { tipoDespesa: { select: { nome: true, categoria: true } } },
    });
  }

  async removerDespesa(viagemId: string, despesaId: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const d = await this.prisma.despesaVeiculo.findUnique({
      where: { id: despesaId },
      include: { viagem: { select: { tipo: true, filialId: true, situacao: true } } },
    });
    if (!d || d.viagemId !== viagemId || d.viagem?.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Despesa não encontrada.');
    if (d.filialId !== filialId) throw new ForbiddenException('Despesa de outra filial.');
    if (d.viagem?.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para remover despesas.');
    await this.prisma.despesaVeiculo.delete({ where: { id: despesaId } });
    return { ok: true };
  }

  // ---- Administração (Fase 5): correções do gestor ----
  async editarViagem(id: string, dto: EditarViagemSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para editar.');
    return this.prisma.viagem.update({
      where: { id },
      data: {
        adiantamento: dto.adiantamento !== undefined ? new Prisma.Decimal(dto.adiantamento) : undefined,
      },
    });
  }

  async reabrirViagem(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.CONCLUIDA) return v;
    return this.prisma.viagem.update({
      where: { id },
      data: { situacao: StatusViagem.EM_CURSO, statusPlanejamento: 'EM_EXECUCAO', dataHoraChegada: null },
    });
  }

  async editarVisita(viagemId: string, paradaId: string, dto: AdicionarVisitaDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const p = await this.prisma.parada.findUnique({
      where: { id: paradaId },
      include: { viagem: { select: { tipo: true, filialId: true, situacao: true } } },
    });
    if (!p || p.viagemId !== viagemId || p.viagem?.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Visita não encontrada.');
    if (p.viagem.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (p.viagem.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para editar.');
    if (dto.atividadeId) {
      const a = await this.prisma.atividadeVisita.findUnique({ where: { id: dto.atividadeId } });
      if (!a || (a.filialId && a.filialId !== filialId)) throw new BadRequestException('Atividade inválida para esta filial.');
    }
    return this.prisma.parada.update({
      where: { id: paradaId },
      data: {
        atividadeId: dto.atividadeId !== undefined ? (dto.atividadeId || null) : undefined,
        clienteMatricula: dto.clienteMatricula !== undefined ? (dto.clienteMatricula.trim().toUpperCase() || null) : undefined,
        clienteNome: dto.clienteNome !== undefined ? (dto.clienteNome.trim() || null) : undefined,
        municipio: dto.municipio !== undefined ? (dto.municipio.trim() || null) : undefined,
        propriedade: dto.propriedade !== undefined ? (dto.propriedade.trim() || null) : undefined,
        observacao: dto.observacao !== undefined ? (dto.observacao.trim() || null) : undefined,
        dataHora: dto.dataVisita !== undefined ? this.parseData(dto.dataVisita) : undefined,
      },
      include: { atividade: { select: { nome: true } } },
    });
  }

  async editarDespesa(viagemId: string, despesaId: string, dto: EditarDespesaSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const d = await this.prisma.despesaVeiculo.findUnique({
      where: { id: despesaId },
      include: { viagem: { select: { tipo: true, filialId: true, situacao: true, veiculoId: true } } },
    });
    if (!d || d.viagemId !== viagemId || d.viagem?.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Despesa não encontrada.');
    if (d.filialId !== filialId) throw new ForbiddenException('Despesa de outra filial.');
    if (d.viagem.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para editar.');
    // Trocar o tipo reclassifica a categoria → recalcula se tem veículo.
    let tipoId: string | undefined;
    let veiculoId: string | null | undefined;
    if (dto.tipoDespesaId) {
      const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
      if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');
      tipoId = tipo.id;
      veiculoId = tipo.categoria === 'INDIVIDUO' ? null : d.viagem.veiculoId;
    }
    return this.prisma.despesaVeiculo.update({
      where: { id: despesaId },
      data: {
        tipoDespesaId: tipoId,
        veiculoId,
        valor: dto.valor !== undefined ? new Prisma.Decimal(dto.valor) : undefined,
        dataDespesa: dto.data !== undefined ? this.parseData(dto.data) : undefined,
        fornecedor: dto.fornecedor !== undefined ? (dto.fornecedor.trim() || null) : undefined,
        observacao: dto.observacao !== undefined ? (dto.observacao.trim() || null) : undefined,
      },
      include: { tipoDespesa: { select: { nome: true, categoria: true } } },
    });
  }

  /**
   * RDV (Relatório de Despesas de Viagem): agrega DIA × TIPO de despesa, com o
   * município do dia (das visitas), totais por tipo/categoria e o SALDO contra o
   * adiantamento. Espelha a planilha "RDV Maio".
   */
  async rdv(viagemId: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({
      where: { id: viagemId },
      include: {
        veiculo: { select: { placa: true, modelo: true } },
        // Só despesas APROVADAS entram na RDV (mesma regra da RDV mensal/Fechamento);
        // PENDENTE/CONTESTADA não somam no relatório de prestação de contas.
        despesas: { where: { situacao: 'APROVADA' }, include: { tipoDespesa: { select: { id: true, nome: true, categoria: true } } } },
        paradas: { select: { dataHora: true, municipio: true } },
      },
    });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');

    const diaDe = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : '—');

    // Colunas = tipos distintos usados nas despesas (ordem por nome).
    const tiposMap = new Map<string, { id: string; nome: string; categoria: string }>();
    for (const d of v.despesas) {
      if (d.tipoDespesa) tiposMap.set(d.tipoDespesa.id, { id: d.tipoDespesa.id, nome: d.tipoDespesa.nome, categoria: d.tipoDespesa.categoria });
    }
    const tipos = [...tiposMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    // Municípios por dia (das visitas).
    const munsPorDia = new Map<string, Set<string>>();
    for (const p of v.paradas) {
      if (!p.municipio) continue;
      const dia = diaDe(p.dataHora);
      if (!munsPorDia.has(dia)) munsPorDia.set(dia, new Set());
      munsPorDia.get(dia)!.add(p.municipio);
    }

    // Grade dia × tipo.
    const diasMap = new Map<string, { valores: Record<string, number>; total: number }>();
    const totaisPorTipo: Record<string, number> = {};
    const totaisPorCategoria = { VEICULO: 0, INDIVIDUO: 0 };
    let total = 0;
    for (const d of v.despesas) {
      const dia = diaDe(d.dataDespesa);
      const tid = d.tipoDespesaId;
      const val = Number(d.valor);
      if (!diasMap.has(dia)) diasMap.set(dia, { valores: {}, total: 0 });
      const linha = diasMap.get(dia)!;
      linha.valores[tid] = (linha.valores[tid] ?? 0) + val;
      linha.total += val;
      totaisPorTipo[tid] = (totaisPorTipo[tid] ?? 0) + val;
      const cat = d.tipoDespesa?.categoria === 'INDIVIDUO' ? 'INDIVIDUO' : 'VEICULO';
      totaisPorCategoria[cat] += val;
      total += val;
    }
    const dias = [...diasMap.entries()]
      .map(([data, o]) => ({ data, municipios: [...(munsPorDia.get(data) ?? [])], valores: o.valores, total: o.total }))
      .sort((a, b) => a.data.localeCompare(b.data));

    const adiantamento = v.adiantamento != null ? Number(v.adiantamento) : 0;
    // saldo > 0 = sobra do adiantamento (a devolver à CAPUL); < 0 = a reembolsar.
    const saldo = adiantamento - total;

    return {
      viagem: { id: v.id, numero: v.numero, mesReferencia: v.mesReferencia, situacao: v.situacao },
      supervisor: { matricula: v.condutorMatricula, nome: v.condutorNome },
      veiculo: v.veiculo,
      tipos,
      dias,
      totaisPorTipo,
      totaisPorCategoria,
      total,
      adiantamento,
      saldo,
    };
  }

  // ---- Adiantamentos (mensais, vários por supervisor/mês) ----
  async lancarAdiantamento(dto: LancarAdiantamentoDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: dto.supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new BadRequestException('Supervisor inválido para esta filial.');
    if (dto.mesReferencia % 100 < 1 || dto.mesReferencia % 100 > 12) throw new BadRequestException('Mês de referência inválido (AAAAMM).');
    return this.prisma.adiantamento.create({
      data: {
        supervisorId: dto.supervisorId, mesReferencia: dto.mesReferencia,
        valor: new Prisma.Decimal(dto.valor), dataAdiantamento: this.parseData(dto.data),
        observacao: dto.observacao?.trim() || null, lancadoPorId: user.sub,
      },
    });
  }
  async listarAdiantamentos(user: JwtPayload, supervisorId: string, mes: number) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new NotFoundException('Supervisor não encontrado.');
    return this.prisma.adiantamento.findMany({ where: { supervisorId, mesReferencia: mes }, orderBy: { dataAdiantamento: 'asc' } });
  }
  async removerAdiantamento(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const a = await this.prisma.adiantamento.findUnique({ where: { id }, include: { supervisor: { select: { filialId: true } } } });
    if (!a || a.supervisor.filialId !== filialId) throw new NotFoundException('Adiantamento não encontrado.');
    await this.prisma.adiantamento.delete({ where: { id } });
    return { ok: true };
  }

  /** RDV MENSAL: agrega TODOS os planejamentos do supervisor no mês (despesas
   *  aprovadas, dia × tipo) + os adiantamentos → saldo. */
  async rdvMensal(supervisorId: string, mes: number, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new NotFoundException('Supervisor não encontrado.');

    const planejamentos = await this.prisma.viagem.findMany({
      where: { filialId, tipo: TipoViagem.SUPERVISOR, supervisorRegistroId: supervisorId, mesReferencia: mes },
      include: {
        despesas: { where: { situacao: 'APROVADA' }, include: { tipoDespesa: { select: { id: true, nome: true, categoria: true } } } },
        paradas: { select: { dataHora: true, municipio: true } },
      },
    });
    const despesas = planejamentos.flatMap((p) => p.despesas);
    const paradas = planejamentos.flatMap((p) => p.paradas);
    const diaDe = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : '—');

    const tiposMap = new Map<string, { id: string; nome: string; categoria: string }>();
    for (const d of despesas) if (d.tipoDespesa) tiposMap.set(d.tipoDespesa.id, { id: d.tipoDespesa.id, nome: d.tipoDespesa.nome, categoria: d.tipoDespesa.categoria });
    const tipos = [...tiposMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const munsPorDia = new Map<string, Set<string>>();
    for (const p of paradas) { if (!p.municipio) continue; const dia = diaDe(p.dataHora); if (!munsPorDia.has(dia)) munsPorDia.set(dia, new Set()); munsPorDia.get(dia)!.add(p.municipio); }

    const diasMap = new Map<string, { valores: Record<string, number>; total: number }>();
    const totaisPorTipo: Record<string, number> = {};
    const totaisPorCategoria = { VEICULO: 0, INDIVIDUO: 0 };
    let total = 0;
    for (const d of despesas) {
      const dia = diaDe(d.dataDespesa); const tid = d.tipoDespesaId; const val = Number(d.valor);
      if (!diasMap.has(dia)) diasMap.set(dia, { valores: {}, total: 0 });
      const linha = diasMap.get(dia)!; linha.valores[tid] = (linha.valores[tid] ?? 0) + val; linha.total += val;
      totaisPorTipo[tid] = (totaisPorTipo[tid] ?? 0) + val;
      totaisPorCategoria[d.tipoDespesa?.categoria === 'INDIVIDUO' ? 'INDIVIDUO' : 'VEICULO'] += val;
      total += val;
    }
    const dias = [...diasMap.entries()].map(([data, o]) => ({ data, municipios: [...(munsPorDia.get(data) ?? [])], valores: o.valores, total: o.total })).sort((a, b) => a.data.localeCompare(b.data));

    const adiantamentos = await this.prisma.adiantamento.findMany({ where: { supervisorId, mesReferencia: mes }, orderBy: { dataAdiantamento: 'asc' } });
    const totalAdiantamento = adiantamentos.reduce((s, a) => s + Number(a.valor), 0);
    const saldo = totalAdiantamento - total; // >0 devolver à CAPUL; <0 reembolsar

    return {
      supervisor: { id: sup.id, matricula: sup.matricula, nome: sup.nome },
      mesReferencia: mes, planejamentos: planejamentos.length,
      tipos, dias, totaisPorTipo, totaisPorCategoria, total,
      adiantamentos, totalAdiantamento, saldo,
    };
  }

  /** Parseia data do formulário. Date-only ("YYYY-MM-DD") vira MEIO-DIA em SP p/
   *  não recuar 1 dia no fuso (UTC midnight → dia anterior no Brasil). */
  private parseData(s?: string): Date {
    if (!s) return new Date();
    return s.includes('T') ? new Date(s) : new Date(`${s}T12:00:00-03:00`);
  }

}
