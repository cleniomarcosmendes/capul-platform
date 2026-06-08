import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SituacaoVeiculo, StatusEntrega, StatusViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import { CofreService } from '../cofre/cofre.service.js';
import { assertPodeVerRegistro } from '../common/filial-scope.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { BaixarEntregaDto, CreateEntregaDto } from './dto.js';

const onlyDigits = (s?: string | null) => (s ?? '').replace(/\D/g, '');

/** Estados terminais de baixa — entrega já resolvida no campo. */
const TERMINAIS: StatusEntrega[] = [StatusEntrega.ENTREGUE, StatusEntrega.NAO_ENTREGUE];

export interface ProvaBinaria {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class EntregaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreLookupService,
    private readonly cofre: CofreService,
  ) {}

  /**
   * Cria a entrega. Atômico: incrementa o contador por filial (nº tipo talão),
   * congela o snapshot do endereço (autoritativo quando vem de um
   * EnderecoEntrega) e grava os cupons. Status inicial PENDENTE.
   */
  async create(dto: CreateEntregaDto, criadoPorId: string) {
    await this.core.validarFilial(dto.filialId);
    const snap = await this.resolverSnapshotEndereco(dto);

    const cupons = (dto.cupons ?? []).filter((c) => c.numeroCupom || c.valor != null);

    const entrega = await this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSequencial.upsert({
        where: { filialId_escopo: { filialId: dto.filialId, escopo: 'ENTREGA' } },
        create: { filialId: dto.filialId, escopo: 'ENTREGA', ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });

      return tx.entrega.create({
        data: {
          numero: contador.ultimoNumero,
          filialId: dto.filialId,
          tipoCliente: dto.tipoCliente,
          matricula: dto.matricula?.trim() || null,
          clienteLocalId: dto.clienteLocalId || null,
          destinatarioNome: dto.destinatarioNome.trim(),
          telefone: dto.telefone ? onlyDigits(dto.telefone) : null,
          enderecoEntregaId: dto.enderecoEntregaId || null,
          ...snap,
          horario: dto.horario?.trim() || null,
          observacoes: dto.observacoes?.trim() || null,
          quantidadeVolumes: dto.quantidadeVolumes,
          status: StatusEntrega.PENDENTE,
          criadoPorId,
          cupons: {
            create: cupons.map((c) => ({
              numeroCupom: c.numeroCupom?.trim() || null,
              valor: c.valor != null ? new Prisma.Decimal(c.valor) : null,
            })),
          },
        },
        include: { cupons: true },
      });
    });

    // Persiste o endereço como reutilizável (cliente identificado/recorrente),
    // pra aparecer no seletor da próxima entrega. Best-effort (não derruba a
    // entrega se falhar). EVENTUAL (sem matrícula/cliente) não persiste.
    await this.persistirEnderecoReutilizavel(dto, snap).catch(() => {});

    return this.comTotal(entrega);
  }

  /** Normaliza endereço pra dedupe (APTO/AP + sem pontuação/espaços). */
  private chaveEndereco(logradouro?: string | null, cidade?: string | null) {
    return `${logradouro ?? ''} ${cidade ?? ''}`.toUpperCase().replace(/APARTAMENTO|APTO/g, 'AP').replace(/[^A-Z0-9]/g, '');
  }

  private async persistirEnderecoReutilizavel(
    dto: CreateEntregaDto,
    snap: { endLogradouro: string; endNumero: string | null; endComplemento: string | null; endBairro: string | null; endCidade: string | null; endUf: string | null; endCep: string | null; endReferencia: string | null },
  ) {
    if (dto.enderecoEntregaId) return; // veio de um endereço já salvo
    const matricula = dto.matricula?.trim() || null;
    const clienteLocalId = dto.clienteLocalId || null;
    if (!matricula && !clienteLocalId) return; // eventual — não cadastra
    if (!snap.endLogradouro) return;

    const dono = matricula ? { matricula } : { clienteLocalId };
    // Dedup escopado por filial: o mesmo endereço noutra filial é registro à parte.
    const existentes = await this.prisma.enderecoEntrega.findMany({
      where: { ativo: true, filialId: dto.filialId, ...dono },
      select: { logradouro: true, cidade: true },
    });
    const chave = this.chaveEndereco(snap.endLogradouro, snap.endCidade);
    if (existentes.some((e) => this.chaveEndereco(e.logradouro, e.cidade) === chave)) return; // já existe

    await this.prisma.enderecoEntrega.create({
      data: {
        filialId: dto.filialId,
        ...dono,
        // Telefone DESTE endereço (contato que o entregador liga ao chegar).
        telefone: dto.telefone ? onlyDigits(dto.telefone) : null,
        logradouro: snap.endLogradouro,
        numero: snap.endNumero,
        complemento: snap.endComplemento,
        bairro: snap.endBairro,
        cidade: snap.endCidade,
        uf: snap.endUf,
        cep: snap.endCep,
        pontoReferencia: snap.endReferencia,
      },
    });
  }

  /** Lista por filial + status (default: PENDENTE — a fila de montagem). */
  async list(params: { filialId?: string; status?: StatusEntrega }) {
    const status = params.status ?? StatusEntrega.PENDENTE;
    const entregas = await this.prisma.entrega.findMany({
      where: {
        ...(params.filialId ? { filialId: params.filialId } : {}),
        status,
        // Entregas PENDENTES já montadas numa viagem (têm parada) saem da fila —
        // não são mais "pendentes de montagem". Voltam se a viagem for descartada.
        ...(status === StatusEntrega.PENDENTE ? { parada: { is: null } } : {}),
      },
      include: { cupons: true },
      orderBy: { criadoEm: 'asc' }, // quem comprou primeiro tende a sair primeiro
      take: 200,
    });
    return entregas.map((e) => this.comTotal(e));
  }

  /**
   * Busca de entregas JÁ BAIXADAS (ENTREGUE/NAO_ENTREGUE) p/ a consulta do
   * comprovante (financeiro). Espelha a busca da Nova Entrega: um termo livre
   * casa por nome OU telefone OU matrícula; cupom e nº de entrega são filtros
   * adicionais. Escopada por filial. Devolve a ref leve ao cofre
   * (temComprovante/comprovanteId) p/ a tela abrir a prova.
   */
  async buscarBaixadas(params: { termo?: string; cupom?: string; numero?: number; filialId?: string }) {
    const termo = params.termo?.trim();
    const cupom = params.cupom?.trim();
    const orTermo: Prisma.EntregaWhereInput[] = [];
    if (termo) {
      orTermo.push({ destinatarioNome: { contains: termo, mode: 'insensitive' } });
      orTermo.push({ matricula: { contains: termo, mode: 'insensitive' } });
      const tel = onlyDigits(termo);
      if (tel) orTermo.push({ telefone: { contains: tel } });
    }
    const entregas = await this.prisma.entrega.findMany({
      where: {
        status: { in: TERMINAIS },
        ...(params.filialId ? { filialId: params.filialId } : {}),
        ...(params.numero != null && !Number.isNaN(params.numero) ? { numero: params.numero } : {}),
        ...(orTermo.length ? { OR: orTermo } : {}),
        ...(cupom ? { cupons: { some: { numeroCupom: { contains: cupom, mode: 'insensitive' } } } } : {}),
      },
      include: { cupons: true },
      orderBy: { dataHoraEntrega: 'desc' },
      take: 200,
    });
    return entregas.map((e) => this.comTotal(e));
  }

  async findOne(id: string, user?: JwtPayload) {
    const e = await this.prisma.entrega.findUnique({ where: { id }, include: { cupons: true } });
    if (!e) throw new NotFoundException('Entrega não encontrada.');
    if (user) assertPodeVerRegistro(user, e.filialId);
    return this.comTotal(e);
  }

  /**
   * Cancelamento LOCAL — só permitido enquanto PENDENTE. Regra do negócio:
   * nunca se cancela com o veículo na rua (entrega já EM_VIAGEM não cancela aqui).
   */
  async cancelar(id: string, motivo: string | undefined, canceladaPorId: string, userFilialId?: string) {
    const e = await this.prisma.entrega.findUnique({
      where: { id },
      select: { status: true, filialId: true, parada: { select: { viagem: { select: { numero: true } } } } },
    });
    if (!e) throw new NotFoundException('Entrega não encontrada.');
    if (userFilialId && e.filialId !== userFilialId) {
      throw new ForbiddenException('Entrega de outra filial — operação não permitida.');
    }
    if (e.status !== StatusEntrega.PENDENTE) {
      throw new BadRequestException(
        `Só é possível cancelar entrega PENDENTE (status atual: ${e.status}). Entrega despachada não se cancela aqui.`,
      );
    }
    // Se já está montada numa viagem (parada), cancelar deixaria uma "parada
    // fantasma" cancelada que ainda seria despachada. Descartar/remover da
    // viagem antes. (Espelha o guard da montagem.)
    if (e.parada) {
      throw new BadRequestException(
        `Entrega está na viagem #${e.parada.viagem?.numero ?? '?'} (em montagem). Remova-a da viagem (descarte a montagem) antes de cancelar.`,
      );
    }
    const atualizada = await this.prisma.entrega.update({
      where: { id },
      data: {
        status: StatusEntrega.CANCELADA,
        canceladaEm: new Date(),
        canceladaPorId,
        motivoCancelamento: motivo?.trim() || null,
      },
      include: { cupons: true },
    });
    return this.comTotal(atualizada);
  }

  /**
   * Baixa de entrega no campo (Fase 1b). A entrega precisa estar EM_VIAGEM
   * (numa viagem despachada). Resultado terminal:
   *  - ENTREGUE: opcionalmente com PROVA (foto/assinatura) → grava no cofre
   *    isolado e seta temComprovante/comprovanteId.
   *  - NAO_ENTREGUE: exige motivo (sem prova).
   * GPS por evento + dataHoraEntrega registrados na própria entrega.
   *
   * IDEMPOTENTE: se a entrega já está em estado terminal (reenvio offline do
   * app), devolve o estado atual sem reprocessar nem duplicar comprovante.
   *
   * Após a baixa, se TODAS as entregas da viagem ficaram terminais, a viagem
   * é concluída (EM_CURSO → CONCLUIDA) e o veículo liberado (→ DISPONIVEL).
   */
  async baixar(id: string, dto: BaixarEntregaDto, prova: ProvaBinaria | undefined, user: JwtPayload) {
    const e = await this.prisma.entrega.findUnique({
      where: { id },
      include: { cupons: true, parada: { select: { viagemId: true } } },
    });
    if (!e) throw new NotFoundException('Entrega não encontrada.');
    assertPodeVerRegistro(user, e.filialId);

    // Idempotência: já baixada → devolve o estado atual (reenvio do app é no-op).
    if (TERMINAIS.includes(e.status)) {
      return this.comTotal(e);
    }
    if (e.status !== StatusEntrega.EM_VIAGEM) {
      throw new BadRequestException(
        `Só é possível dar baixa em entrega EM_VIAGEM (status atual: ${e.status}). ` +
          'A entrega precisa estar numa viagem despachada.',
      );
    }
    const entregue = dto.resultado === 'ENTREGUE';
    if (!entregue && !dto.motivo?.trim()) {
      throw new BadRequestException('Informe o motivo da não-entrega.');
    }

    // Grava a prova no COFRE (banco isolado + object store) ANTES de fechar a
    // baixa — se o cofre falhar, a baixa não acontece (a prova é o ativo).
    let comprovanteId: string | null = null;
    let temComprovante = false;
    if (entregue && prova) {
      const cupom = e.cupons.find((c) => c.numeroCupom)?.numeroCupom ?? null;
      const { comprovanteId: cid } = await this.cofre.gravar({
        entregaId: e.id,
        entregaNumero: e.numero,
        filialId: e.filialId,
        matricula: e.matricula,
        cupom,
        tipo: dto.tipoProva === 'ASSINATURA' ? 'ASSINATURA' : 'FOTO',
        binario: prova.buffer,
        mimeType: prova.mimetype,
        geoLat: dto.geoLat ?? null,
        geoLng: dto.geoLng ?? null,
        entregadorId: user.sub,
        trilha: {
          recebedorNome: dto.recebedorNome?.trim() || null,
          idempotencyKey: dto.idempotencyKey ?? null,
          viagemId: e.parada?.viagemId ?? null,
        },
      });
      comprovanteId = cid;
      temComprovante = true;
    }

    const novoStatus = entregue ? StatusEntrega.ENTREGUE : StatusEntrega.NAO_ENTREGUE;
    const viagemId = e.parada?.viagemId ?? null;

    const atualizada = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.entrega.update({
        where: { id },
        data: {
          status: novoStatus,
          dataHoraEntrega: new Date(),
          motivoNaoEntrega: entregue ? null : dto.motivo!.trim(),
          baixadoPorId: user.sub,
          geoLat: dto.geoLat != null ? new Prisma.Decimal(dto.geoLat) : null,
          geoLng: dto.geoLng != null ? new Prisma.Decimal(dto.geoLng) : null,
          temComprovante,
          comprovanteId,
        },
        include: { cupons: true },
      });

      if (viagemId) await this.concluirViagemSeTudoBaixado(tx, viagemId);
      return upd;
    });

    return this.comTotal(atualizada);
  }

  /**
   * Se todas as entregas das paradas de uma viagem EM_CURSO ficaram terminais,
   * conclui a viagem e libera o veículo. Roda dentro da transação da baixa.
   */
  private async concluirViagemSeTudoBaixado(tx: Prisma.TransactionClient, viagemId: string) {
    const viagem = await tx.viagem.findUnique({
      where: { id: viagemId },
      select: {
        situacao: true,
        veiculoId: true,
        paradas: { select: { entrega: { select: { status: true } } } },
      },
    });
    if (!viagem || viagem.situacao !== StatusViagem.EM_CURSO) return;
    const entregas = viagem.paradas.map((p) => p.entrega).filter((x): x is { status: StatusEntrega } => !!x);
    const todasBaixadas = entregas.length > 0 && entregas.every((e) => TERMINAIS.includes(e.status));
    if (!todasBaixadas) return;

    await tx.viagem.update({
      where: { id: viagemId },
      data: { situacao: StatusViagem.CONCLUIDA, dataHoraChegada: new Date() },
    });
    await tx.veiculo.update({ where: { id: viagem.veiculoId }, data: { situacao: SituacaoVeiculo.DISPONIVEL } });
  }

  // ---------- helpers ----------
  private async resolverSnapshotEndereco(dto: CreateEntregaDto) {
    if (dto.enderecoEntregaId) {
      const end = await this.prisma.enderecoEntrega.findUnique({
        where: { id: dto.enderecoEntregaId },
      });
      if (!end) throw new BadRequestException('enderecoEntregaId inválido.');
      return {
        endLogradouro: end.logradouro,
        endNumero: end.numero,
        endComplemento: end.complemento,
        endBairro: end.bairro,
        endCidade: end.cidade,
        endUf: end.uf,
        endCep: end.cep,
        endReferencia: end.pontoReferencia,
      };
    }
    if (!dto.endLogradouro?.trim()) {
      throw new BadRequestException('Informe enderecoEntregaId ou os campos de endereço (endLogradouro).');
    }
    return {
      endLogradouro: dto.endLogradouro.trim(),
      endNumero: dto.endNumero?.trim() || null,
      endComplemento: dto.endComplemento?.trim() || null,
      endBairro: dto.endBairro?.trim() || null,
      endCidade: dto.endCidade?.trim() || null,
      endUf: dto.endUf?.trim().toUpperCase() || null,
      endCep: dto.endCep ? onlyDigits(dto.endCep) : null,
      endReferencia: dto.endReferencia?.trim() || null,
    };
  }

  private comTotal<T extends { cupons: { valor: Prisma.Decimal | null }[] }>(entrega: T) {
    const total = entrega.cupons.reduce((acc, c) => acc + (c.valor ? Number(c.valor) : 0), 0);
    return { ...entrega, totalCupons: total };
  }
}
