import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, StatusEntrega } from '@prisma/client';
import { carimbarProvaEntrega, fmtGeo } from './watermark.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import { CofreService } from '../cofre/cofre.service.js';

/**
 * Dia da ENTREGA. Aceita ISO completo ou data-só 'AAAA-MM-DD'; para data-só, ancora ao
 * MEIO-DIA -03:00 — guardar meia-noite faz a entrega "pular" para o dia anterior
 * conforme o fuso (mesma regra de `dataDespesa`). Sem valor → HOJE, que é o caso normal
 * do balcão: quem lança quer a entrega de hoje e não deveria ter de digitar isso.
 */
const diaDaEntrega = (s?: string): Date => {
  if (!s) {
    const agora = new Date();
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
    return new Date(`${iso}T12:00:00-03:00`);
  }
  return s.includes('T') ? new Date(s) : new Date(`${s}T12:00:00-03:00`);
};
import { GeocodeService } from '../rota/geocode.service.js';
import { LocalAprendidoService } from '../rota/local-aprendido.service.js';
import { ProtheusCondutorService } from '../protheus/protheus-condutor.service.js';
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
  private readonly logger = new Logger(EntregaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreLookupService,
    private readonly cofre: CofreService,
    private readonly geocode: GeocodeService,
    private readonly condutor: ProtheusCondutorService,
    private readonly localAprendido: LocalAprendidoService,
  ) {}

  /**
   * Valida matrícula+senha do operador no portal RH — SEMPRE devolve 200
   * {valida, motivo, nome} (nunca lança 401, que deslogaria). Usado pela tela de
   * cadastro de entrega (login PADRAO) p/ identificar o operador 1x por sessão.
   */
  async validarOperador(matricula: string, senha: string) {
    const r = await this.condutor.validar(matricula, senha);
    if (r.status === 'VALIDO') return { valida: true as const, matricula: r.matricula, nome: r.nome };
    return { valida: false as const, motivo: r.status === 'INDISPONIVEL' ? ('INDISPONIVEL' as const) : ('CREDENCIAIS_INVALIDAS' as const) };
  }

  /** Resolve quem REGISTROU a entrega conforme o tipo do login (PADRAO/INDIVIDUAL). */
  private async resolverRegistrador(
    user: JwtPayload,
    operadorMatricula?: string,
    operadorSenha?: string,
  ): Promise<{ matricula: string | null; nome: string | null }> {
    if (user.tipo === 'PADRAO') {
      if (!operadorMatricula?.trim() || !operadorSenha) {
        throw new BadRequestException('Identifique-se: informe matrícula e senha do operador.');
      }
      const r = await this.condutor.validar(operadorMatricula.trim(), operadorSenha);
      if (r.status === 'INDISPONIVEL') throw new ServiceUnavailableException('Portal do RH indisponível. Tente novamente em instantes.');
      if (r.status !== 'VALIDO') throw new BadRequestException('Matrícula ou senha do operador inválidas.');
      return { matricula: r.matricula, nome: r.nome };
    }
    // INDIVIDUAL: o próprio usuário logado é o registrador (matrícula do core).
    const col = await this.core.colaboradorDoUsuario(user.sub);
    return { matricula: col?.matricula ?? null, nome: col?.nome ?? null };
  }

  /**
   * Cria a entrega. Atômico: incrementa o contador por filial (nº tipo talão),
   * congela o snapshot do endereço (autoritativo quando vem de um
   * EnderecoEntrega) e grava os cupons. Status inicial PENDENTE.
   */
  async create(dto: CreateEntregaDto, user: JwtPayload) {
    await this.core.validarFilial(dto.filialId);
    // Identifica quem registrou (PADRAO valida matrícula+senha; INDIVIDUAL usa o
    // próprio login). Roda ANTES de qualquer escrita — senha inválida não cria.
    const registrador = await this.resolverRegistrador(user, dto.operadorMatricula, dto.operadorSenha);
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
          dataEntrega: diaDaEntrega(dto.dataEntrega),
          observacoes: dto.observacoes?.trim() || null,
          quantidadeVolumes: dto.quantidadeVolumes,
          origemVenda: dto.origemVenda,
          status: StatusEntrega.PENDENTE,
          criadoPorId: user.sub,
          registradoPorMatricula: registrador.matricula,
          registradoPorNome: registrador.nome,
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
    //
    // E GRAVA O PIN na entrega. Antes a coordenada era calculada aqui e
    // descartada — ficava só no cache —, então a entrega nascia sem `geoLat/
    // geoLng` e só ganhava pin quando alguém rodasse "Sugerir ordem" ou o
    // "Recalcular localizações" do gestor. Efeito visto na rota #28 (11/08):
    // 3 de 4 entregas sem pin, embora as 4 coordenadas já estivessem no cache,
    // resolvidas. Custo zero: a coordenada já está em mãos.
    void this.geocode
      .geocodificar({
        logradouro: snap.endLogradouro,
        numero: snap.endNumero,
        bairro: snap.endBairro,
        cidade: snap.endCidade,
        uf: snap.endUf,
        cep: snap.endCep,
      })
      .then((c) =>
        c
          ? this.prisma.entrega.update({
              where: { id: entrega.id },
              data: { geoLat: c.lat, geoLng: c.lng },
            })
          : undefined,
      )
      .catch(() => undefined);

    return this.comTotal(entrega);
  }

  /**
   * Re-geocodifica os PINS (geo_lat/geo_lng) das entregas da filial a partir do
   * endereço, com o geocoder atual (fallback rua→bairro→município). Manutenção
   * pontual — útil quando o geocoder melhora e os pins antigos ficaram imprecisos
   * ou nulos. Sobrescreve a coordenada da linha (a UI não captura pin preciso do
   * cliente; a coordenada deriva do endereço). Cancela ficam de fora.
   */
  async regeocodificarFilial(filialId: string | undefined) {
    if (!filialId) throw new BadRequestException('Filial não definida.');
    const entregas = await this.prisma.entrega.findMany({
      where: { filialId, status: { not: StatusEntrega.CANCELADA } },
      select: { id: true, endLogradouro: true, endNumero: true, endBairro: true, endCidade: true, endUf: true, endCep: true },
    });
    let atualizadas = 0;
    let semCoordenada = 0;
    const porPrecisao: Record<string, number> = {};
    for (const e of entregas) {
      const c = await this.geocode.geocodificar({
        logradouro: e.endLogradouro, numero: e.endNumero, bairro: e.endBairro,
        cidade: e.endCidade, uf: e.endUf, cep: e.endCep,
      });
      if (!c) { semCoordenada++; continue; }
      await this.prisma.entrega.update({ where: { id: e.id }, data: { geoLat: c.lat, geoLng: c.lng } });
      atualizadas++;
      porPrecisao[c.precisao] = (porPrecisao[c.precisao] ?? 0) + 1;
    }
    return { total: entregas.length, atualizadas, semCoordenada, porPrecisao };
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
      // Ponto 2: o DIA manda na fila de montagem — há locais atendidos só em certos
      // dias, e o operador precisa ver primeiro o que é para hoje. Dentro do mesmo
      // dia vale a ordem antiga (quem comprou primeiro tende a sair primeiro).
      // `nulls: 'last'`: entrega anterior à mudança não tem dia e não pode encabeçar
      // a fila — no Postgres, ASC põe NULL por último, mas explicitar evita que uma
      // troca de ordenação futura vire mudança silenciosa de comportamento.
      orderBy: [{ dataEntrega: { sort: 'asc', nulls: 'last' } }, { criadoEm: 'asc' }],
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
    // Provas da entrega: 1 query batched no cofre (join no app). Vem a LISTA —
    // uma baixa pode ter foto E assinatura, e `comprovanteId` guarda só a
    // primária (a assinatura ficava sem como ser aberta).
    // Cofre é degradável — se cair, a lista sai sem as provas (não quebra).
    let provasPorEntrega = new Map<string, { id: string; tipo: string }[]>();
    try {
      provasPorEntrega = await this.cofre.provasPorEntregas(entregas.map((e) => e.id));
    } catch {
      /* cofre indisponível — segue sem as provas */
    }
    return entregas.map((e) => {
      const provas = provasPorEntrega.get(e.id) ?? [];
      return {
        ...this.comTotal(e),
        provas,
        // Mantido: badge da prova primária, consumido pela lista.
        comprovanteTipo: e.comprovanteId ? provas.find((p) => p.id === e.comprovanteId)?.tipo ?? null : null,
      };
    });
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
        ...(dto.dataEntrega !== undefined ? { dataEntrega: diaDaEntrega(dto.dataEntrega) } : {}),
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
  async baixar(id: string, dto: BaixarEntregaDto, provas: { foto?: ProvaBinaria; assinatura?: ProvaBinaria }, user: JwtPayload) {
    const e = await this.prisma.entrega.findUnique({
      where: { id },
      // `kmInicial` da rota: sem hodômetro de saída não se dá baixa (ver abaixo).
      include: { cupons: true, parada: { select: { viagemId: true, viagem: { select: { kmInicial: true, numero: true } } } } },
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
    /**
     * ⭐ Ponto 1: sem KM de SAÍDA não se dá baixa.
     *
     * A regra já existia — mas só na TELA do app (o botão vira "🔒 Registre o KM de
     * saída"). Client-side não é regra: qualquer outro caminho — desktop, versão
     * antiga do app, chamada direta — passava ao largo, e a rota rodava inteira sem
     * hodômetro. Sem KM de saída o trecho não entra no KM rodado e some do custo por
     * km. Aqui é o servidor cobrando, que é onde a regra tem de morar.
     */
    if (e.parada?.viagem && e.parada.viagem.kmInicial == null) {
      throw new BadRequestException(
        `Registre o KM de saída da rota #${e.parada.viagem.numero} antes de dar baixa nas entregas.`,
      );
    }

    const entregue = dto.resultado === 'ENTREGUE';
    if (!entregue && !dto.motivo?.trim()) {
      throw new BadRequestException('Informe o motivo da não-entrega.');
    }
    // Prova flexível: ENTREGUE exige AO MENOS UMA prova — foto E/OU assinatura
    // (as duas são permitidas) OU quem recebeu. Não se baixa "no vazio":
    // preserva o lastro de cobrança (cofre, 5 anos).
    const temProvaBinaria = !!provas.foto || !!provas.assinatura;
    if (entregue && !temProvaBinaria && !dto.recebedorNome?.trim()) {
      throw new BadRequestException(
        'Informe uma prova de entrega: foto, assinatura ou quem recebeu.',
      );
    }

    // Grava a(s) prova(s) no COFRE (banco isolado + object store) ANTES de fechar
    // a baixa — se o cofre falhar, a baixa não acontece (a prova é o ativo). Cada
    // prova vira um comprovante próprio (o cofre é append-only por entregaId).
    let comprovanteId: string | null = null;
    let temComprovante = false;
    if (entregue && temProvaBinaria) {
      const cupom = e.cupons.find((c) => c.numeroCupom)?.numeroCupom ?? null;

      // Grava UMA prova. FOTO: carimba metadados na imagem (auto-contida,
      // anti-fraude; best-effort). ASSINATURA não é carimbada.
      const gravarUma = async (prova: ProvaBinaria, tipo: 'FOTO' | 'ASSINATURA') => {
        let binario = prova.buffer;
        let mimeType = prova.mimetype;
        if (tipo === 'FOTO' && prova.mimetype.startsWith('image/')) {
          try {
            const endereco = [
              e.endLogradouro + (e.endNumero ? `, ${e.endNumero}` : ''),
              e.endBairro,
              e.endCidade && e.endUf ? `${e.endCidade}/${e.endUf}` : e.endCidade,
            ]
              .filter(Boolean)
              .join(' - ');
            const linhas = [
              `Entrega #${e.numero} - ${e.destinatarioNome}`,
              endereco,
              fmtGeo(dto.geoLat, dto.geoLng) ?? '',
              new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            ].filter((l): l is string => !!l && l.trim().length > 0);
            binario = await carimbarProvaEntrega(prova.buffer, linhas);
            mimeType = 'image/jpeg';
          } catch (err) {
            this.logger.warn(`Falha ao carimbar prova da entrega ${e.id}; gravando original. ${String(err)}`);
          }
        }
        const { comprovanteId: cid } = await this.cofre.gravar({
          entregaId: e.id,
          entregaNumero: e.numero,
          filialId: e.filialId,
          matricula: e.matricula,
          cupom,
          tipo,
          binario,
          mimeType,
          geoLat: dto.geoLat ?? null,
          geoLng: dto.geoLng ?? null,
          entregadorId: user.sub,
          trilha: {
            recebedorNome: dto.recebedorNome?.trim() || null,
            idempotencyKey: dto.idempotencyKey ?? null,
            viagemId: e.parada?.viagemId ?? null,
          },
        });
        return cid;
      };

      const cidAssin = provas.assinatura ? await gravarUma(provas.assinatura, 'ASSINATURA') : null;
      const cidFoto = provas.foto ? await gravarUma(provas.foto, 'FOTO') : null;
      // A FOTO é a prova "primária" (badge/consulta); a assinatura fica no cofre.
      comprovanteId = cidFoto ?? cidAssin;
      temComprovante = true;
    }

    const novoStatus = entregue ? StatusEntrega.ENTREGUE : StatusEntrega.NAO_ENTREGUE;

    const atualizada = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.entrega.update({
        where: { id },
        data: {
          status: novoStatus,
          dataHoraEntrega: new Date(),
          recebedorNome: entregue ? dto.recebedorNome?.trim() || null : null,
          motivoNaoEntrega: entregue ? null : dto.motivo!.trim(),
          baixadoPorId: user.sub,
          // ⚠️ GPS da baixa vai para as colunas DELE. Antes ia para geoLat/geoLng
          // — o pin de planejamento —, sobrescrevendo-o e, pior, zerando-o quando
          // não havia GPS: a entrega perdia a localização que o sistema já tinha.
          // Agora as duas convivem, e é a comparação entre elas que alimenta o
          // aprendizado de campo.
          baixaGeoLat: dto.geoLat != null ? new Prisma.Decimal(dto.geoLat) : null,
          baixaGeoLng: dto.geoLng != null ? new Prisma.Decimal(dto.geoLng) : null,
          temComprovante,
          comprovanteId,
        },
        include: { cupons: true },
      });

      // Auto-conclusão DESLIGADA (30/06): a rota agora é encerrada explicitamente
      // ("Encerrar entrega" no app / "Concluir" no balcão) para capturar o KM de
      // chegada no painel do veículo. Ver ViagemService.concluir / .iniciar.
      return upd;
    });

    // Aprendizado de campo: a baixa que acabou de acontecer é uma amostra nova
    // de ONDE este endereço realmente fica. Reavalia em BACKGROUND — não é para
    // segurar o entregador na porta do cliente, e falhar aqui não pode derrubar
    // uma baixa que já está gravada.
    if (dto.geoLat != null && dto.geoLng != null) {
      void this.localAprendido
        .reavaliar({
          logradouro: e.endLogradouro,
          numero: e.endNumero,
          bairro: e.endBairro,
          cidade: e.endCidade,
          uf: e.endUf,
          cep: e.endCep,
        })
        .catch(() => undefined);
    }

    return this.comTotal(atualizada);
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
