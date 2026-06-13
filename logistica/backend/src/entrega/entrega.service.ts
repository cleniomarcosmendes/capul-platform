import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SituacaoVeiculo, StatusEntrega, StatusViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import { CofreService } from '../cofre/cofre.service.js';
import { GeocodeService } from '../rota/geocode.service.js';
import { assertPodeVerRegistro } from '../common/filial-scope.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { BaixarEntregaDto, CreateEntregaDto, UpdateEntregaDto } from './dto.js';

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
    private readonly geocode: GeocodeService,
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
          origemVenda: dto.origemVenda,
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

    // Warm da geocodificação em BACKGROUND (não bloqueia a resposta): popula o
    // cache pra (1) o badge "entra na rota?" da fila e (2) o "Sugerir ordem"
    // sair instantâneo na montagem.
    void this.geocode
      .geocodificar({
        logradouro: snap.endLogradouro,
        numero: snap.endNumero,
        bairro: snap.endBairro,
        cidade: snap.endCidade,
        uf: snap.endUf,
        cep: snap.endCep,
      })
      .catch(() => undefined);

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
    const telefone = dto.telefone ? onlyDigits(dto.telefone) : null;

    // Caso 1: veio de um endereço JÁ SALVO da NOSSA base (o operador escolheu um
    // card e pode ter CORRIGIDO os campos). Atualiza o cadastro com o snapshot
    // (endereço corrigido) + telefone (se informado — não apaga o existente).
    // Endereços do Protheus NÃO chegam aqui: suas sugestões não têm
    // enderecoEntregaId (a correção do Protheus é feita no Protheus).
    if (dto.enderecoEntregaId) {
      await this.prisma.enderecoEntrega.updateMany({
        where: { id: dto.enderecoEntregaId, filialId: dto.filialId },
        data: {
          logradouro: snap.endLogradouro,
          numero: snap.endNumero,
          complemento: snap.endComplemento,
          bairro: snap.endBairro,
          cidade: snap.endCidade,
          uf: snap.endUf,
          cep: snap.endCep,
          pontoReferencia: snap.endReferencia,
          ...(telefone ? { telefone } : {}),
        },
      });
      return;
    }

    const matricula = dto.matricula?.trim() || null;
    const clienteLocalId = dto.clienteLocalId || null;
    if (!matricula && !clienteLocalId) return; // eventual — não cadastra
    if (!snap.endLogradouro) return;

    const dono = matricula ? { matricula } : { clienteLocalId };
    // Dedup escopado por filial: o mesmo endereço noutra filial é registro à parte.
    const existentes = await this.prisma.enderecoEntrega.findMany({
      where: { ativo: true, filialId: dto.filialId, ...dono },
      select: { id: true, logradouro: true, cidade: true, telefone: true },
    });
    const chave = this.chaveEndereco(snap.endLogradouro, snap.endCidade);
    const match = existentes.find((e) => this.chaveEndereco(e.logradouro, e.cidade) === chave);

    // Caso 2: o endereço digitado bate com um já cadastrado. Não duplica; mas
    // se veio telefone novo (diferente), atualiza o cadastro existente.
    if (match) {
      if (telefone && match.telefone !== telefone) {
        await this.prisma.enderecoEntrega.update({ where: { id: match.id }, data: { telefone } });
      }
      return;
    }

    // Caso 3: endereço novo → cria (com o telefone, se houver).
    await this.prisma.enderecoEntrega.create({
      data: {
        filialId: dto.filialId,
        ...dono,
        // Telefone DESTE endereço (contato que o entregador liga ao chegar).
        telefone,
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
    // Badge "entra na rota automática?" — consulta SÓ o cache de geocodificação
    // (instantâneo). null = ainda não tentado (warm roda na criação).
    let geo: (boolean | null)[] = [];
    if (status === StatusEntrega.PENDENTE && entregas.length) {
      geo = await this.geocode
        .statusCacheLote(
          entregas.map((e) => ({
            logradouro: e.endLogradouro,
            numero: e.endNumero,
            bairro: e.endBairro,
            cidade: e.endCidade,
            uf: e.endUf,
            cep: e.endCep,
          })),
        )
        .catch(() => []);
    }
    return entregas.map((e, i) => ({ ...this.comTotal(e), geocodificavel: geo[i] ?? null }));
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
    const e = await this.prisma.entrega.findUnique({
      where: { id },
      include: { cupons: true, parada: { select: { viagem: { select: { numero: true, situacao: true } } } } },
    });
    if (!e) throw new NotFoundException('Entrega não encontrada.');
    if (user) assertPodeVerRegistro(user, e.filialId);
    const { parada, ...resto } = e;
    const nomes = e.baixadoPorId ? await this.core.nomesUsuarios([e.baixadoPorId]) : new Map<string, string>();
    return {
      ...this.comTotal(resto),
      viagemNumero: parada?.viagem?.numero ?? null,
      viagemSituacao: parada?.viagem?.situacao ?? null,
      baixadoPorNome: (e.baixadoPorId && nomes.get(e.baixadoPorId)) || null,
    };
  }

  /**
   * Cancelamento LOCAL — só permitido enquanto PENDENTE. Regra do negócio:
   * nunca se cancela com o veículo na rua (entrega já EM_VIAGEM não cancela aqui).
   */
  /**
   * GRID (padrão workspace): listagem completa com filtros — status opcional
   * (sem = todas), termo livre (nome/telefone/matrícula/nº), período. Devolve
   * nº da viagem (quando montada) pro grid linkar. Ordenação é no cliente.
   */
  async grid(params: {
    filialId?: string;
    status?: StatusEntrega;
    termo?: string;
    de?: string;
    ate?: string;
  }) {
    const termo = params.termo?.trim();
    const num = termo && /^\d{1,9}$/.test(termo) ? Number(termo) : undefined;
    const entregas = await this.prisma.entrega.findMany({
      where: {
        ...(params.filialId ? { filialId: params.filialId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.de ? { criadoEm: { gte: new Date(params.de) } } : {}),
        ...(params.ate ? { criadoEm: { ...(params.de ? { gte: new Date(params.de) } : {}), lte: new Date(`${params.ate}T23:59:59`) } } : {}),
        ...(termo
          ? {
              OR: [
                { destinatarioNome: { contains: termo, mode: 'insensitive' as const } },
                { matricula: { contains: termo, mode: 'insensitive' as const } },
                { telefone: { contains: onlyDigits(termo) || termo } },
                { endBairro: { contains: termo, mode: 'insensitive' as const } },
                ...(num !== undefined ? [{ numero: num }] : []),
              ],
            }
          : {}),
      },
      include: { cupons: true, parada: { select: { viagem: { select: { numero: true, situacao: true } } } } },
      orderBy: { criadoEm: 'desc' },
      take: 500,
    });
    return entregas.map(({ parada, ...e }) => ({
      ...this.comTotal(e),
      viagemNumero: parada?.viagem?.numero ?? null,
    }));
  }

  /**
   * Edição (grid padrão workspace): só PENDENTE e FORA de viagem — endereço de
   * carga montada mudaria a rota por baixo do operador. Cupons substituem o
   * conjunto. Re-aquece a geocodificação se o endereço mudou.
   */
  async update(id: string, dto: UpdateEntregaDto, userFilialId?: string) {
    const e = await this.prisma.entrega.findUnique({
      where: { id },
      select: { status: true, filialId: true, parada: { select: { viagem: { select: { numero: true } } } } },
    });
    if (!e) throw new NotFoundException('Entrega não encontrada.');
    if (userFilialId && e.filialId !== userFilialId) {
      throw new ForbiddenException('Entrega de outra filial — operação não permitida.');
    }
    if (e.status !== StatusEntrega.PENDENTE) {
      throw new BadRequestException(`Só entrega PENDENTE pode ser editada (status atual: ${e.status}).`);
    }
    if (e.parada) {
      throw new BadRequestException(
        `Entrega está na viagem #${e.parada.viagem?.numero ?? '?'} — remova-a da viagem antes de editar.`,
      );
    }

    const cupons = dto.cupons?.filter((c) => c.numeroCupom || c.valor != null);
    const atualizada = await this.prisma.entrega.update({
      where: { id },
      data: {
        ...(dto.destinatarioNome !== undefined ? { destinatarioNome: dto.destinatarioNome.trim() } : {}),
        ...(dto.telefone !== undefined ? { telefone: onlyDigits(dto.telefone) || null } : {}),
        ...(dto.endLogradouro !== undefined ? { endLogradouro: dto.endLogradouro.trim() } : {}),
        ...(dto.endNumero !== undefined ? { endNumero: dto.endNumero.trim() || null } : {}),
        ...(dto.endComplemento !== undefined ? { endComplemento: dto.endComplemento.trim() || null } : {}),
        ...(dto.endBairro !== undefined ? { endBairro: dto.endBairro.trim() || null } : {}),
        ...(dto.endCidade !== undefined ? { endCidade: dto.endCidade.trim() || null } : {}),
        ...(dto.endUf !== undefined ? { endUf: dto.endUf.trim().toUpperCase() || null } : {}),
        ...(dto.endCep !== undefined ? { endCep: onlyDigits(dto.endCep) || null } : {}),
        ...(dto.endReferencia !== undefined ? { endReferencia: dto.endReferencia.trim() || null } : {}),
        ...(dto.horario !== undefined ? { horario: dto.horario.trim() || null } : {}),
        ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes.trim() || null } : {}),
        ...(dto.quantidadeVolumes !== undefined ? { quantidadeVolumes: dto.quantidadeVolumes } : {}),
        ...(dto.origemVenda !== undefined ? { origemVenda: dto.origemVenda } : {}),
        ...(cupons
          ? {
              cupons: {
                deleteMany: {},
                create: cupons.map((c) => ({
                  numeroCupom: c.numeroCupom?.trim() || null,
                  valor: c.valor != null ? new Prisma.Decimal(c.valor) : null,
                })),
              },
            }
          : {}),
      },
      include: { cupons: true },
    });

    // Endereço pode ter mudado — re-aquece o cache de geocodificação.
    void this.geocode
      .geocodificar({
        logradouro: atualizada.endLogradouro,
        numero: atualizada.endNumero,
        bairro: atualizada.endBairro,
        cidade: atualizada.endCidade,
        uf: atualizada.endUf,
        cep: atualizada.endCep,
      })
      .catch(() => undefined);

    return this.comTotal(atualizada);
  }

  /**
   * NOVA TENTATIVA (re-entrega — decisão 12/06, opção A): entrega NÃO ENTREGUE
   * (ex.: cliente ausente) volta pra FILA (PENDENTE) pra ser montada numa nova
   * viagem com rota recalculada — em vez de o entregador ter 2 viagens ativas
   * (quebraria auto-conclusão, frota e o app). A trilha da tentativa anterior
   * (motivo/quando/quem/viagem) é preservada em `historicoTentativas`, e a
   * parada da viagem antiga guarda referência legível antes de desvincular
   * (parada.entregaId é @unique — a entrega só pode estar em 1 parada).
   */
  async novaTentativa(id: string, userFilialId?: string) {
    const e = await this.prisma.entrega.findUnique({
      where: { id },
      include: { parada: { include: { viagem: { select: { numero: true, situacao: true } } } } },
    });
    if (!e) throw new NotFoundException('Entrega não encontrada.');
    if (userFilialId && e.filialId !== userFilialId) {
      throw new ForbiddenException('Entrega de outra filial — operação não permitida.');
    }
    if (e.status !== StatusEntrega.NAO_ENTREGUE) {
      throw new BadRequestException(
        `Só entrega NÃO ENTREGUE volta pra fila (status atual: ${e.status}).`,
      );
    }
    if (e.parada && !['CONCLUIDA', 'CANCELADA'].includes(e.parada.viagem.situacao)) {
      throw new BadRequestException(
        `A viagem #${e.parada.viagem.numero} ainda está em curso — conclua-a antes da nova tentativa.`,
      );
    }

    const historico = Array.isArray(e.historicoTentativas)
      ? (e.historicoTentativas as unknown[])
      : [];
    historico.push({
      tentativa: e.tentativas,
      motivo: e.motivoNaoEntrega,
      dataHora: e.dataHoraEntrega,
      baixadoPorId: e.baixadoPorId,
      viagemNumero: e.parada?.viagem.numero ?? null,
    });

    const ops = [];
    if (e.parada) {
      ops.push(
        this.prisma.parada.update({
          where: { id: e.parada.id },
          data: {
            entregaId: null,
            local: e.parada.local ?? `Entrega #${e.numero} — ${e.destinatarioNome}`,
            observacao: `Não entregue (tentativa ${e.tentativas}): ${e.motivoNaoEntrega ?? 'sem motivo'}`,
          },
        }),
      );
    }
    ops.push(
      this.prisma.entrega.update({
        where: { id },
        data: {
          status: StatusEntrega.PENDENTE,
          tentativas: { increment: 1 },
          historicoTentativas: historico as Prisma.InputJsonValue,
          dataHoraEntrega: null,
          motivoNaoEntrega: null,
          baixadoPorId: null,
          geoLat: null,
          geoLng: null,
        },
        include: { cupons: true },
      }),
    );
    const resultados = await this.prisma.$transaction(ops);
    return this.comTotal(resultados[resultados.length - 1] as Parameters<typeof this.comTotal>[0]);
  }

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
    // Prova flexível (meio-termo): ENTREGUE exige AO MENOS UMA prova — arquivo
    // (foto/assinatura) OU quem recebeu. A foto deixou de ser obrigatória, mas
    // não se baixa "no vazio": preserva o lastro de cobrança (cofre, 5 anos).
    if (entregue && !prova && !dto.recebedorNome?.trim()) {
      throw new BadRequestException(
        'Informe uma prova de entrega: foto, assinatura ou quem recebeu.',
      );
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
          recebedorNome: entregue ? dto.recebedorNome?.trim() || null : null,
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
    if (viagem.veiculoId) {
      await tx.veiculo.update({ where: { id: viagem.veiculoId }, data: { situacao: SituacaoVeiculo.DISPONIVEL } });
    }
  }

  // ---------- helpers ----------
  private async resolverSnapshotEndereco(dto: CreateEntregaDto) {
    // Prefere os campos informados — refletem o que está na TELA, inclusive
    // correções feitas sobre um endereço salvo (o front sempre os envia). Só
    // cai no DB se o cliente referenciou um endereço sem reenviar os campos.
    if (dto.endLogradouro?.trim()) {
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
    throw new BadRequestException('Informe enderecoEntregaId ou os campos de endereço (endLogradouro).');
  }

  private comTotal<T extends { cupons: { valor: Prisma.Decimal | null }[] }>(entrega: T) {
    const total = entrega.cupons.reduce((acc, c) => acc + (c.valor ? Number(c.valor) : 0), 0);
    return { ...entrega, totalCupons: total };
  }
}
