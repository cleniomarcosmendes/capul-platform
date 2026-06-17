import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusDespesa, StatusViagem, TipoViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CofreStorageService } from '../cofre/cofre-storage.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { assertPodeOperarViagem } from '../common/frota-perms.js';
import {
  CriarTipoDespesaDto, AtualizarTipoDespesaDto, LancarDespesaDto,
  LancarDespesaViagemDto, ContestarDespesaDto, ListarDespesasQuery,
  CriarFornecedorDespesaDto, AtualizarFornecedorDespesaDto, AtualizarDespesaDto,
} from './dto.js';

const ehGestor = (role?: string) => role === 'GESTOR_FROTA' || role === 'ADMIN';

/** Recibo (foto/PDF do cupom) anexado no lançamento — binário p/ o object store. */
export type ReciboBinario = { buffer: Buffer; mimetype?: string; size: number };

/**
 * Despesas da frota (Fase 2) com governança em 3 níveis:
 *  - GESTOR_FROTA/ADMIN: qualquer veículo da filial; cadastra tipos; aprova/contesta.
 *  - Supervisor do veículo (veiculo.supervisorId === user.sub): só os SEUS veículos.
 *  - Motorista (matrícula+senha Protheus): lança despesa da viagem → PENDENTE.
 * Fora do escopo: rateio por departamento e integração financeira com Protheus.
 */
@Injectable()
export class DespesaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CofreStorageService,
  ) {}

  /**
   * Anexa o recibo (foto/PDF do cupom) a uma despesa recém-criada: sobe o binário
   * no object store e grava objectKey/hash/mime no registro. Degradável — se o
   * store estiver fora, a despesa permanece lançada (sem recibo) e o erro é
   * propagado p/ o controller decidir; aqui retorna a despesa atualizada.
   */
  private async anexarRecibo(despesaId: string, filialId: string, recibo: ReciboBinario) {
    const { objectKey, hash } = await this.storage.put(recibo.buffer, {
      filialId,
      refId: despesaId,
      mimeType: recibo.mimetype,
    });
    return this.prisma.despesaVeiculo.update({
      where: { id: despesaId },
      data: {
        comprovanteObjectKey: objectKey,
        comprovanteHash: hash,
        comprovanteMime: recibo.mimetype ?? null,
      },
    });
  }

  // ---------- Tipos de despesa ----------
  listarTipos(somenteAtivos?: boolean) {
    return this.prisma.tipoDespesa.findMany({
      where: somenteAtivos ? { ativo: true } : {},
      orderBy: { nome: 'asc' },
    });
  }

  async criarTipo(dto: CriarTipoDespesaDto) {
    const existe = await this.prisma.tipoDespesa.findUnique({ where: { nome: dto.nome.trim() } });
    if (existe) throw new BadRequestException('Já existe um tipo de despesa com esse nome.');
    return this.prisma.tipoDespesa.create({ data: { nome: dto.nome.trim(), descricao: dto.descricao?.trim() || null } });
  }

  async atualizarTipo(id: string, dto: AtualizarTipoDespesaDto) {
    const tipo = await this.prisma.tipoDespesa.findUnique({ where: { id } });
    if (!tipo) throw new NotFoundException('Tipo de despesa não encontrado.');
    return this.prisma.tipoDespesa.update({
      where: { id },
      data: {
        nome: dto.nome?.trim() ?? undefined,
        descricao: dto.descricao !== undefined ? (dto.descricao.trim() || null) : undefined,
        ativo: dto.ativo ?? undefined,
      },
    });
  }

  // ---- Fornecedores da despesa (cadastro próprio) ----
  listarFornecedores(somenteAtivos?: boolean) {
    return this.prisma.fornecedorDespesa.findMany({
      where: somenteAtivos ? { ativo: true } : {},
      orderBy: { nome: 'asc' },
    });
  }

  async criarFornecedor(dto: CriarFornecedorDespesaDto) {
    const nome = dto.nome.trim();
    const existe = await this.prisma.fornecedorDespesa.findUnique({ where: { nome } });
    if (existe) throw new BadRequestException('Já existe um fornecedor com esse nome.');
    return this.prisma.fornecedorDespesa.create({ data: { nome } });
  }

  async atualizarFornecedor(id: string, dto: AtualizarFornecedorDespesaDto) {
    const f = await this.prisma.fornecedorDespesa.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Fornecedor não encontrado.');
    return this.prisma.fornecedorDespesa.update({
      where: { id },
      data: { nome: dto.nome?.trim() ?? undefined, ativo: dto.ativo ?? undefined },
    });
  }

  // ---------- Governança ----------
  /** IDs dos veículos sob supervisão direta do usuário (na filial). */
  private async veiculosDoSupervisor(filialId: string, sub: string): Promise<string[]> {
    const vs = await this.prisma.veiculo.findMany({
      where: { filialId, supervisorId: sub }, select: { id: true },
    });
    return vs.map((v) => v.id);
  }

  /** Pode gerir (lançar direto/aprovar/contestar) despesa do veículo? */
  private async assertPodeGerirVeiculo(veiculoId: string, user: JwtPayload, role?: string) {
    const veiculo = await this.prisma.veiculo.findFirst({ where: { id: veiculoId, filialId: user.filialId } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado nesta filial.');
    if (!ehGestor(role) && veiculo.supervisorId !== user.sub) {
      throw new ForbiddenException('Apenas o gestor de frota ou o supervisor do veículo pode gerir esta despesa.');
    }
    return veiculo;
  }

  // ---------- Listagem ----------
  async listar(user: JwtPayload, role: string | undefined, q: ListarDespesasQuery) {
    const where: Prisma.DespesaVeiculoWhereInput = { filialId: user.filialId };

    if (!ehGestor(role)) {
      // Supervisor: só os veículos dele. Quem não é gestor nem supervisor não vê nada.
      const ids = await this.veiculosDoSupervisor(user.filialId!, user.sub);
      if (ids.length === 0) return [];
      where.veiculoId = { in: ids };
    }
    if (q.veiculoId) where.veiculoId = q.veiculoId;
    if (q.situacao && ['PENDENTE', 'APROVADA', 'CONTESTADA'].includes(q.situacao)) {
      where.situacao = q.situacao as StatusDespesa;
    }
    if (q.mes && q.ano) {
      const ini = new Date(Date.UTC(q.ano, q.mes - 1, 1));
      const fim = new Date(Date.UTC(q.ano, q.mes, 1));
      where.dataDespesa = { gte: ini, lt: fim };
    }

    const despesas = await this.prisma.despesaVeiculo.findMany({
      where,
      include: { veiculo: { select: { placa: true, modelo: true } }, tipoDespesa: { select: { nome: true } } },
      orderBy: { dataDespesa: 'desc' },
      take: 300,
    });
    return despesas.map((d) => ({
      id: d.id, situacao: d.situacao,
      veiculoId: d.veiculoId, placa: d.veiculo?.placa ?? '—', modelo: d.veiculo?.modelo ?? null,
      viagemId: d.viagemId,
      tipo: d.tipoDespesa?.nome ?? '—', tipoDespesaId: d.tipoDespesaId,
      valor: Number(d.valor), dataDespesa: d.dataDespesa, fornecedor: d.fornecedor,
      observacao: d.observacao, autorNome: d.autorNome, autorMatricula: d.autorMatricula,
      aprovadoEm: d.aprovadoEm, motivoContestacao: d.motivoContestacao,
      temComprovante: !!d.comprovanteObjectKey,
    }));
  }

  // ---------- Lançamento ----------
  /** Lançamento direto por supervisor/gestor → já APROVADA. */
  async lancarDireto(dto: LancarDespesaDto, user: JwtPayload, role?: string, recibo?: ReciboBinario) {
    const veiculo = await this.assertPodeGerirVeiculo(dto.veiculoId, user, role);
    const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
    if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');
    if (dto.viagemId) await this.assertViagemDoVeiculo(dto.viagemId, veiculo.id, user.filialId!);

    const despesa = await this.prisma.despesaVeiculo.create({
      data: {
        filialId: user.filialId!,
        veiculoId: veiculo.id,
        viagemId: dto.viagemId ?? null,
        tipoDespesaId: tipo.id,
        valor: new Prisma.Decimal(dto.valor),
        dataDespesa: dto.dataDespesa ? new Date(dto.dataDespesa) : new Date(),
        fornecedorId: dto.fornecedorId || null,
        fornecedor: dto.fornecedor?.trim() || null,
        observacao: dto.observacao?.trim() || null,
        situacao: StatusDespesa.APROVADA,
        criadoPorId: user.sub,
        aprovadoPorId: user.sub,
        aprovadoEm: new Date(),
      },
    });
    return recibo ? this.anexarRecibo(despesa.id, despesa.filialId, recibo) : despesa;
  }

  /**
   * Lançamento de despesa na viagem em curso → PENDENTE. A viagem já foi aberta
   * pelo condutor autenticado na saída (senha) — a despesa herda o condutor da
   * viagem, sem pedir senha de novo. Continua exigindo validação do supervisor.
   */
  async lancarNaViagem(dto: LancarDespesaViagemDto, user: JwtPayload, recibo?: ReciboBinario) {
    const v = await this.prisma.viagem.findUnique({
      where: { id: dto.viagemId },
      include: { veiculo: { select: { supervisorId: true } } },
    });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    if (v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    // Só registrante da saída / supervisor do veículo / gestão da frota podem lançar.
    assertPodeOperarViagem(user, v);
    if (v.situacao !== StatusViagem.EM_CURSO) throw new BadRequestException('Só dá pra lançar despesa em viagem em curso.');
    if (!v.veiculoId) throw new BadRequestException('Viagem sem veículo.');

    const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
    if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');

    const despesa = await this.prisma.despesaVeiculo.create({
      data: {
        filialId: v.filialId,
        veiculoId: v.veiculoId,
        viagemId: v.id,
        tipoDespesaId: tipo.id,
        valor: new Prisma.Decimal(dto.valor),
        dataDespesa: new Date(),
        fornecedorId: dto.fornecedorId || null,
        fornecedor: dto.fornecedor?.trim() || null,
        observacao: dto.observacao?.trim() || null,
        situacao: StatusDespesa.PENDENTE,
        autorMatricula: v.condutorMatricula,
        autorNome: v.condutorNome,
        criadoPorId: user.sub,
      },
    });
    return recibo ? this.anexarRecibo(despesa.id, despesa.filialId, recibo) : despesa;
  }

  private async assertViagemDoVeiculo(viagemId: string, veiculoId: string, filialId: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id: viagemId } });
    if (!v || v.filialId !== filialId) throw new NotFoundException('Viagem não encontrada nesta filial.');
    if (v.veiculoId && v.veiculoId !== veiculoId) throw new BadRequestException('A viagem não é do veículo informado.');
  }

  // ---------- Validação (governança) ----------
  private async despesaGerivel(id: string, user: JwtPayload, role?: string) {
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id } });
    if (!d || d.filialId !== user.filialId) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);
    if (d.situacao !== StatusDespesa.PENDENTE) throw new BadRequestException('A despesa não está pendente de validação.');
    return d;
  }

  async aprovar(id: string, user: JwtPayload, role?: string) {
    await this.despesaGerivel(id, user, role);
    return this.prisma.despesaVeiculo.update({
      where: { id },
      data: { situacao: StatusDespesa.APROVADA, aprovadoPorId: user.sub, aprovadoEm: new Date(), motivoContestacao: null },
    });
  }

  async contestar(id: string, dto: ContestarDespesaDto, user: JwtPayload, role?: string) {
    await this.despesaGerivel(id, user, role);
    return this.prisma.despesaVeiculo.update({
      where: { id },
      data: { situacao: StatusDespesa.CONTESTADA, aprovadoPorId: user.sub, aprovadoEm: new Date(), motivoContestacao: dto.motivo.trim() },
    });
  }

  /** Uma despesa (todos os dados) — escopo de gestão. Usado na tela de edição/detalhe. */
  async obter(id: string, user: JwtPayload, role?: string) {
    const d = await this.prisma.despesaVeiculo.findUnique({
      where: { id },
      include: {
        veiculo: { select: { placa: true, modelo: true } },
        tipoDespesa: { select: { nome: true } },
        viagem: { select: { numero: true, observacoesSaida: true, condutorNome: true } },
      },
    });
    if (!d || d.filialId !== user.filialId) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);
    return {
      id: d.id, situacao: d.situacao,
      veiculoId: d.veiculoId, placa: d.veiculo?.placa ?? '—', modelo: d.veiculo?.modelo ?? null,
      tipoDespesaId: d.tipoDespesaId, tipo: d.tipoDespesa?.nome ?? '—',
      valor: Number(d.valor), dataDespesa: d.dataDespesa,
      fornecedorId: d.fornecedorId, fornecedor: d.fornecedor, observacao: d.observacao,
      temComprovante: !!d.comprovanteObjectKey,
      // Contexto (read-only) p/ a tela mostrar "todas as informações".
      autorNome: d.autorNome, autorMatricula: d.autorMatricula,
      criadoEm: d.criadoEm, aprovadoEm: d.aprovadoEm, motivoContestacao: d.motivoContestacao,
      viagemId: d.viagemId,
      viagemNumero: d.viagem?.numero ?? null,
      viagemFinalidade: d.viagem?.observacoesSaida ?? null,
      viagemCondutor: d.viagem?.condutorNome ?? null,
    };
  }

  // ---------- Edição / exclusão (gestor de frota / supervisor do veículo) ----------
  /**
   * Edita uma despesa. Mesmo escopo de gestão (gestor de frota ou supervisor do
   * veículo). Não troca o veículo (manteria o escopo) nem mexe na situação —
   * é correção de valor/tipo/data/fornecedor/observação.
   */
  async atualizar(id: string, dto: AtualizarDespesaDto, user: JwtPayload, role?: string) {
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id } });
    if (!d || d.filialId !== user.filialId) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);

    if (dto.tipoDespesaId) {
      const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
      if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');
    }
    return this.prisma.despesaVeiculo.update({
      where: { id },
      data: {
        tipoDespesaId: dto.tipoDespesaId ?? undefined,
        valor: dto.valor !== undefined ? new Prisma.Decimal(dto.valor) : undefined,
        dataDespesa: dto.dataDespesa ? new Date(dto.dataDespesa) : undefined,
        // fornecedorId: string vazia limpa o vínculo; undefined não toca.
        fornecedorId: dto.fornecedorId !== undefined ? (dto.fornecedorId || null) : undefined,
        fornecedor: dto.fornecedor !== undefined ? (dto.fornecedor.trim() || null) : undefined,
        observacao: dto.observacao !== undefined ? (dto.observacao.trim() || null) : undefined,
      },
    });
  }

  /** Exclui uma despesa (e o recibo, best-effort). Mesmo escopo de gestão. */
  async excluir(id: string, user: JwtPayload, role?: string) {
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id } });
    if (!d || d.filialId !== user.filialId) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);
    await this.prisma.despesaVeiculo.delete({ where: { id } });
    if (d.comprovanteObjectKey) {
      try { await this.storage.remove(d.comprovanteObjectKey); } catch { /* objeto órfão é tolerável */ }
    }
    return { ok: true };
  }

  // ---------- Recibo (download) ----------
  /**
   * Lê o binário do recibo de uma despesa. Mesmo escopo da listagem: gestor de
   * frota (filial toda) ou supervisor do veículo; operador comum não vê.
   */
  async obterRecibo(id: string, user: JwtPayload, role?: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id } });
    if (!d || d.filialId !== user.filialId) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);
    if (!d.comprovanteObjectKey) throw new NotFoundException('Esta despesa não tem recibo anexado.');
    const buffer = await this.storage.get(d.comprovanteObjectKey);
    return { buffer, mimeType: d.comprovanteMime ?? 'application/octet-stream' };
  }

  // ---------- Indicadores (custo por veículo / tipo, mês) ----------
  async indicadores(user: JwtPayload, role: string | undefined, mes: number, ano: number) {
    const where: Prisma.DespesaVeiculoWhereInput = {
      filialId: user.filialId,
      situacao: StatusDespesa.APROVADA,
      dataDespesa: { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) },
    };
    if (!ehGestor(role)) {
      const ids = await this.veiculosDoSupervisor(user.filialId!, user.sub);
      if (ids.length === 0) return { total: 0, porVeiculo: [], porTipo: [] };
      where.veiculoId = { in: ids };
    }
    const despesas = await this.prisma.despesaVeiculo.findMany({
      where,
      include: { veiculo: { select: { placa: true } }, tipoDespesa: { select: { nome: true } } },
    });
    const total = despesas.reduce((s, d) => s + Number(d.valor), 0);
    const agrupa = (key: (d: (typeof despesas)[number]) => string) => {
      const m = new Map<string, number>();
      for (const d of despesas) m.set(key(d), (m.get(key(d)) ?? 0) + Number(d.valor));
      return [...m.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
    };
    return {
      total,
      porVeiculo: agrupa((d) => d.veiculo?.placa ?? '—'),
      porTipo: agrupa((d) => d.tipoDespesa?.nome ?? '—'),
    };
  }
}
