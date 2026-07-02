import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, StatusViagem, TipoViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusCondutorService } from '../protheus/protheus-condutor.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { filialDoUsuario } from '../common/filial-scope.js';
import { AdicionarVisitaDto, AtualizarAtividadeDto, AtualizarRegiaoDto, CriarAtividadeDto, CriarRegiaoDto, CriarViagemSupervisorDto, LancarDespesaSupervisorDto, MunicipioDto } from './dto.js';

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
  ) {}

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

  // ---- Regiões ----
  listarRegioes(user: JwtPayload, somenteAtivas?: boolean) {
    const filialId = filialDoUsuario(user);
    return this.prisma.regiao.findMany({
      where: { OR: [{ filialId }, { filialId: null }], ...(somenteAtivas ? { ativo: true } : {}) },
      orderBy: { nome: 'asc' },
      include: { municipios: { orderBy: { municipio: 'asc' } } },
    });
  }
  async criarRegiao(dto: CriarRegiaoDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const nome = dto.nome.trim();
    const ja = await this.prisma.regiao.findFirst({ where: { filialId, nome } });
    if (ja) throw new BadRequestException('Já existe uma região com esse nome.');
    return this.prisma.regiao.create({
      data: { nome, filialId, municipios: { create: this.normalizaMunicipios(dto.municipios) } },
      include: { municipios: { orderBy: { municipio: 'asc' } } },
    });
  }
  async atualizarRegiao(id: string, dto: AtualizarRegiaoDto, user: JwtPayload) {
    const r = await this.prisma.regiao.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Região não encontrada.');
    if (r.filialId && r.filialId !== user.filialId) throw new BadRequestException('Região de outra filial.');
    return this.prisma.$transaction(async (tx) => {
      // Se veio a lista de municípios, SUBSTITUI (replace) — a N:N é gerida pela região.
      if (dto.municipios) {
        await tx.regiaoMunicipio.deleteMany({ where: { regiaoId: id } });
        const ms = this.normalizaMunicipios(dto.municipios);
        if (ms.length) await tx.regiaoMunicipio.createMany({ data: ms.map((m) => ({ ...m, regiaoId: id })) });
      }
      return tx.regiao.update({
        where: { id },
        data: { nome: dto.nome?.trim() ?? undefined, ativo: dto.ativo ?? undefined },
        include: { municipios: { orderBy: { municipio: 'asc' } } },
      });
    });
  }

  // ---- Viagem mensal do supervisor (container da RDV) ----
  async criarViagemSupervisor(dto: CriarViagemSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const mm = dto.mesReferencia % 100;
    if (mm < 1 || mm > 12) throw new BadRequestException('Mês de referência inválido — use AAAAMM (ex.: 202605).');
    if (dto.regiaoId) {
      const r = await this.prisma.regiao.findUnique({ where: { id: dto.regiaoId } });
      if (!r || (r.filialId && r.filialId !== filialId)) throw new BadRequestException('Região inválida para esta filial.');
    }
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
          mesReferencia: dto.mesReferencia,
          adiantamento: dto.adiantamento != null ? new Prisma.Decimal(dto.adiantamento) : null,
          regiaoId: dto.regiaoId ?? null,
          veiculoId: dto.veiculoId ?? null,
          condutorMatricula: supMatricula,
          condutorNome: supNome,
          dataHoraSaida: new Date(),
          criadoPorId: user.sub,
        },
        include: { regiao: { select: { id: true, nome: true } } },
      });
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
        regiao: { select: { id: true, nome: true } },
        _count: { select: { paradas: true, despesas: true } },
      },
    });
  }

  async obterViagemSupervisor(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: {
        regiao: { include: { municipios: { orderBy: { municipio: 'asc' } } } },
        paradas: {
          orderBy: { sequencia: 'asc' },
          include: { atividade: { select: { nome: true } }, regiao: { select: { nome: true } } },
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
    if (dto.regiaoId) {
      const r = await this.prisma.regiao.findUnique({ where: { id: dto.regiaoId } });
      if (!r || (r.filialId && r.filialId !== filialId)) throw new BadRequestException('Região inválida para esta filial.');
    }
    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.parada.count({ where: { viagemId } })) + 1;
      return tx.parada.create({
        data: {
          viagemId,
          sequencia: seq,
          atividadeId: dto.atividadeId ?? null,
          regiaoId: dto.regiaoId ?? null,
          clienteMatricula: dto.clienteMatricula?.trim().toUpperCase() || null,
          clienteNome: dto.clienteNome?.trim() || null,
          municipio: dto.municipio?.trim() || null,
          propriedade: dto.propriedade?.trim() || null,
          local: dto.local?.trim() || null,
          observacao: dto.observacao?.trim() || null,
          dataHora: this.parseData(dto.dataVisita),
          status: 'REALIZADA',
        },
        include: { atividade: { select: { nome: true } }, regiao: { select: { nome: true } } },
      });
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
      data: { situacao: StatusViagem.CONCLUIDA, dataHoraChegada: new Date() },
      include: { regiao: { select: { id: true, nome: true } } },
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
        // Lançada pelo gestor na prestação de contas → já APROVADA.
        situacao: 'APROVADA',
        aprovadoEm: new Date(),
        aprovadoPorId: user.sub,
        criadoPorId: user.sub,
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
        regiao: { select: { nome: true } },
        despesas: { include: { tipoDespesa: { select: { id: true, nome: true, categoria: true } } } },
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
      regiao: v.regiao,
      tipos,
      dias,
      totaisPorTipo,
      totaisPorCategoria,
      total,
      adiantamento,
      saldo,
    };
  }

  /** Parseia data do formulário. Date-only ("YYYY-MM-DD") vira MEIO-DIA em SP p/
   *  não recuar 1 dia no fuso (UTC midnight → dia anterior no Brasil). */
  private parseData(s?: string): Date {
    if (!s) return new Date();
    return s.includes('T') ? new Date(s) : new Date(`${s}T12:00:00-03:00`);
  }

  /** Normaliza + dedup (por município, case-insensitive) a lista N:N. */
  private normalizaMunicipios(ms?: MunicipioDto[]) {
    const seen = new Set<string>();
    const out: { municipio: string; uf: string | null }[] = [];
    for (const m of ms ?? []) {
      const municipio = m.municipio.trim();
      if (!municipio) continue;
      const k = municipio.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ municipio, uf: m.uf?.trim().toUpperCase() || null });
    }
    return out;
  }
}
