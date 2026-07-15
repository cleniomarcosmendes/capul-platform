import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, StatusPlanejamento, StatusViagem, TipoViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusCondutorService } from '../protheus/protheus-condutor.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { filialDoUsuario } from '../common/filial-scope.js';
import { CofreStorageService } from '../cofre/cofre-storage.service.js';
import type { ReciboBinario } from '../despesa/despesa.service.js';
import { AdicionarVisitaDto, ApontarVisitaDto, AtualizarAtividadeDto, AtualizarSupervisorDto, CriarAtividadeDto, CriarSupervisorDto, CriarViagemSupervisorDto, EditarDespesaSupervisorDto, EditarViagemSupervisorDto, LancarAdiantamentoDto, LancarDespesaSupervisorDto } from './dto.js';

/** Normaliza matrícula → chapa E-prefixada (E+5díg), colapsando `E01047`/`01047`/
 *  `1047` no mesmo valor. Mesma regra do `frota.service` (match de condutor) — usar
 *  para comparar matrículas sem depender do formato digitado. */
const chapa = (m: string) => 'E' + (m || '').replace(/\D/g, '').slice(-5).padStart(5, '0');

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
    private readonly storage: CofreStorageService,
  ) {}

  /** Anexa o recibo (foto/PDF) à despesa: sobe no cofre (MinIO) e grava
   *  objectKey/hash/mime no registro. Mesmo mecanismo da frota. */
  private async anexarReciboDespesa(despesaId: string, filialId: string, recibo: ReciboBinario) {
    const { objectKey, hash } = await this.storage.put(recibo.buffer, { filialId, refId: despesaId, mimeType: recibo.mimetype });
    return this.prisma.despesaVeiculo.update({
      where: { id: despesaId },
      data: { comprovanteObjectKey: objectKey, comprovanteHash: hash, comprovanteMime: recibo.mimetype ?? null },
    });
  }

  // ---- Cadastro de Supervisor de Área + vínculo com o coordenador (Fase 6a) ----
  async listarSupervisores(user: JwtPayload, somenteAtivos?: boolean) {
    const filialId = filialDoUsuario(user);
    const escopo = await this.escopoSupervisorWhere(user);
    const lista = await this.prisma.supervisor.findMany({
      where: { filialId, ...escopo, ...(somenteAtivos ? { ativo: true } : {}) },
      orderBy: { nome: 'asc' },
    });
    const coordIds = [...new Set(lista.map((s) => s.coordenadorId).filter((x): x is string => !!x))];
    const nomes = coordIds.length ? await this.core.nomesUsuarios(coordIds) : new Map<string, string>();
    return lista.map((s) => ({ ...s, coordenadorNome: s.coordenadorId ? (nomes.get(s.coordenadorId) ?? null) : null }));
  }

  async criarSupervisor(dto: CriarSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const departamentoId = dto.departamentoId?.trim() || null;
    await this.assertPodeGerirDepartamento(departamentoId, user);
    const matricula = dto.matricula.trim().toUpperCase();
    const ja = await this.prisma.supervisor.findFirst({ where: { filialId, matricula } });
    if (ja) throw new BadRequestException('Já existe um supervisor com essa matrícula nesta filial.');
    if (dto.coordenadorId) await this.core.validarUsuario(dto.coordenadorId, 'Coordenador');
    return this.prisma.supervisor.create({
      data: { matricula, nome: dto.nome.trim(), filialId, departamentoId, coordenadorId: dto.coordenadorId || null },
    });
  }

  async atualizarSupervisor(id: string, dto: AtualizarSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const s = await this.prisma.supervisor.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Supervisor não encontrado.');
    if (s.filialId !== filialId) throw new ForbiddenException('Supervisor de outra filial.');
    // Pode mexer NESTE registro (departamento atual dele é do seu escopo)…
    await this.assertPodeGerirDepartamento(s.departamentoId, user);
    // …e, se está movendo de departamento, o destino também precisa ser do seu escopo.
    if (dto.departamentoId !== undefined) await this.assertPodeGerirDepartamento(dto.departamentoId?.trim() || null, user);
    if (dto.coordenadorId) await this.core.validarUsuario(dto.coordenadorId, 'Coordenador');
    return this.prisma.supervisor.update({
      where: { id },
      data: {
        nome: dto.nome?.trim() ?? undefined,
        departamentoId: dto.departamentoId !== undefined ? (dto.departamentoId?.trim() || null) : undefined,
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

  /** Tipos de despesa (catálogo) p/ o fluxo Supervisores/RDV — endpoint PRÓPRIO
   *  (gateado pelas roles do supervisor), evitando depender do controller da frota. */
  listarTiposDespesa(somenteAtivos?: boolean) {
    return this.prisma.tipoDespesa.findMany({
      where: somenteAtivos ? { ativo: true } : {},
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
    } else if (this.roleLog(user) === 'SUPERVISOR') {
      // Auto-serviço (híbrido): o próprio usuário logado É o supervisor — o JWT já
      // autenticou, então dispensa matrícula+senha. Identifica pela matrícula do
      // login (liga ao cadastro adiante). O Supervisor de Departamento cria por representante
      // pelo ramo acima (matrícula+senha do representante).
      const u = await this.matriculaDoUsuario(user.sub);
      if (!u?.matricula?.trim()) {
        throw new BadRequestException('Seu usuário não tem matrícula cadastrada. Peça ao administrador ou informe a matrícula e a senha do supervisor.');
      }
      supMatricula = u.matricula.trim().toUpperCase();
      supNome = u.nome;
    }

    // O planejamento PRECISA estar vinculado a um supervisor de área cadastrado E com
    // COORDENADOR — senão nasceria órfão e não roteia para aprovação (ninguém o veria).
    // Bloqueia a criação sem isso (o "montar o time" tem que vir antes).
    if (!supMatricula) {
      throw new BadRequestException('Informe a matrícula do supervisor de área (ou entre como o próprio supervisor) — o planejamento precisa estar vinculado a um cadastro.');
    }
    const reg = await this.prisma.supervisor.findFirst({
      where: { filialId, matricula: supMatricula, ativo: true },
      select: { id: true, coordenadorId: true },
    });
    if (!reg) {
      throw new BadRequestException('Supervisor de área não cadastrado na equipe desta filial. Peça ao Supervisor de Departamento para te cadastrar (montar o time) com um coordenador antes de criar o planejamento.');
    }
    if (!reg.coordenadorId) {
      throw new BadRequestException('Seu cadastro de supervisor de área não tem coordenador vinculado (quem aprova). Peça ao Supervisor de Departamento para vincular um coordenador antes de criar o planejamento.');
    }
    const supervisorRegistroId = reg.id;

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
  /** RDV do mês encerrado? (TEMA 2) — bloqueia despesa/adiantamento/visita. Sem
   *  supervisor cadastrado ou mês → não trava (nada a fechar). */
  private async assertRdvAberto(supervisorId: string | null | undefined, mes: number | null | undefined) {
    if (!supervisorId || mes == null) return;
    const f = await this.prisma.fechamentoRdv.findUnique({ where: { supervisorId_mesReferencia: { supervisorId, mesReferencia: mes } } });
    if (f) throw new BadRequestException('RDV do mês encerrado — reabra o mês (coordenador/gestor) para alterar despesas, adiantamentos ou visitas.');
  }
  /** Matrícula+nome do usuário logado (core, read-only) — usado no auto-serviço do
   *  supervisor (identifica o supervisor pelo próprio login, sem matrícula+senha). */
  private async matriculaDoUsuario(userId: string): Promise<{ matricula: string | null; nome: string } | null> {
    const rows = await this.prisma.$queryRaw<{ matricula: string | null; nome: string }[]>(
      Prisma.sql`SELECT matricula, TRIM(nome) AS nome FROM "core"."usuarios" WHERE id = ${userId} LIMIT 1`);
    return rows[0] ?? null;
  }
  private ehAdmin(user: JwtPayload): boolean { return this.roleLog(user) === 'ADMIN'; }
  private ehSupervisorDepto(user: JwtPayload): boolean { return this.roleLog(user) === 'SUPERVISOR_FROTA'; }

  /** Departamentos que o Supervisor de Departamento (SUPERVISOR_FROTA) cobre — MESMA
   *  fonte da frota: os departamentos dos veículos que ele supervisiona. Uma só
   *  definição de "os departamentos dele" no módulo. Vazio → não cobre nenhum. */
  private async deptosDoSupervisorDepto(user: JwtPayload): Promise<string[]> {
    const rows = await this.prisma.veiculo.findMany({
      where: { filialId: user.filialId ?? undefined, supervisorId: user.sub },
      select: { departamentoLotacaoId: true },
      distinct: ['departamentoLotacaoId'],
    });
    return rows.map((r) => r.departamentoLotacaoId).filter((x): x is string => !!x);
  }

  /** Filtro Prisma de quais representantes o usuário alcança no RDV: ADMIN todos da
   *  filial; Supervisor de Departamento os dos SEUS departamentos; demais (coordenador)
   *  só os SEUS (vínculo). Gestores de entrega/frota NÃO participam do RDV. */
  private async escopoSupervisorWhere(user: JwtPayload): Promise<Prisma.SupervisorWhereInput> {
    if (this.ehAdmin(user)) return {};
    if (this.ehSupervisorDepto(user)) return { departamentoId: { in: await this.deptosDoSupervisorDepto(user) } };
    return { coordenadorId: user.sub };
  }

  /** O usuário logado É o próprio representante? (auto-serviço) — casa a matrícula do
   *  login (core, read-only) com a do cadastro, tolerando prefixo/zeros como o
   *  owner-check do workflow. Só consulta se o cadastro tiver matrícula. */
  private async ehProprioSupervisor(matriculaSup: string | null | undefined, user: JwtPayload): Promise<boolean> {
    if (!matriculaSup) return false;
    const u = await this.matriculaDoUsuario(user.sub);
    return !!u?.matricula && chapa(u.matricula) === chapa(matriculaSup);
  }

  /** Alcança um representante específico? ADMIN sim; Supervisor de Departamento se o
   *  depto do representante é um dos seus; coordenador se é supervisor dele; e o PRÓPRIO
   *  representante (auto-serviço, por matrícula) alcança o SEU. Usado no
   *  Fechamento/RDV/adiantamentos. */
  private async assertEscopoSupervisor(sup: { coordenadorId: string | null; departamentoId: string | null; matricula?: string | null } | null, user: JwtPayload) {
    if (!sup || this.ehAdmin(user)) return;
    if (this.ehSupervisorDepto(user)) {
      const deps = await this.deptosDoSupervisorDepto(user);
      if (sup.departamentoId && deps.includes(sup.departamentoId)) return;
      throw new ForbiddenException('Representante fora do seu departamento.');
    }
    if (sup.coordenadorId === user.sub) return;
    // Auto-serviço: o próprio supervisor de área alcança o SEU RDV/adiantamentos.
    if (await this.ehProprioSupervisor(sup.matricula, user)) return;
    throw new ForbiddenException('Representante fora da sua coordenação.');
  }

  /** "Montar o time" (escrever o cadastro) e escolher o departamento: ADMIN em qualquer
   *  depto; Supervisor de Departamento só nos SEUS; ninguém mais. deptId null → só ADMIN
   *  (representante sem depto fica fora do escopo de qualquer Supervisor de Departamento). */
  private async assertPodeGerirDepartamento(deptId: string | null, user: JwtPayload) {
    if (this.ehAdmin(user)) return;
    if (this.ehSupervisorDepto(user)) {
      const deps = await this.deptosDoSupervisorDepto(user);
      if (deptId && deps.includes(deptId)) return;
      throw new ForbiddenException('Departamento fora do seu escopo.');
    }
    throw new ForbiddenException('Sem permissão para gerir o cadastro de representantes.');
  }

  /** Decide (aprova/ajusta/rejeita) planejamento/despesa: ADMIN; o Supervisor de
   *  Departamento (se o representante é de um depto seu); o COORDENADOR do representante.
   *  O supervisionado nunca decide o seu. */
  private async assertPodeDecidir(reg: { coordenadorId: string | null; departamentoId: string | null } | null | undefined, user: JwtPayload) {
    if (this.ehAdmin(user)) return;
    if (this.ehSupervisorDepto(user)) {
      const deps = await this.deptosDoSupervisorDepto(user);
      if (reg?.departamentoId && deps.includes(reg.departamentoId)) return;
      throw new ForbiddenException('Representante fora do seu departamento.');
    }
    if (reg?.coordenadorId && reg.coordenadorId === user.sub) return;
    throw new ForbiddenException('Apenas o coordenador do representante (ou o Supervisor de Departamento) pode decidir.');
  }

  // ---- Workflow do planejamento (supervisor envia · coordenador decide) ----
  private async planejamentoOuErro(id: string, filialId: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { supervisorRegistro: { select: { coordenadorId: true, matricula: true, departamentoId: true } } } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Planejamento não encontrado.');
    if (v.filialId !== filialId) throw new ForbiddenException('Planejamento de outra filial.');
    return v;
  }

  /** Transições que o PRÓPRIO supervisor dispara (enviar/iniciar): quem pode é o
   *  representante DONO do RDV (por matrícula), o coordenador dele, o Supervisor de
   *  Departamento (se é de um depto seu), ou ADMIN. Sem isso, qualquer supervisor da
   *  mesma filial avançaria o planejamento alheio (a filial já foi checada em
   *  planejamentoOuErro). Planejamento sem cadastro vinculado (não roteia): o criador. */
  private async assertDonoOuGestorPlanejamento(
    v: { criadoPorId: string | null; supervisorRegistro: { coordenadorId: string | null; matricula: string; departamentoId: string | null } | null },
    user: JwtPayload,
  ) {
    if (this.ehAdmin(user)) return;
    if (this.ehSupervisorDepto(user)) {
      const dep = v.supervisorRegistro?.departamentoId;
      const deps = await this.deptosDoSupervisorDepto(user);
      if (dep && deps.includes(dep)) return;
      throw new ForbiddenException('Planejamento fora do seu departamento.');
    }
    const coord = v.supervisorRegistro?.coordenadorId;
    if (coord && coord === user.sub) return; // coordenador do supervisor
    const supMat = v.supervisorRegistro?.matricula;
    if (supMat) {
      const u = await this.matriculaDoUsuario(user.sub);
      if (u?.matricula && chapa(u.matricula) === chapa(supMat)) return; // é o próprio representante
    } else if (v.criadoPorId && v.criadoPorId === user.sub) {
      return; // planejamento sem cadastro vinculado: o criador é o dono
    }
    throw new ForbiddenException('Apenas o representante dono do planejamento, o coordenador dele ou o Supervisor de Departamento pode fazer isso.');
  }

  async enviarPlanejamento(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    await this.assertDonoOuGestorPlanejamento(v, user);
    // Sem coordenador não há para quem enviar (planejamento órfão legado). Barra o envio.
    if (!v.supervisorRegistro?.coordenadorId) {
      throw new BadRequestException('Este planejamento não tem coordenador vinculado — não há para quem enviar. Peça ao Supervisor de Departamento para vincular um coordenador ao seu cadastro.');
    }
    if (!['RASCUNHO', 'AJUSTADO', 'REJEITADO'].includes(v.statusPlanejamento ?? '')) {
      throw new BadRequestException('Só envia planejamento em rascunho, ajustado ou rejeitado.');
    }
    return this.prisma.viagem.update({ where: { id }, data: { statusPlanejamento: 'ENVIADO' } });
  }

  async decidirPlanejamento(id: string, decisao: 'APROVADO' | 'AJUSTADO' | 'REJEITADO', comentario: string | undefined, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    if (v.statusPlanejamento !== 'ENVIADO') throw new BadRequestException('Só decide planejamento que foi ENVIADO para aprovação.');
    await this.assertPodeDecidir(v.supervisorRegistro, user);
    if (decisao !== 'APROVADO' && !comentario?.trim()) throw new BadRequestException('Informe o comentário do ajuste/rejeição.');
    return this.prisma.viagem.update({
      where: { id },
      data: { statusPlanejamento: decisao, aprovadoPorId: user.sub, aprovadoEm: new Date(), comentarioCoordenador: comentario?.trim() || null },
    });
  }

  async iniciarExecucao(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.planejamentoOuErro(id, filialId);
    await this.assertDonoOuGestorPlanejamento(v, user);
    if (!['APROVADO', 'AJUSTADO'].includes(v.statusPlanejamento ?? '')) {
      throw new BadRequestException('Só inicia execução de planejamento aprovado/ajustado.');
    }
    return this.prisma.viagem.update({ where: { id }, data: { statusPlanejamento: 'EM_EXECUCAO' } });
  }

  /** Fila de aprovação: o COORDENADOR vê os planejamentos dos SEUS supervisores (via
   *  vínculo); o Supervisor de Departamento vê os dos SEUS departamentos; ADMIN vê
   *  TODOS da filial. Espelha o `decidir`. */
  async listarPlanejamentosCoordenador(user: JwtPayload, status?: string) {
    const filialId = filialDoUsuario(user);
    let regFiltro: Prisma.ViagemWhereInput = {};
    if (this.ehAdmin(user)) regFiltro = {};
    else if (this.ehSupervisorDepto(user)) regFiltro = { supervisorRegistro: { departamentoId: { in: await this.deptosDoSupervisorDepto(user) } } };
    else regFiltro = { supervisorRegistro: { coordenadorId: user.sub } };
    return this.prisma.viagem.findMany({
      where: {
        filialId,
        tipo: TipoViagem.SUPERVISOR,
        ...regFiltro,
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
        // Saídas de veículo (frota) vinculadas a este RDV → o KM vem daqui.
        saidasVinculadas: {
          orderBy: { dataHoraSaida: 'asc' },
          select: {
            id: true, numero: true, kmInicial: true, kmFinal: true, situacao: true,
            dataHoraSaida: true, dataHoraChegada: true,
            veiculo: { select: { placa: true, modelo: true } },
          },
        },
      },
    });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    // KM total rodado no RDV = soma dos KMs das saídas vinculadas já fechadas.
    const kmTotalSaidas = (v.saidasVinculadas ?? []).reduce(
      (s, sd) => s + (sd.kmFinal != null && sd.kmInicial != null ? sd.kmFinal - sd.kmInicial : 0), 0);
    return { ...v, kmTotalSaidas };
  }

  // ---- Visitas (paradas) da viagem ----
  async adicionarVisita(viagemId: string, dto: AdicionarVisitaDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id: viagemId } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para adicionar visitas.');
    await this.assertRdvAberto(v.supervisorRegistroId, v.mesReferencia);
    if (dto.atividadeId) {
      const a = await this.prisma.atividadeVisita.findUnique({ where: { id: dto.atividadeId } });
      if (!a || (a.filialId && a.filialId !== filialId)) throw new BadRequestException('Atividade inválida para esta filial.');
    }
    // Na fase de PLANEJAMENTO (rascunho/ajustado/rejeitado) a visita nasce
    // PLANEJADA; durante a EXECUÇÃO ela é uma exceção (cliente incluído em campo)
    // e nasce REALIZADA.
    // Fila offline (app): reenvio com a mesma chave não duplica a visita.
    if (dto.idempotencyKey) {
      const ja = await this.prisma.parada.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: { atividade: { select: { nome: true } } } });
      if (ja) return ja;
    }
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
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          dataHora: this.parseData(dto.dataVisita),
          status: emPlanejamento ? 'PLANEJADA' : 'REALIZADA',
          idempotencyKey: dto.idempotencyKey ?? null,
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
    await this.assertRdvAberto(v.supervisorRegistroId, v.mesReferencia);
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
        latitude: dto.latitude ?? undefined,
        longitude: dto.longitude ?? undefined,
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
  async lancarDespesa(viagemId: string, dto: LancarDespesaSupervisorDto, user: JwtPayload, recibo?: ReciboBinario) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id: viagemId } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao === StatusViagem.CONCLUIDA) throw new BadRequestException('Viagem concluída — reabra para lançar despesas.');
    await this.assertRdvAberto(v.supervisorRegistroId, v.mesReferencia);
    // Fila offline (app): reenvio com a mesma chave não duplica a despesa.
    if (dto.idempotencyKey) {
      const ja = await this.prisma.despesaVeiculo.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: { tipoDespesa: { select: { nome: true, categoria: true } } } });
      if (ja) return ja;
    }
    const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
    if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');
    // INDIVÍDUO não tem veículo; VEÍCULO usa o veículo da viagem (se houver).
    const veiculoId = tipo.categoria === 'INDIVIDUO' ? null : v.veiculoId;
    const d = await this.prisma.despesaVeiculo.create({
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
        // aprova/rejeita (comprovante é opcional, mas lastreia a decisão). Só
        // APROVADA entra na RDV.
        situacao: 'PENDENTE',
        criadoPorId: user.sub,
        idempotencyKey: dto.idempotencyKey ?? null,
      },
      include: { tipoDespesa: { select: { nome: true, categoria: true } } },
    });
    if (recibo) return this.anexarReciboDespesa(d.id, filialId, recibo);
    return d;
  }

  /** Decisão do coordenador sobre a despesa (6d): APROVADA ou CONTESTADA (rejeita,
   *  com motivo). Só o coordenador do supervisor (ou gestor) decide. */
  async decidirDespesa(viagemId: string, despesaId: string, decisao: 'APROVADA' | 'CONTESTADA', motivo: string | undefined, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const d = await this.prisma.despesaVeiculo.findUnique({
      where: { id: despesaId },
      include: { viagem: { select: { tipo: true, filialId: true, supervisorRegistro: { select: { coordenadorId: true, departamentoId: true } } } } },
    });
    if (!d || d.viagemId !== viagemId || d.viagem?.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Despesa não encontrada.');
    if (d.filialId !== filialId) throw new ForbiddenException('Despesa de outra filial.');
    await this.assertPodeDecidir(d.viagem.supervisorRegistro, user);
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
    if (d.comprovanteObjectKey) {
      try { await this.storage.remove(d.comprovanteObjectKey); } catch { /* objeto órfão é tolerável */ }
    }
    await this.prisma.despesaVeiculo.delete({ where: { id: despesaId } });
    return { ok: true };
  }

  /** Download do comprovante da despesa (o coordenador vê antes de decidir).
   *  Escopo por filial: quem enxerga o planejamento enxerga o recibo. */
  async obterReciboDespesa(viagemId: string, despesaId: string, user: JwtPayload): Promise<{ buffer: Buffer; mimeType: string }> {
    const filialId = filialDoUsuario(user);
    const d = await this.prisma.despesaVeiculo.findUnique({
      where: { id: despesaId },
      include: { viagem: { select: { tipo: true, filialId: true } } },
    });
    if (!d || d.viagemId !== viagemId || d.viagem?.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Despesa não encontrada.');
    if (d.filialId !== filialId) throw new ForbiddenException('Despesa de outra filial.');
    if (!d.comprovanteObjectKey) throw new NotFoundException('Esta despesa não tem comprovante anexado.');
    const buffer = await this.storage.get(d.comprovanteObjectKey);
    return { buffer, mimeType: d.comprovanteMime ?? 'application/octet-stream' };
  }

  // ---- Administração (Fase 5): correções do gestor ----
  async editarViagem(id: string, dto: EditarViagemSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { supervisorRegistro: { select: { coordenadorId: true, departamentoId: true } } } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    await this.assertEscopoSupervisor(v.supervisorRegistro, user);
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
    const v = await this.prisma.viagem.findUnique({ where: { id }, include: { supervisorRegistro: { select: { coordenadorId: true, departamentoId: true } } } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    await this.assertEscopoSupervisor(v.supervisorRegistro, user);
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

  async editarDespesa(viagemId: string, despesaId: string, dto: EditarDespesaSupervisorDto, user: JwtPayload, recibo?: ReciboBinario) {
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
    // Troca do comprovante: sobe o novo e remove o antigo (best-effort).
    if (recibo) {
      if (d.comprovanteObjectKey) {
        try { await this.storage.remove(d.comprovanteObjectKey); } catch { /* órfão tolerável */ }
      }
      await this.anexarReciboDespesa(despesaId, filialId, recibo);
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

    // Adiantamento migrou p/ a tabela Adiantamento (mensal, por supervisor) no
    // redesenho 6b — v.adiantamento é OBSOLETO (fica nulo). Soma os adiantamentos
    // do supervisor no mês (como o rdvMensal); fallback = campo legado.
    let adiantamento = v.adiantamento != null ? Number(v.adiantamento) : 0;
    if (v.supervisorRegistroId && v.mesReferencia != null) {
      const advs = await this.prisma.adiantamento.findMany({
        where: { supervisorId: v.supervisorRegistroId, mesReferencia: v.mesReferencia, situacao: 'APROVADO' },
        select: { valor: true },
      });
      if (advs.length) adiantamento = advs.reduce((s, a) => s + Number(a.valor), 0);
    }
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

  /** Cadastro do supervisor de área LOGADO (auto-serviço) — resolve pela matrícula do
   *  login, na filial dele (mesmo lookup do criarViagemSupervisor). null se ainda não
   *  foi montado no time. Serve p/ o front fixar o "meu" supervisorId no Fechamento. */
  async meuCadastroSupervisor(user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const u = await this.matriculaDoUsuario(user.sub);
    if (!u?.matricula?.trim()) return null;
    const reg = await this.prisma.supervisor.findFirst({
      where: { filialId, matricula: u.matricula.trim().toUpperCase(), ativo: true },
      select: { id: true, nome: true, matricula: true, coordenadorId: true },
    });
    return reg ?? null;
  }

  // ---- Adiantamentos (mensais, vários por supervisor/mês) ----
  async lancarAdiantamento(dto: LancarAdiantamentoDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: dto.supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new BadRequestException('Supervisor inválido para esta filial.');
    await this.assertEscopoSupervisor(sup, user);
    if (dto.mesReferencia % 100 < 1 || dto.mesReferencia % 100 > 12) throw new BadRequestException('Mês de referência inválido (AAAAMM).');
    await this.assertRdvAberto(dto.supervisorId, dto.mesReferencia);
    // Auto-serviço do supervisor de área nasce PENDENTE (o coordenador aprova). O
    // lançamento do coordenador/departamento/admin já nasce APROVADO (são a autoridade).
    const ehAutoServico = this.roleLog(user) === 'SUPERVISOR';
    return this.prisma.adiantamento.create({
      data: {
        supervisorId: dto.supervisorId, mesReferencia: dto.mesReferencia,
        valor: new Prisma.Decimal(dto.valor), dataAdiantamento: this.parseData(dto.data),
        observacao: dto.observacao?.trim() || null, lancadoPorId: user.sub,
        situacao: ehAutoServico ? 'PENDENTE' : 'APROVADO',
        decididoPorId: ehAutoServico ? null : user.sub,
        decididoEm: ehAutoServico ? null : new Date(),
      },
    });
  }

  /** Coordenador / Supervisor de Departamento decide um adiantamento PENDENTE (lançado
   *  em auto-serviço pelo supervisor de área). O supervisionado NUNCA decide o próprio
   *  (assertPodeDecidir barra). Rejeitar exige motivo. Só mexe em mês aberto. */
  async decidirAdiantamento(id: string, decisao: 'APROVAR' | 'REJEITAR', motivo: string | undefined, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const a = await this.prisma.adiantamento.findUnique({ where: { id }, include: { supervisor: { select: { filialId: true, coordenadorId: true, departamentoId: true } } } });
    if (!a || a.supervisor.filialId !== filialId) throw new NotFoundException('Adiantamento não encontrado.');
    await this.assertPodeDecidir(a.supervisor, user);
    await this.assertRdvAberto(a.supervisorId, a.mesReferencia);
    if (a.situacao !== 'PENDENTE') throw new BadRequestException('Este adiantamento já foi decidido.');
    const aprovar = decisao === 'APROVAR';
    if (!aprovar && !motivo?.trim()) throw new BadRequestException('Informe o motivo da rejeição.');
    return this.prisma.adiantamento.update({
      where: { id },
      data: {
        situacao: aprovar ? 'APROVADO' : 'REJEITADO',
        decididoPorId: user.sub, decididoEm: new Date(),
        motivoRejeicao: aprovar ? null : motivo!.trim(),
      },
    });
  }
  async listarAdiantamentos(user: JwtPayload, supervisorId: string, mes: number) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new NotFoundException('Supervisor não encontrado.');
    await this.assertEscopoSupervisor(sup, user);
    return this.prisma.adiantamento.findMany({ where: { supervisorId, mesReferencia: mes }, orderBy: { dataAdiantamento: 'asc' } });
  }
  async removerAdiantamento(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const a = await this.prisma.adiantamento.findUnique({ where: { id }, include: { supervisor: { select: { filialId: true, coordenadorId: true, departamentoId: true, matricula: true } } } });
    if (!a || a.supervisor.filialId !== filialId) throw new NotFoundException('Adiantamento não encontrado.');
    await this.assertEscopoSupervisor(a.supervisor, user);
    await this.prisma.adiantamento.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Encerramento mensal do RDV (TEMA 2) ----
  async fecharRdv(supervisorId: string, mes: number, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new NotFoundException('Supervisor não encontrado.');
    await this.assertEscopoSupervisor(sup, user); // coordenador do supervisor ou gestor
    await this.prisma.fechamentoRdv.upsert({
      where: { supervisorId_mesReferencia: { supervisorId, mesReferencia: mes } },
      create: { supervisorId, mesReferencia: mes, fechadoPorId: user.sub },
      update: {},
    });
    return { fechado: true as const };
  }
  async reabrirRdv(supervisorId: string, mes: number, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new NotFoundException('Supervisor não encontrado.');
    await this.assertEscopoSupervisor(sup, user);
    await this.prisma.fechamentoRdv.deleteMany({ where: { supervisorId, mesReferencia: mes } });
    return { fechado: false as const };
  }

  /** RDV MENSAL: agrega TODOS os planejamentos do supervisor no mês (despesas
   *  aprovadas, dia × tipo) + os adiantamentos → saldo. */
  async rdvMensal(supervisorId: string, mes: number, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const sup = await this.prisma.supervisor.findUnique({ where: { id: supervisorId } });
    if (!sup || sup.filialId !== filialId) throw new NotFoundException('Supervisor não encontrado.');
    await this.assertEscopoSupervisor(sup, user);

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
    // Só APROVADO entra no saldo; PENDENTE fica à parte (aguardando o coordenador).
    const totalAdiantamento = adiantamentos.filter((a) => a.situacao === 'APROVADO').reduce((s, a) => s + Number(a.valor), 0);
    const totalAdiantamentoPendente = adiantamentos.filter((a) => a.situacao === 'PENDENTE').reduce((s, a) => s + Number(a.valor), 0);
    const saldo = totalAdiantamento - total; // >0 devolver à CAPUL; <0 reembolsar
    // TEMA 2: mês encerrado? (trava novos lançamentos até reabrir)
    const fech = await this.prisma.fechamentoRdv.findUnique({ where: { supervisorId_mesReferencia: { supervisorId, mesReferencia: mes } } });

    return {
      supervisor: { id: sup.id, matricula: sup.matricula, nome: sup.nome },
      mesReferencia: mes, planejamentos: planejamentos.length,
      tipos, dias, totaisPorTipo, totaisPorCategoria, total,
      adiantamentos, totalAdiantamento, totalAdiantamentoPendente, saldo,
      fechado: !!fech, fechadoEm: fech?.fechadoEm ?? null,
    };
  }

  /** Parseia data do formulário. Date-only ("YYYY-MM-DD") vira MEIO-DIA em SP p/
   *  não recuar 1 dia no fuso (UTC midnight → dia anterior no Brasil). */
  private parseData(s?: string): Date {
    if (!s) return new Date();
    return s.includes('T') ? new Date(s) : new Date(`${s}T12:00:00-03:00`);
  }

}
