import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusDespesa, StatusViagem, TipoViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CofreStorageService } from '../cofre/cofre-storage.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import { CondutorTokenService } from '../common/condutor-token.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import {
  CriarTipoDespesaDto, AtualizarTipoDespesaDto, LancarDespesaDto,
  LancarDespesaViagemDto, ContestarDespesaDto, ListarDespesasQuery,
  CriarFornecedorDespesaDto, AtualizarFornecedorDespesaDto, AtualizarDespesaDto,
  MarcarAnormalidadeDto, RatearDespesaDto,
} from './dto.js';

const ehGestor = (role?: string) => role === 'GESTOR_FROTA' || role === 'ADMIN';

/** Rótulos de finalidade do veículo (Análise da Frota). */
const FINALIDADE_LABEL: Record<string, string> = { ENTREGA: 'Entrega', PASSEIO: 'Passeio', SERVICO: 'Serviço' };

/** Filtros opcionais da Análise da Frota (estreitam o conjunto; total reconcilia). */
export interface FiltroAnalise {
  veiculoId?: string;
  tipoDespesaId?: string;
  departamentoId?: string;
  finalidade?: string;
  porte?: string;
  propriedade?: string;
  normalidade?: 'normal' | 'anormal';
}

/** Recibo (foto/PDF do cupom) anexado no lançamento — binário p/ o object store. */
export type ReciboBinario = { buffer: Buffer; mimetype?: string; size: number };
/** Máximo de comprovantes (foto/PDF) por despesa — padrão da plataforma. */
const MAX_ANEXOS_DESPESA = 5;

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
    private readonly core: CoreLookupService,
    private readonly condutorToken: CondutorTokenService,
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

  /** Anexa N comprovantes (foto/PDF) à despesa — até MAX_ANEXOS_DESPESA no total. Cada
   *  binário vai pro cofre; grava chave/hash/mime/ordem. Excedente é ignorado. */
  private async anexarComprovantes(despesaId: string, filialId: string, recibos: ReciboBinario[]) {
    if (!recibos.length) return;
    const jaTem = await this.prisma.anexoDespesa.count({ where: { despesaId } });
    const espaco = MAX_ANEXOS_DESPESA - jaTem;
    if (espaco <= 0) throw new BadRequestException(`Máximo de ${MAX_ANEXOS_DESPESA} comprovantes por despesa.`);
    let ordem = jaTem;
    for (const r of recibos.slice(0, espaco)) {
      const { objectKey, hash } = await this.storage.put(r.buffer, { filialId, refId: despesaId, mimeType: r.mimetype });
      await this.prisma.anexoDespesa.create({ data: { despesaId, objectKey, hash, mime: r.mimetype ?? null, tamanho: r.size, ordem: ordem++ } });
    }
  }

  /** Baixa um anexo específico da despesa (frota). Escopo: gestor (filial) ou supervisor
   *  do veículo — igual ao download do recibo legado. */
  async obterAnexo(despesaId: string, anexoId: string, user: JwtPayload, role?: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const a = await this.prisma.anexoDespesa.findUnique({ where: { id: anexoId } });
    if (!a || a.despesaId !== despesaId) throw new NotFoundException('Anexo não encontrado.');
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id: despesaId } });
    if (!d || (!ehGestor(role) && d.filialId !== user.filialId)) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);
    const buffer = await this.storage.get(a.objectKey);
    return { buffer, mimeType: a.mime ?? 'application/octet-stream' };
  }

  /** Remove um anexo da despesa (frota) — some do cofre + do banco. */
  async removerAnexo(despesaId: string, anexoId: string, user: JwtPayload, role?: string) {
    const a = await this.prisma.anexoDespesa.findUnique({ where: { id: anexoId } });
    if (!a || a.despesaId !== despesaId) throw new NotFoundException('Anexo não encontrado.');
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id: despesaId } });
    if (!d || (!ehGestor(role) && d.filialId !== user.filialId)) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);
    await this.storage.remove(a.objectKey).catch(() => undefined);
    await this.prisma.anexoDespesa.delete({ where: { id: anexoId } });
    return { ok: true };
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
    return this.prisma.tipoDespesa.create({
      data: {
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim() || null,
        requerAprovacao: dto.requerAprovacao ?? true,
        categoria: dto.categoria ?? 'VEICULO',
      },
    });
  }

  async atualizarTipo(id: string, dto: AtualizarTipoDespesaDto) {
    const tipo = await this.prisma.tipoDespesa.findUnique({ where: { id } });
    if (!tipo) throw new NotFoundException('Tipo de despesa não encontrado.');
    return this.prisma.tipoDespesa.update({
      where: { id },
      data: {
        nome: dto.nome?.trim() ?? undefined,
        descricao: dto.descricao !== undefined ? (dto.descricao.trim() || null) : undefined,
        requerAprovacao: dto.requerAprovacao ?? undefined,
        categoria: dto.categoria ?? undefined,
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

  /** Departamentos que o usuário supervisiona (encarregado de ≥1 veículo na filial). */
  private async deptosDoSupervisor(user: JwtPayload): Promise<string[]> {
    const rows = await this.prisma.veiculo.findMany({
      where: { filialId: user.filialId ?? undefined, supervisorId: user.sub },
      select: { departamentoLotacaoId: true }, distinct: ['departamentoLotacaoId'],
    });
    return rows.map((r) => r.departamentoLotacaoId);
  }

  /** IDs dos veículos no ESCOPO do usuário para custo/despesa. Supervisor de
   *  Departamento (SUPERVISOR_FROTA): todos os veículos do(s) seu(s) departamento(s).
   *  Demais não-gestores: só os que ele supervisiona diretamente. */
  private async veiculosNoEscopo(user: JwtPayload, role?: string): Promise<string[]> {
    if (role === 'SUPERVISOR_FROTA') {
      const deps = await this.deptosDoSupervisor(user);
      const vs = await this.prisma.veiculo.findMany({
        where: { filialId: user.filialId ?? undefined, departamentoLotacaoId: { in: deps } }, select: { id: true },
      });
      return vs.map((v) => v.id);
    }
    return this.veiculosDoSupervisor(user.filialId!, user.sub);
  }

  /** Pode gerir (lançar direto/aprovar/contestar) a despesa? Despesa de INDIVÍDUO
   *  (sem veículo) só o gestor/admin gere; despesa de veículo, gestor OU supervisor. */
  private async assertPodeGerirVeiculo(veiculoId: string | null, user: JwtPayload, role?: string) {
    if (!veiculoId) {
      if (!ehGestor(role)) {
        throw new ForbiddenException('Apenas o gestor de frota pode gerir despesa de indivíduo.');
      }
      return null;
    }
    // GESTOR_FROTA/ADMIN administram a frota da empresa toda → alcançam o veículo
    // em QUALQUER filial (frota compartilhável); a despesa mora na filial do veículo.
    // Supervisor: só a própria filial (e só o veículo sob sua supervisão).
    const veiculo = ehGestor(role)
      ? await this.prisma.veiculo.findFirst({ where: { id: veiculoId } })
      : await this.prisma.veiculo.findFirst({ where: { id: veiculoId, filialId: user.filialId } });
    if (!veiculo) throw new NotFoundException(ehGestor(role) ? 'Veículo não encontrado.' : 'Veículo não encontrado nesta filial.');
    // Supervisor de Departamento gere as despesas dos veículos do(s) seu(s) departamento(s).
    const podeDepto = role === 'SUPERVISOR_FROTA' && (await this.deptosDoSupervisor(user)).includes(veiculo.departamentoLotacaoId);
    if (!ehGestor(role) && veiculo.supervisorId !== user.sub && !podeDepto) {
      throw new ForbiddenException('Apenas o gestor de frota, o supervisor do veículo ou o supervisor do departamento pode gerir esta despesa.');
    }
    return veiculo;
  }

  // ---------- Listagem ----------
  async listar(user: JwtPayload, role: string | undefined, q: ListarDespesasQuery) {
    // Gestor de frota/ADMIN veem a frota da empresa toda (cross-filial); supervisor
    // fica na própria filial e só nos veículos sob sua supervisão.
    const where: Prisma.DespesaVeiculoWhereInput = ehGestor(role) ? {} : { filialId: user.filialId };

    if (!ehGestor(role)) {
      // Supervisor: só os veículos do seu escopo. Quem não é gestor nem supervisor não vê nada.
      const ids = await this.veiculosNoEscopo(user, role);
      if (ids.length === 0) return [];
      // O filtro ?veiculoId RESPEITA o escopo: pedir um veículo de fora não vaza.
      if (q.veiculoId) {
        if (!ids.includes(q.veiculoId)) return [];
        where.veiculoId = q.veiculoId;
      } else {
        where.veiculoId = { in: ids };
      }
    } else if (q.veiculoId) {
      where.veiculoId = q.veiculoId;
    }
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
      include: { veiculo: { select: { placa: true, modelo: true } }, tipoDespesa: { select: { nome: true } }, anexos: { select: { id: true, mime: true }, orderBy: { ordem: 'asc' } } },
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
      anormalidade: d.anormalidade, motivoAnormalidade: d.motivoAnormalidade,
      numeroDocumento: d.numeroDocumento, semNota: d.semNota,
      temComprovante: !!d.comprovanteObjectKey, anexos: d.anexos,
    }));
  }

  // ---------- Nota fiscal / documento ----------
  /** Normaliza documento + semNota: sem-nota força documento nulo. */
  private normalizaDoc(dto: { numeroDocumento?: string; semNota?: boolean }): { numeroDocumento: string | null; semNota: boolean } {
    if (dto.semNota) return { numeroDocumento: null, semNota: true };
    return { numeroDocumento: dto.numeroDocumento?.trim() || null, semNota: false };
  }

  /**
   * Bloqueia duplicidade: a mesma nota não pode repetir no veículo no MESMO tipo
   * (rateio = tipos distintos é permitido). Sem documento → sem checagem.
   */
  private async assertDocumentoUnico(filialId: string, veiculoId: string, numeroDocumento: string | null, tipoDespesaId: string, exceptId?: string) {
    if (!numeroDocumento) return;
    const ja = await this.prisma.despesaVeiculo.findFirst({
      where: { filialId, veiculoId, numeroDocumento, tipoDespesaId, id: exceptId ? { not: exceptId } : undefined },
      include: { tipoDespesa: { select: { nome: true } } },
    });
    if (ja) {
      throw new BadRequestException(`A nota ${numeroDocumento} já foi lançada para este veículo no tipo "${ja.tipoDespesa?.nome ?? '—'}".`);
    }
  }

  // ---------- Lançamento ----------
  /** Lançamento direto por supervisor/gestor → já APROVADA. */
  async lancarDireto(dto: LancarDespesaDto, user: JwtPayload, role?: string, recibos?: ReciboBinario[]) {
    const veiculo = await this.assertPodeGerirVeiculo(dto.veiculoId, user, role);
    // Lançamento direto é sempre por veículo (INDIVÍDUO entra pela viagem).
    if (!veiculo) throw new BadRequestException('Informe o veículo da despesa.');
    const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
    if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');
    if (dto.viagemId) await this.assertViagemDoVeiculo(dto.viagemId, veiculo.id, veiculo.filialId);

    const { numeroDocumento, semNota } = this.normalizaDoc(dto);
    await this.assertDocumentoUnico(veiculo.filialId, veiculo.id, numeroDocumento, tipo.id);

    const despesa = await this.prisma.despesaVeiculo.create({
      data: {
        filialId: veiculo.filialId,
        veiculoId: veiculo.id,
        viagemId: dto.viagemId ?? null,
        tipoDespesaId: tipo.id,
        valor: new Prisma.Decimal(dto.valor),
        dataDespesa: dto.dataDespesa ? new Date(dto.dataDespesa) : new Date(),
        fornecedorId: dto.fornecedorId || null,
        fornecedor: dto.fornecedor?.trim() || null,
        observacao: dto.observacao?.trim() || null,
        numeroDocumento,
        semNota,
        situacao: StatusDespesa.APROVADA,
        criadoPorId: user.sub,
        aprovadoPorId: user.sub,
        aprovadoEm: new Date(),
      },
    });
    if (recibos?.length) await this.anexarComprovantes(despesa.id, despesa.filialId, recibos);
    return despesa;
  }

  /**
   * Lançamento de despesa na viagem em curso → PENDENTE. Login PADRÃO carrega o
   * token de condutor (gate ao abrir a viagem); INDIVIDUAL herda o próprio login.
   * Continua exigindo validação do supervisor.
   */
  async lancarNaViagem(dto: LancarDespesaViagemDto, user: JwtPayload, recibos?: ReciboBinario[], condutorToken?: string) {
    const v = await this.prisma.viagem.findUnique({
      where: { id: dto.viagemId },
      include: { veiculo: { select: { supervisorId: true } } },
    });
    if (!v || v.tipo !== TipoViagem.FROTA) throw new NotFoundException('Viagem de frota não encontrada.');
    if (v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    // PADRÃO usa o token de condutor (do gate ao abrir a viagem); INDIVIDUAL mantém
    // registrante/supervisor/gestão. Regra única em CondutorTokenService.assertOpera.
    this.condutorToken.assertOpera(user, v, condutorToken);
    // Despesa é lançada durante a viagem OU no acerto (depois de entregar o veículo).
    // Trava só quando o ACERTO é encerrado — não na conclusão da viagem.
    if (v.situacao === StatusViagem.CANCELADA) throw new BadRequestException('Viagem cancelada — não aceita despesas.');
    if (v.acertoEncerradoEm) throw new BadRequestException('Acerto encerrado — reabra o acerto para lançar despesa.');

    const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
    if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');

    // Despesa de VEÍCULO usa o veículo da viagem; de INDIVÍDUO (alimentação etc.)
    // não tem veículo — entra só na RDV, fora dos relatórios por veículo.
    const ehIndividuo = tipo.categoria === 'INDIVIDUO';
    if (!ehIndividuo && !v.veiculoId) throw new BadRequestException('Viagem sem veículo.');
    const veiculoIdDespesa = ehIndividuo ? null : v.veiculoId;

    // Idempotência (fila offline): se já chegou com essa chave, devolve a existente.
    if (dto.idempotencyKey) {
      const ja = await this.prisma.despesaVeiculo.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (ja) return ja;
    }

    const { numeroDocumento, semNota } = this.normalizaDoc(dto);
    // Dedup por documento é por (veículo, doc, tipo) — só faz sentido com veículo.
    if (veiculoIdDespesa) await this.assertDocumentoUnico(v.filialId, veiculoIdDespesa, numeroDocumento, tipo.id);

    // Tipo sem exigência de aprovação (ex.: Abastecimento) entra direto APROVADA;
    // os demais nascem PENDENTE e aguardam o supervisor/gestor.
    const autoAprova = !tipo.requerAprovacao;
    const despesa = await this.prisma.despesaVeiculo.create({
      data: {
        filialId: v.filialId,
        veiculoId: veiculoIdDespesa,
        viagemId: v.id,
        tipoDespesaId: tipo.id,
        valor: new Prisma.Decimal(dto.valor),
        dataDespesa: new Date(),
        fornecedorId: dto.fornecedorId || null,
        fornecedor: dto.fornecedor?.trim() || null,
        observacao: dto.observacao?.trim() || null,
        numeroDocumento,
        semNota,
        situacao: autoAprova ? StatusDespesa.APROVADA : StatusDespesa.PENDENTE,
        aprovadoEm: autoAprova ? new Date() : null, // auto-aprovada: sem aprovadoPorId (não houve revisor)
        autorMatricula: v.condutorMatricula,
        autorNome: v.condutorNome,
        criadoPorId: user.sub,
        idempotencyKey: dto.idempotencyKey ?? null,
      },
    });
    if (recibos?.length) await this.anexarComprovantes(despesa.id, despesa.filialId, recibos);
    return despesa;
  }

  /**
   * Rateio de uma nota: 1 documento → vários TIPOS no mesmo veículo. Cada item
   * vira uma despesa (mesmo veículo/nota, tipo distinto), já APROVADA (lançamento
   * direto do supervisor/gestor). Tudo em transação — ou grava tudo, ou nada.
   */
  async ratear(dto: RatearDespesaDto, user: JwtPayload, role?: string, recibos?: ReciboBinario[]) {
    const veiculo = await this.assertPodeGerirVeiculo(dto.veiculoId, user, role);
    // Rateio de nota é sempre por veículo (INDIVÍDUO entra pela viagem).
    if (!veiculo) throw new BadRequestException('Informe o veículo da despesa.');
    if (dto.viagemId) await this.assertViagemDoVeiculo(dto.viagemId, veiculo.id, veiculo.filialId);
    if (!dto.itens?.length) throw new BadRequestException('Adicione ao menos um tipo de despesa ao rateio.');

    const numeroDocumento = dto.numeroDocumento.trim();
    if (!numeroDocumento) throw new BadRequestException('Informe o número da nota/documento do rateio.');

    // Tipos distintos dentro do rateio (a chave é veículo+nota+tipo).
    const tipoIds = dto.itens.map((i) => i.tipoDespesaId);
    if (new Set(tipoIds).size !== tipoIds.length) {
      throw new BadRequestException('Cada tipo de despesa só pode aparecer uma vez no rateio.');
    }
    // Tipos válidos/ativos.
    const tipos = await this.prisma.tipoDespesa.findMany({ where: { id: { in: tipoIds }, ativo: true } });
    if (tipos.length !== tipoIds.length) throw new BadRequestException('Há tipo de despesa inválido ou inativo no rateio.');
    // Duplicidade contra o que já existe (cada tipo).
    for (const it of dto.itens) {
      await this.assertDocumentoUnico(veiculo.filialId, veiculo.id, numeroDocumento, it.tipoDespesaId);
    }

    const dataDespesa = dto.dataDespesa ? new Date(dto.dataDespesa) : new Date();
    const agora = new Date();
    const criadas = await this.prisma.$transaction(
      dto.itens.map((it) => this.prisma.despesaVeiculo.create({
        data: {
          filialId: veiculo.filialId,
          veiculoId: veiculo.id,
          viagemId: dto.viagemId ?? null,
          tipoDespesaId: it.tipoDespesaId,
          valor: new Prisma.Decimal(it.valor),
          dataDespesa,
          fornecedorId: dto.fornecedorId || null,
          fornecedor: dto.fornecedor?.trim() || null,
          observacao: dto.observacao?.trim() || null,
          numeroDocumento,
          semNota: false,
          situacao: StatusDespesa.APROVADA,
          criadoPorId: user.sub,
          aprovadoPorId: user.sub,
          aprovadoEm: agora,
        },
      })),
    );
    // Recibo(s) (a foto da nota) — anexa em cada linha do rateio para abrir de qualquer uma.
    if (recibos?.length) {
      for (const d of criadas) {
        try { await this.anexarComprovantes(d.id, d.filialId, recibos); } catch { /* recibo é best-effort */ }
      }
    }
    return { ok: true, criadas: criadas.length };
  }

  private async assertViagemDoVeiculo(viagemId: string, veiculoId: string, filialId: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id: viagemId } });
    if (!v || v.filialId !== filialId) throw new NotFoundException('Viagem não encontrada nesta filial.');
    if (v.veiculoId && v.veiculoId !== veiculoId) throw new BadRequestException('A viagem não é do veículo informado.');
  }

  // ---------- Validação (governança) ----------
  private async despesaGerivel(id: string, user: JwtPayload, role?: string) {
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id } });
    if (!d || (!ehGestor(role) && d.filialId !== user.filialId)) throw new NotFoundException('Despesa não encontrada nesta filial.');
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

  /**
   * Marca/desmarca a despesa como ANORMALIDADE (mau uso). Só o GESTOR da frota
   * (ou ADMIN) decide isso — é um juízo de gestão, não do supervisor. Aplica-se
   * em qualquer situação (é uma classificação, não muda o status).
   */
  async marcarAnormalidade(id: string, dto: MarcarAnormalidadeDto, user: JwtPayload, role?: string) {
    if (!ehGestor(role)) throw new ForbiddenException('Apenas o gestor da frota pode sinalizar anormalidade (mau uso).');
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id } });
    if (!d || (!ehGestor(role) && d.filialId !== user.filialId)) throw new NotFoundException('Despesa não encontrada nesta filial.');
    return this.prisma.despesaVeiculo.update({
      where: { id },
      data: {
        anormalidade: dto.anormalidade,
        motivoAnormalidade: dto.anormalidade ? (dto.motivo?.trim() || null) : null,
      },
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
        anexos: { select: { id: true, mime: true }, orderBy: { ordem: 'asc' } },
      },
    });
    if (!d || (!ehGestor(role) && d.filialId !== user.filialId)) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);
    return {
      id: d.id, situacao: d.situacao,
      veiculoId: d.veiculoId, placa: d.veiculo?.placa ?? '—', modelo: d.veiculo?.modelo ?? null,
      tipoDespesaId: d.tipoDespesaId, tipo: d.tipoDespesa?.nome ?? '—',
      valor: Number(d.valor), dataDespesa: d.dataDespesa,
      fornecedorId: d.fornecedorId, fornecedor: d.fornecedor, observacao: d.observacao,
      anormalidade: d.anormalidade, motivoAnormalidade: d.motivoAnormalidade,
      numeroDocumento: d.numeroDocumento, semNota: d.semNota,
      temComprovante: !!d.comprovanteObjectKey, anexos: d.anexos,
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
    if (!d || (!ehGestor(role) && d.filialId !== user.filialId)) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);

    if (dto.tipoDespesaId) {
      const tipo = await this.prisma.tipoDespesa.findFirst({ where: { id: dto.tipoDespesaId, ativo: true } });
      if (!tipo) throw new BadRequestException('Tipo de despesa inválido ou inativo.');
    }

    // Documento/semNota: se algum dos dois veio no DTO, recalcula; senão, mantém.
    const mexeuDoc = dto.numeroDocumento !== undefined || dto.semNota !== undefined;
    let numeroDocumento: string | null | undefined = undefined;
    let semNota: boolean | undefined = undefined;
    if (mexeuDoc) {
      const norm = this.normalizaDoc({ numeroDocumento: dto.numeroDocumento ?? d.numeroDocumento ?? undefined, semNota: dto.semNota ?? d.semNota });
      numeroDocumento = norm.numeroDocumento;
      semNota = norm.semNota;
      // Dedup por documento é por (veículo, doc, tipo) — só quando há veículo.
      if (d.veiculoId) await this.assertDocumentoUnico(d.filialId, d.veiculoId, numeroDocumento, dto.tipoDespesaId ?? d.tipoDespesaId, id);
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
        numeroDocumento,
        semNota,
      },
    });
  }

  /** Exclui uma despesa (e o recibo, best-effort). Mesmo escopo de gestão. */
  async excluir(id: string, user: JwtPayload, role?: string) {
    const d = await this.prisma.despesaVeiculo.findUnique({ where: { id } });
    if (!d || (!ehGestor(role) && d.filialId !== user.filialId)) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);
    // Anexos: o cascade apaga as LINHAS; os binários no cofre saem aqui (antes do delete).
    const anexos = await this.prisma.anexoDespesa.findMany({ where: { despesaId: id }, select: { objectKey: true } });
    await this.prisma.despesaVeiculo.delete({ where: { id } });
    for (const key of [d.comprovanteObjectKey, ...anexos.map((a) => a.objectKey)]) {
      if (key) { try { await this.storage.remove(key); } catch { /* objeto órfão é tolerável */ } }
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
    if (!d || (!ehGestor(role) && d.filialId !== user.filialId)) throw new NotFoundException('Despesa não encontrada nesta filial.');
    await this.assertPodeGerirVeiculo(d.veiculoId, user, role);
    if (!d.comprovanteObjectKey) throw new NotFoundException('Esta despesa não tem recibo anexado.');
    const buffer = await this.storage.get(d.comprovanteObjectKey);
    return { buffer, mimeType: d.comprovanteMime ?? 'application/octet-stream' };
  }

  // ---------- Indicadores (custo por veículo / tipo, mês) ----------
  async indicadores(user: JwtPayload, role: string | undefined, mes: number, ano: number) {
    const where: Prisma.DespesaVeiculoWhereInput = {
      filialId: ehGestor(role) ? undefined : user.filialId,
      situacao: StatusDespesa.APROVADA,
      // Análise da FROTA = custo por veículo → despesa de INDIVÍDUO (sem veículo)
      // fica FORA "de graça"; ela entra só na RDV do supervisor (Fase 3).
      veiculoId: { not: null },
      dataDespesa: { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) },
    };
    if (!ehGestor(role)) {
      const ids = await this.veiculosNoEscopo(user, role);
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

  // ---------- Análise (manchete + grupos + drill-down) ----------
  /** Despesas APROVADAS do mês (escopo de gestão) com tudo p/ agrupar/detalhar. */
  private async despesasDoMes(user: JwtPayload, role: string | undefined, mes: number, ano: number, filtro?: FiltroAnalise) {
    const where: Prisma.DespesaVeiculoWhereInput = {
      filialId: ehGestor(role) ? undefined : user.filialId,
      situacao: StatusDespesa.APROVADA,
      // Análise da FROTA = custo por veículo → despesa de INDIVÍDUO (sem veículo)
      // fica FORA "de graça"; ela entra só na RDV do supervisor (Fase 3).
      veiculoId: { not: null },
      dataDespesa: { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) },
    };

    // Filtros diretos / por relação (estreitam o conjunto antes do agrupamento).
    if (filtro?.tipoDespesaId) where.tipoDespesaId = filtro.tipoDespesaId;
    if (filtro?.normalidade) where.anormalidade = filtro.normalidade === 'anormal';
    if (filtro?.departamentoId) where.viagem = { departamentoSolicitanteId: filtro.departamentoId };
    const veicCond: Prisma.VeiculoWhereInput = {};
    if (filtro?.finalidade) veicCond.finalidade = filtro.finalidade as Prisma.VeiculoWhereInput['finalidade'];
    if (filtro?.porte) veicCond.porte = filtro.porte as Prisma.VeiculoWhereInput['porte'];
    if (filtro?.propriedade) veicCond.propriedade = filtro.propriedade as Prisma.VeiculoWhereInput['propriedade'];
    if (Object.keys(veicCond).length) where.veiculo = veicCond;

    // Escopo de veículo: supervisor (RBAC) ∩ filtro de veículo específico.
    let allowed: string[] | null = null;
    if (!ehGestor(role)) {
      allowed = await this.veiculosNoEscopo(user, role);
      if (allowed.length === 0) return [];
    }
    if (filtro?.veiculoId) {
      if (allowed && !allowed.includes(filtro.veiculoId)) return [];
      where.veiculoId = filtro.veiculoId;
    } else if (allowed) {
      where.veiculoId = { in: allowed };
    }

    return this.prisma.despesaVeiculo.findMany({
      where,
      include: {
        veiculo: { select: { placa: true, modelo: true, propriedade: true, porte: true, finalidade: true } },
        tipoDespesa: { select: { nome: true } },
        fornecedorRef: { select: { nome: true } },
        viagem: { select: { departamentoSolicitanteId: true } },
      },
      orderBy: { dataDespesa: 'desc' },
    });
  }

  // Chave/rótulo de cada despesa por dimensão (usados no agrupamento e no drill).
  private chaveDim(d: { veiculoId: string | null; tipoDespesaId: string; fornecedorId: string | null; fornecedor: string | null; anormalidade?: boolean; viagem?: { departamentoSolicitanteId: string | null } | null; veiculo?: { propriedade?: string | null; porte?: string | null; finalidade?: string | null } | null }, dim: string): string {
    switch (dim) {
      case 'veiculo': return d.veiculoId ?? '__sem';
      case 'tipo': return d.tipoDespesaId;
      case 'fornecedor': return d.fornecedorId ?? (d.fornecedor ? `livre:${d.fornecedor}` : '__sem');
      case 'departamento': return d.viagem?.departamentoSolicitanteId ?? '__sem';
      case 'propriedade': return d.veiculo?.propriedade ?? '__sem';
      case 'porte': return d.veiculo?.porte ?? '__sem';
      case 'finalidade': return d.veiculo?.finalidade ?? '__sem';
      case 'normalidade': return d.anormalidade ? 'anormal' : 'normal';
      default: return '__sem';
    }
  }

  async indicadoresAnalitico(user: JwtPayload, role: string | undefined, mes: number, ano: number, filtro?: FiltroAnalise) {
    const despesas = await this.despesasDoMes(user, role, mes, ano, filtro);
    const total = despesas.reduce((s, d) => s + Number(d.valor), 0);
    // Manchete secundária: quanto do custo é anormalidade (mau uso).
    const anormais = despesas.filter((d) => d.anormalidade);
    const anormal = { valor: anormais.reduce((s, d) => s + Number(d.valor), 0), qtd: anormais.length };

    // Resolve nomes de departamento (uma vez) p/ os rótulos do grupo.
    const deptoIds = [...new Set(despesas.map((d) => d.viagem?.departamentoSolicitanteId).filter(Boolean) as string[])];
    const nomesDepto = deptoIds.length ? await this.core.nomesDepartamentos(deptoIds) : new Map<string, string>();

    const agrupar = (dim: string, rotulo: (d: (typeof despesas)[number]) => string) => {
      const m = new Map<string, { label: string; valor: number; qtd: number }>();
      for (const d of despesas) {
        const id = this.chaveDim(d, dim);
        const cur = m.get(id) ?? { label: rotulo(d), valor: 0, qtd: 0 };
        cur.valor += Number(d.valor); cur.qtd += 1;
        m.set(id, cur);
      }
      return [...m.entries()].map(([id, g]) => ({ id, ...g })).sort((a, b) => b.valor - a.valor);
    };

    return {
      total,
      anormal,
      porVeiculo: agrupar('veiculo', (d) => d.veiculo?.placa ? `${d.veiculo.placa}${d.veiculo.modelo ? ` · ${d.veiculo.modelo}` : ''}` : '—'),
      porTipo: agrupar('tipo', (d) => d.tipoDespesa?.nome ?? '—'),
      porFornecedor: agrupar('fornecedor', (d) => d.fornecedorRef?.nome ?? d.fornecedor ?? 'NÃO DEFINIDO'),
      porDepartamento: agrupar('departamento', (d) => (d.viagem?.departamentoSolicitanteId ? (nomesDepto.get(d.viagem.departamentoSolicitanteId) ?? 'Departamento') : 'Sem departamento')),
      porPropriedade: agrupar('propriedade', (d) => (d.veiculo?.propriedade === 'ALUGADO' ? 'Alugado' : d.veiculo?.propriedade === 'PROPRIO' ? 'Próprio' : 'Não informado')),
      porPorte: agrupar('porte', (d) => (d.veiculo?.porte === 'PESADO' ? 'Pesado' : d.veiculo?.porte === 'LEVE' ? 'Leve' : 'Não informado')),
      porFinalidade: agrupar('finalidade', (d) => (FINALIDADE_LABEL[d.veiculo?.finalidade ?? ''] ?? 'Não informado')),
      porNormalidade: agrupar('normalidade', (d) => (d.anormalidade ? 'Anormalidade (mau uso)' : 'Normal')),
    };
  }

  /** Documentos (despesas) que compõem um grupo da Análise — drill-down. */
  async indicadoresDocumentos(user: JwtPayload, role: string | undefined, mes: number, ano: number, dimensao: string, chave: string, filtro?: FiltroAnalise) {
    const despesas = await this.despesasDoMes(user, role, mes, ano, filtro);
    return despesas
      .filter((d) => this.chaveDim(d, dimensao) === chave)
      .map((d) => ({
        id: d.id,
        principal: d.tipoDespesa?.nome ?? '—',
        secundario: `${d.veiculo?.placa ?? '—'}${d.fornecedorRef?.nome || d.fornecedor ? ` · ${d.fornecedorRef?.nome ?? d.fornecedor}` : ''}`,
        terciario: d.observacao ?? undefined,
        data: d.dataDespesa,
        valor: Number(d.valor),
      }));
  }
}
