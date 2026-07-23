import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SituacaoVeiculo, StatusEntrega, StatusViagem, TipoViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import { assertPodeVerRegistro } from '../common/filial-scope.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { CreateViagemDto, DespacharViagemDto, ConcluirViagemDto, IniciarViagemDto, ForcarEncerramentoDto } from './dto.js';

@Injectable()
export class ViagemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreLookupService,
  ) {}

  /**
   * Cria a viagem em RASCUNHO (montagem). As entregas selecionadas (já na
   * ordem da rota) viram paradas. Numeração sequencial por filial. tipo=ENTREGA
   * (Fase 1). Não despacha — isso é um passo explícito.
   */
  async create(dto: CreateViagemDto, criadoPorId: string) {
    // 12/06: rascunho pode nascer SÓ com a carga — veículo/motorista são
    // opcionais aqui e obrigatórios no DESPACHO.
    if (dto.veiculoId) await this.validarVeiculoDaFilial(dto.veiculoId, dto.filialId);
    if (dto.motoristaId) await this.core.assertEntregador(dto.motoristaId, dto.filialId);

    const entregaIds = dto.entregaIds ?? [];
    if (entregaIds.length) {
      await this.validarEntregasParaParada(entregaIds, dto.filialId);
    }

    return this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSequencial.upsert({
        where: { filialId_escopo: { filialId: dto.filialId, escopo: 'VIAGEM' } },
        create: { filialId: dto.filialId, escopo: 'VIAGEM', ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      return tx.viagem.create({
        data: {
          numero: contador.ultimoNumero,
          filialId: dto.filialId,
          tipo: 'ENTREGA',
          veiculoId: dto.veiculoId || null,
          motoristaId: dto.motoristaId || null,
          situacao: StatusViagem.RASCUNHO,
          criadoPorId,
          paradas: {
            create: entregaIds.map((entregaId, i) => ({ entregaId, sequencia: i + 1 })),
          },
        },
        include: { paradas: { include: { entrega: true }, orderBy: { sequencia: 'asc' } } },
      });
    });
  }

  private async validarVeiculoDaFilial(veiculoId: string, filialId: string) {
    const veiculo = await this.prisma.veiculo.findUnique({ where: { id: veiculoId } });
    if (!veiculo || !veiculo.ativo) throw new BadRequestException('Veículo inválido.');
    if (veiculo.filialId !== filialId) throw new BadRequestException('Veículo é de outra filial.');
  }

  /** Carrega viagem exigindo RASCUNHO (edição de montagem) + escopo de filial. */
  private async rascunhoOuErro(id: string, userFilialId?: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    if (userFilialId && v.filialId !== userFilialId) {
      throw new BadRequestException('Viagem de outra filial.');
    }
    if (v.situacao !== StatusViagem.RASCUNHO) {
      throw new BadRequestException(`Só viagem em RASCUNHO pode ser editada (situação: ${v.situacao}).`);
    }
    return v;
  }

  /** Define/troca veículo e/ou motorista do RASCUNHO (12/06). */
  async atualizar(id: string, dto: { veiculoId?: string | null; motoristaId?: string | null }, userFilialId?: string) {
    const v = await this.rascunhoOuErro(id, userFilialId);
    if (dto.veiculoId) await this.validarVeiculoDaFilial(dto.veiculoId, v.filialId);
    if (dto.motoristaId) await this.core.assertEntregador(dto.motoristaId, v.filialId);
    await this.prisma.viagem.update({
      where: { id },
      data: {
        ...(dto.veiculoId !== undefined ? { veiculoId: dto.veiculoId || null } : {}),
        ...(dto.motoristaId !== undefined ? { motoristaId: dto.motoristaId || null } : {}),
      },
    });
    return this.findOne(id);
  }

  /** Adiciona entregas PENDENTES ao fim da rota do RASCUNHO (12/06). */
  async adicionarEntregas(id: string, entregaIds: string[], userFilialId?: string) {
    const v = await this.rascunhoOuErro(id, userFilialId);
    if (!entregaIds?.length) throw new BadRequestException('Informe as entregas a adicionar.');
    await this.validarEntregasParaParada(entregaIds, v.filialId);
    const max = await this.prisma.parada.aggregate({ where: { viagemId: id }, _max: { sequencia: true } });
    let seq = max._max.sequencia ?? 0;
    await this.prisma.parada.createMany({
      data: entregaIds.map((entregaId) => ({ viagemId: id, entregaId, sequencia: ++seq })),
    });
    return this.findOne(id);
  }

  /**
   * Re-sequencia as paradas do RASCUNHO conforme a ordem de entregaIds
   * (12/06 — usado pelas setas ↑↓ e pelo "Sugerir ordem" no detalhe).
   * Duas passadas (offset) evitam colisão de sequência única durante o swap.
   */
  async reordenar(id: string, entregaIds: string[], userFilialId?: string) {
    await this.rascunhoOuErro(id, userFilialId);
    const paradas = await this.prisma.parada.findMany({ where: { viagemId: id }, select: { id: true, entregaId: true } });
    const porEntrega = new Map(paradas.map((p) => [p.entregaId, p.id]));
    const ids = entregaIds.filter((e) => porEntrega.has(e));
    if (ids.length !== paradas.length) {
      throw new BadRequestException('A nova ordem precisa conter exatamente as entregas da viagem.');
    }
    await this.prisma.$transaction([
      ...ids.map((e, i) =>
        this.prisma.parada.update({ where: { id: porEntrega.get(e)! }, data: { sequencia: 1000 + i } })),
      ...ids.map((e, i) =>
        this.prisma.parada.update({ where: { id: porEntrega.get(e)! }, data: { sequencia: i + 1 } })),
    ]);
    return this.findOne(id);
  }

  async list(params: { filialId?: string; situacao?: StatusViagem; veiculoId?: string }) {
    const viagens = await this.prisma.viagem.findMany({
      where: {
        ...(params.filialId ? { filialId: params.filialId } : {}),
        ...(params.situacao ? { situacao: params.situacao } : {}),
        ...(params.veiculoId ? { veiculoId: params.veiculoId } : {}),
      },
      include: {
        veiculo: { select: { placa: true } },
        _count: { select: { paradas: true } },
        // Volumes das entregas da viagem (soma exibida no card, sem expandir).
        paradas: { select: { entrega: { select: { quantidadeVolumes: true } } } },
      },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
    // Nome do motorista (core) em cada viagem — evita o front resolver à parte.
    const motoristas = await this.core.nomesUsuarios(viagens.map((v) => v.motoristaId).filter((x): x is string => !!x));
    return viagens.map(({ paradas, ...v }) => ({
      ...v,
      motoristaNome: (v.motoristaId && motoristas.get(v.motoristaId)) || null,
      totalVolumes: paradas.reduce((s, p) => s + (p.entrega?.quantidadeVolumes ?? 0), 0),
    }));
  }

  /**
   * Viagens DO entregador logado (app — Fase 1b). Filtra por motoristaId; sem
   * `situacao` traz só as EM_CURSO (despachadas, que ele tem pra rodar agora —
   * RASCUNHO ainda está em montagem no balcão). Inclui paradas+entrega pro app
   * montar a rota sem um round-trip por viagem.
   */
  async listMinhas(motoristaId: string, situacao?: StatusViagem) {
    const viagens = await this.prisma.viagem.findMany({
      where: {
        motoristaId,
        situacao: situacao ?? StatusViagem.EM_CURSO,
      },
      include: {
        veiculo: { select: { placa: true, modelo: true } },
        paradas: { include: { entrega: true }, orderBy: { sequencia: 'asc' } },
      },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });
    return viagens.map((v) => ({
      ...v,
      totalVolumes: v.paradas.reduce((s, p) => s + (p.entrega?.quantidadeVolumes ?? 0), 0),
    }));
  }

  async findOne(id: string, user?: JwtPayload) {
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: {
        veiculo: { select: { placa: true, modelo: true, kmAtual: true } },
        paradas: { include: { entrega: true }, orderBy: { sequencia: 'asc' } },
      },
    });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    // O MOTORISTA sempre abre a SUA viagem (mesma regra da lista "minhas viagens",
    // escopada por motoristaId — não por filial). Sem isto, a rota aparece na lista
    // mas dá "não foi possível carregar" quando a filial ATIVA do entregador difere
    // da filial da viagem: ele tem o papel ENTREGADOR na filial da viagem (validado
    // no despacho), mas o filialId do JWT pode ser outro. Demais viewers (operador/
    // gestor) seguem escopados por filial.
    if (user && v.motoristaId !== user.sub) assertPodeVerRegistro(user, v.filialId);
    // Nome do motorista (core) — a lista já enriquece; o detalhe também precisa
    // (a tela de detalhe mostrava "—"; reporte do Clenio 12/06).
    // Nomes (core): motorista + quem deu cada baixa — respostas prontas pro
    // cliente sem resolver IDs no front.
    const ids = [
      ...(v.motoristaId ? [v.motoristaId] : []),
      ...v.paradas.map((p) => p.entrega?.baixadoPorId).filter((x): x is string => !!x),
    ];
    const nomes = ids.length ? await this.core.nomesUsuarios(ids) : new Map<string, string>();
    return {
      ...v,
      motoristaNome: (v.motoristaId && nomes.get(v.motoristaId)) || null,
      paradas: v.paradas.map((p) => ({
        ...p,
        entrega: p.entrega
          ? { ...p.entrega, baixadoPorNome: (p.entrega.baixadoPorId && nomes.get(p.entrega.baixadoPorId)) || null }
          : p.entrega,
      })),
    };
  }

  /**
   * Despacha: RASCUNHO → EM_CURSO. As entregas das paradas viram EM_VIAGEM e o
   * veículo vira EM_USO. Exige veículo DISPONIVEL e ao menos 1 parada.
   */
  async despachar(id: string, dto: DespacharViagemDto, userFilialId?: string) {
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: { paradas: { select: { entregaId: true } } },
    });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    if (userFilialId && v.filialId !== userFilialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.RASCUNHO) {
      throw new BadRequestException(`Só despacha viagem em RASCUNHO (atual: ${v.situacao}).`);
    }
    if (v.paradas.length === 0) throw new BadRequestException('Viagem sem entregas — adicione paradas antes de despachar.');
    // Rascunho pode nascer sem veículo/motorista — o DESPACHO exige os dois.
    if (!v.veiculoId || !v.motoristaId) {
      throw new BadRequestException('Defina veículo e motorista antes de despachar.');
    }
    // Fecha a brecha E11a: o motorista pode ter sido definido num rascunho antigo e
    // depois perdido o papel ENTREGADOR — revalida no ponto de não-retorno.
    await this.core.assertEntregador(v.motoristaId, v.filialId);
    const veiculoId = v.veiculoId; // narrow estável p/ dentro da transaction

    const veiculo = await this.prisma.veiculo.findUnique({ where: { id: veiculoId } });
    if (!veiculo) throw new BadRequestException('Veículo não encontrado.');
    if (veiculo.situacao !== SituacaoVeiculo.DISPONIVEL) {
      throw new BadRequestException(`Veículo não está disponível (situação: ${veiculo.situacao}).`);
    }
    // Hodômetro da saída (opcional): não pode ser menor que o KM atual do veículo.
    if (dto.kmInicial != null && dto.kmInicial < veiculo.kmAtual) {
      throw new BadRequestException(`KM inicial (${dto.kmInicial}) menor que o KM atual do veículo (${veiculo.kmAtual}).`);
    }

    const entregaIds = v.paradas.map((p) => p.entregaId).filter((x): x is string => !!x);

    return this.prisma.$transaction(async (tx) => {
      await tx.entrega.updateMany({
        where: { id: { in: entregaIds }, status: StatusEntrega.PENDENTE },
        data: { status: StatusEntrega.EM_VIAGEM },
      });
      await tx.veiculo.update({ where: { id: veiculoId }, data: { situacao: SituacaoVeiculo.EM_USO } });
      return tx.viagem.update({
        where: { id },
        data: {
          situacao: StatusViagem.EM_CURSO,
          dataHoraSaida: new Date(),
          localSaida: dto.localSaida?.trim() || null,
          observacoesSaida: dto.observacoesSaida?.trim() || null,
          kmInicial: dto.kmInicial ?? undefined,
        },
        include: { paradas: { include: { entrega: true }, orderBy: { sequencia: 'asc' } } },
      });
    });
  }

  /**
   * Conclui a viagem (stopgap Fase 1a, SEM prova): EM_CURSO → CONCLUIDA. Libera
   * o veículo (→ DISPONIVEL) e baixa as entregas (EM_VIAGEM → ENTREGUE). A prova
   * de entrega real (foto/assinatura/GPS) é da Fase 1b — aqui é baixa manual no
   * balcão pra fechar o ciclo operacional. Exige viagem EM_CURSO.
   */
  /**
   * "Iniciar entrega" (app): o motorista registra o KM de SAÍDA na hora (no
   * painel do veículo). A viagem já está EM_CURSO (despachada no balcão); aqui só
   * grava o hodômetro de saída — base pra calcular o KM rodado no encerramento.
   */
  async iniciar(id: string, dto: IniciarViagemDto, userFilialId?: string) {
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: { veiculo: { select: { kmAtual: true } } },
    });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    if (userFilialId && v.filialId !== userFilialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.EM_CURSO) {
      throw new BadRequestException(`Só registra o KM de saída em viagem EM_CURSO (atual: ${v.situacao}).`);
    }
    if (v.veiculo && dto.kmInicial < v.veiculo.kmAtual) {
      throw new BadRequestException(`KM de saída (${dto.kmInicial}) menor que o KM atual do veículo (${v.veiculo.kmAtual}).`);
    }
    return this.prisma.viagem.update({
      where: { id },
      data: { kmInicial: dto.kmInicial },
      include: { paradas: { include: { entrega: true }, orderBy: { sequencia: 'asc' } } },
    });
  }

  async concluir(id: string, userFilialId?: string, userId?: string, dto?: ConcluirViagemDto) {
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: { paradas: { select: { entregaId: true } } },
    });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    if (userFilialId && v.filialId !== userFilialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.EM_CURSO) {
      throw new BadRequestException(`Só conclui viagem EM_CURSO (atual: ${v.situacao}).`);
    }
    // Hodômetro da chegada (opcional): não pode ser menor que o KM de saída.
    const kmFinal = dto?.kmFinal;
    if (kmFinal != null && v.kmInicial != null && kmFinal < v.kmInicial) {
      throw new BadRequestException(`KM final (${kmFinal}) menor que o KM de saída (${v.kmInicial}).`);
    }
    const entregaIds = v.paradas.map((p) => p.entregaId).filter((x): x is string => !!x);

    return this.prisma.$transaction(async (tx) => {
      await tx.entrega.updateMany({
        where: { id: { in: entregaIds }, status: StatusEntrega.EM_VIAGEM },
        // Conclusão manual também carimba QUANDO e QUEM — rastreabilidade pra
        // responder o cliente (sem isso a hora da entrega ficava vazia).
        data: { status: StatusEntrega.ENTREGUE, dataHoraEntrega: new Date(), baixadoPorId: userId ?? null },
      });
      if (v.veiculoId) {
        await tx.veiculo.update({
          where: { id: v.veiculoId },
          // Hodômetro de chegada também atualiza o KM atual do veículo (de quebra).
          data: { situacao: SituacaoVeiculo.DISPONIVEL, ...(kmFinal != null ? { kmAtual: kmFinal } : {}) },
        });
      }
      return tx.viagem.update({
        where: { id },
        data: { situacao: StatusViagem.CONCLUIDA, dataHoraChegada: new Date(), kmFinal: kmFinal ?? undefined },
        include: { paradas: { include: { entrega: true }, orderBy: { sequencia: 'asc' } } },
      });
    });
  }

  /**
   * Encerramento FORÇADO pelo gestor de entrega: fecha uma rota de entrega que
   * ficou pendurada EM_CURSO (o entregador esqueceu o retorno). Diferente do
   * `concluir` do app: o KM final é OBRIGATÓRIO (o gestor lê o painel do veículo
   * na garagem → mantém o odômetro íntegro) e grava a auditoria de quem forçou.
   * As entregas ainda EM_VIAGEM viram o que o gestor decidir (não fabrica
   * "entregue"). Libera o veículo e atualiza o odômetro.
   */
  async forcarEncerramento(id: string, dto: ForcarEncerramentoDto, userFilialId?: string, userId?: string) {
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: { paradas: { select: { entregaId: true } }, veiculo: { select: { kmAtual: true } } },
    });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    if (userFilialId && v.filialId !== userFilialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.tipo !== TipoViagem.ENTREGA) throw new BadRequestException('Este encerramento forçado é só para rotas de entrega.');
    if (v.situacao !== StatusViagem.EM_CURSO) {
      throw new BadRequestException(`Só força o encerramento de rota EM_CURSO (atual: ${v.situacao}).`);
    }
    // KM final obrigatório e coerente com a saída — o odômetro não pode retroceder.
    if (v.kmInicial != null && dto.kmFinal < v.kmInicial) {
      throw new BadRequestException(`KM final (${dto.kmFinal}) menor que o KM de saída (${v.kmInicial}).`);
    }
    // Trava contra regressão do odômetro quando a rota não teve KM de saída
    // (kmInicial nulo): o KM final não pode ficar abaixo do KM atual do veículo.
    if (v.veiculo && dto.kmFinal < v.veiculo.kmAtual) {
      throw new BadRequestException(`KM final (${dto.kmFinal}) menor que o KM atual do veículo (${v.veiculo.kmAtual}) — o odômetro não pode retroceder.`);
    }
    const kmFinal = dto.kmFinal;
    const destino = dto.marcarEntregasComo === 'ENTREGUE' ? StatusEntrega.ENTREGUE : StatusEntrega.NAO_ENTREGUE;
    const entregaIds = v.paradas.map((p) => p.entregaId).filter((x): x is string => !!x);

    return this.prisma.$transaction(async (tx) => {
      await tx.entrega.updateMany({
        where: { id: { in: entregaIds }, status: StatusEntrega.EM_VIAGEM },
        // ENTREGUE carimba quando/quem (rastreabilidade); NAO_ENTREGUE só o status.
        data: destino === StatusEntrega.ENTREGUE
          ? { status: destino, dataHoraEntrega: new Date(), baixadoPorId: userId ?? null }
          : { status: destino },
      });
      if (v.veiculoId) {
        await tx.veiculo.update({
          where: { id: v.veiculoId },
          data: { situacao: SituacaoVeiculo.DISPONIVEL, kmAtual: kmFinal },
        });
      }
      return tx.viagem.update({
        where: { id },
        data: {
          situacao: StatusViagem.CONCLUIDA,
          dataHoraChegada: new Date(),
          kmFinal,
          fechadoForcadoPorId: userId ?? null,
          fechadoForcadoEm: new Date(),
          observacoesChegada: dto.observacoes?.trim() || undefined,
        },
        include: { paradas: { include: { entrega: true }, orderBy: { sequencia: 'asc' } } },
      });
    });
  }

  /**
   * Remove UMA entrega da viagem (só RASCUNHO). Apaga a parada (a entrega segue
   * PENDENTE — em RASCUNHO ela nunca mudou de status) e re-sequencia as demais.
   */
  async removerEntrega(viagemId: string, entregaId: string, userFilialId?: string) {
    const v = await this.prisma.viagem.findUnique({
      where: { id: viagemId },
      include: { paradas: { orderBy: { sequencia: 'asc' } } },
    });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    if (userFilialId && v.filialId !== userFilialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.RASCUNHO) {
      throw new BadRequestException('Só dá para remover entrega de viagem em RASCUNHO (ainda não despachada).');
    }
    const parada = v.paradas.find((p) => p.entregaId === entregaId);
    if (!parada) throw new NotFoundException('Entrega não está nesta viagem.');

    await this.prisma.$transaction(async (tx) => {
      await tx.parada.delete({ where: { id: parada.id } });
      // re-sequencia 1..N as paradas restantes (mantém a ordem da rota).
      const restantes = v.paradas.filter((p) => p.id !== parada.id);
      for (let i = 0; i < restantes.length; i++) {
        if (restantes[i].sequencia !== i + 1) {
          await tx.parada.update({ where: { id: restantes[i].id }, data: { sequencia: i + 1 } });
        }
      }
    });
    return this.findOne(viagemId);
  }

  /** Descarta uma montagem (RASCUNHO) — libera as entregas (cascade nas paradas). */
  async descartar(id: string, userFilialId?: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id }, select: { situacao: true, filialId: true } });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    if (userFilialId && v.filialId !== userFilialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.RASCUNHO) {
      throw new BadRequestException('Só é possível descartar viagem em RASCUNHO (ainda não despachada).');
    }
    await this.prisma.viagem.delete({ where: { id } }); // cascade remove paradas; entregas seguem PENDENTE
    return { ok: true };
  }

  private async validarEntregasParaParada(entregaIds: string[], filialId: string) {
    const entregas = await this.prisma.entrega.findMany({
      where: { id: { in: entregaIds } },
      select: { id: true, filialId: true, status: true, parada: { select: { id: true } } },
    });
    if (entregas.length !== entregaIds.length) {
      throw new BadRequestException('Alguma entrega não foi encontrada.');
    }
    for (const e of entregas) {
      if (e.filialId !== filialId) throw new BadRequestException('Entrega de outra filial na seleção.');
      if (e.status !== StatusEntrega.PENDENTE) throw new BadRequestException('Entrega não está PENDENTE.');
      if (e.parada) throw new BadRequestException('Entrega já está em outra viagem.');
    }
  }
}
