import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StatusChamado } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { hasStaffPerfilEmTI } from '../../common/constants/roles.constant.js';

/**
 * Servico de agrupamento de chamados (decidido em 13/05/2026).
 *
 * Caso de uso: varios usuarios abrem chamados com o mesmo problema —
 * T.I. agrupa todos em um chamado-pai. Filhos ficam em status AGRUPADO
 * (SLA pausado, fora dos filtros padroes). Resposta no pai propaga via
 * historico/notificacao. Closure do pai cascateia para os filhos.
 *
 * Regras:
 * - Apenas T.I. (ADMIN/GESTOR_TI/SUPORTE_TI) agrupa/desagrupa.
 * - Agrupador deve ter tecnico atribuido (precisa estar EM_ATENDIMENTO ou similar).
 * - Status finalizado (RESOLVIDO/FECHADO/CANCELADO) nao pode ser agrupado.
 * - Filho ja agrupado nao reagrupa (deve desagrupar primeiro).
 * - Hierarquia 1 nivel: nao agrupa o proprio agrupador.
 * - Desagrupar so funciona se filho NAO esta finalizado (incluindo via cascata).
 * - CSAT separado por filho (cada solicitante avalia o seu).
 */
@Injectable()
export class ChamadoAgrupamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
  ) {}

  async agrupar(chamadoFilhoId: string, agrupadorId: string, user: JwtPayload, role: string) {
    // S13a (25/05) — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`.
    // Multi-perfil (Juliana GESTOR/CTL + USUARIO_FINAL/TI) precisa ser
    // detectado pelo JWT.departamentos[isTI], não pela role denormalizada.
    if (!hasStaffPerfilEmTI(user)) {
      throw new ForbiddenException('Apenas equipe T.I. pode agrupar chamados');
    }
    if (chamadoFilhoId === agrupadorId) {
      throw new BadRequestException('Chamado nao pode ser agrupado em si mesmo');
    }

    const [filho, pai] = await Promise.all([
      this.prisma.chamado.findUnique({
        where: { id: chamadoFilhoId },
        select: {
          id: true, numero: true, titulo: true, status: true, dataLimiteSla: true,
          chamadoAgrupadorId: true, solicitanteId: true, tecnicoId: true,
        },
      }),
      this.prisma.chamado.findUnique({
        where: { id: agrupadorId },
        select: {
          id: true, numero: true, titulo: true, status: true, tecnicoId: true,
          chamadoAgrupadorId: true,
        },
      }),
    ]);
    if (!filho) throw new NotFoundException('Chamado filho nao encontrado');
    if (!pai) throw new NotFoundException('Chamado agrupador nao encontrado');

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(filho.status)) {
      throw new BadRequestException('Chamado finalizado nao pode ser agrupado');
    }
    if (filho.status === 'AGRUPADO' || filho.chamadoAgrupadorId) {
      throw new BadRequestException('Chamado ja esta agrupado. Desagrupe antes de reagrupar.');
    }
    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(pai.status)) {
      throw new BadRequestException('Chamado agrupador esta finalizado');
    }
    if (pai.status === 'AGRUPADO' || pai.chamadoAgrupadorId) {
      throw new BadRequestException('Nao eh possivel agrupar em um chamado que ja eh filho de outro');
    }
    if (!pai.tecnicoId) {
      throw new BadRequestException('Chamado agrupador precisa estar atribuido a um tecnico');
    }

    const agora = new Date();

    // Se filho nao tem tecnico, o tecnico do pai assume automaticamente.
    // Status anterior fica EM_ATENDIMENTO para que ao desagrupar volte como
    // assumido (e nao como ABERTO original). Pedido suporte 13/05/2026.
    const filhoHerdaTecnico = !filho.tecnicoId && !!pai.tecnicoId;
    const statusAnterior = filhoHerdaTecnico ? 'EM_ATENDIMENTO' : filho.status;

    await this.prisma.chamado.update({
      where: { id: chamadoFilhoId },
      data: {
        chamadoAgrupadorId: agrupadorId,
        statusAnteriorAgrupamento: statusAnterior,
        slaPausadoEm: agora,
        status: 'AGRUPADO',
        ...(filhoHerdaTecnico ? { tecnicoId: pai.tecnicoId } : {}),
      },
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'AGRUPADO_EM',
        descricao: `Agrupado no chamado #${pai.numero} - ${pai.titulo}`,
        publico: true,
        chamadoId: chamadoFilhoId,
        usuarioId: user.sub,
      },
    });

    // Se herdou tecnico, registra ASSUMIDO no filho para deixar rastro
    // — solicitante ve quem ficou responsavel apos o agrupamento.
    if (filhoHerdaTecnico) {
      await this.prisma.historicoChamado.create({
        data: {
          tipo: 'ASSUMIDO',
          descricao: `Tecnico do chamado agrupador #${pai.numero} assumiu automaticamente`,
          publico: true,
          chamadoId: chamadoFilhoId,
          usuarioId: user.sub,
        },
      });
    }

    // Notificar solicitante do filho
    if (filho.solicitanteId !== user.sub) {
      this.notificacaoService.criarParaUsuario(
        filho.solicitanteId,
        'CHAMADO_ATUALIZADO',
        `Chamado #${filho.numero} agrupado`,
        `Seu chamado "${filho.titulo}" foi agrupado em #${pai.numero} - "${pai.titulo}" (mesmo problema). A resposta vira pelo chamado principal.`,
        { chamadoId: chamadoFilhoId, agrupadorId },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return this.prisma.chamado.findUnique({
      where: { id: chamadoFilhoId },
      select: { id: true, status: true, chamadoAgrupadorId: true, slaPausadoEm: true },
    });
  }

  /**
   * Agrupa varios chamados de uma vez em um agrupador. Para cada filho,
   * tenta chamar `agrupar` — erros individuais sao coletados em vez de
   * abortar o lote inteiro. UX da equipe de suporte (13/05/2026):
   * tecnico marca varios chamados via checkbox e agrupa todos no chamado
   * que ja esta atendendo.
   */
  async agruparMultiplos(agrupadorId: string, filhosIds: string[], user: JwtPayload, role: string) {
    // S13a (25/05) — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`.
    // Multi-perfil (Juliana GESTOR/CTL + USUARIO_FINAL/TI) precisa ser
    // detectado pelo JWT.departamentos[isTI], não pela role denormalizada.
    if (!hasStaffPerfilEmTI(user)) {
      throw new ForbiddenException('Apenas equipe T.I. pode agrupar chamados');
    }
    if (!filhosIds || filhosIds.length === 0) {
      throw new BadRequestException('Informe pelo menos um chamado para agrupar');
    }

    const agrupados: { id: string; numero: number }[] = [];
    const erros: { chamadoId: string; numero?: number; motivo: string }[] = [];

    for (const filhoId of filhosIds) {
      try {
        await this.agrupar(filhoId, agrupadorId, user, role);
        const c = await this.prisma.chamado.findUnique({
          where: { id: filhoId },
          select: { id: true, numero: true },
        });
        if (c) agrupados.push(c);
      } catch (err) {
        const numero = (await this.prisma.chamado.findUnique({
          where: { id: filhoId }, select: { numero: true },
        }))?.numero;
        const motivo = (err as { message?: string })?.message ?? 'Erro desconhecido';
        erros.push({ chamadoId: filhoId, numero, motivo });
      }
    }

    return { agrupados, erros };
  }

  async desagrupar(chamadoFilhoId: string, user: JwtPayload, role: string) {
    // S13a (25/05) — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`.
    // Multi-perfil (Juliana GESTOR/CTL + USUARIO_FINAL/TI) precisa ser
    // detectado pelo JWT.departamentos[isTI], não pela role denormalizada.
    if (!hasStaffPerfilEmTI(user)) {
      throw new ForbiddenException('Apenas equipe T.I. pode desagrupar chamados');
    }

    const filho = await this.prisma.chamado.findUnique({
      where: { id: chamadoFilhoId },
      select: {
        id: true, numero: true, titulo: true, status: true,
        chamadoAgrupadorId: true, statusAnteriorAgrupamento: true,
        slaPausadoEm: true, dataLimiteSla: true, solicitanteId: true,
      },
    });
    if (!filho) throw new NotFoundException('Chamado nao encontrado');
    if (!filho.chamadoAgrupadorId) {
      throw new BadRequestException('Chamado nao esta agrupado');
    }
    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(filho.status)) {
      // Decisao 13/05: nao desagrupa fechados — evita logica complexa.
      throw new BadRequestException('Chamado finalizado nao pode ser desagrupado');
    }

    // Calcular tempo pausado e empurrar dataLimiteSla
    let novaDataLimite = filho.dataLimiteSla;
    if (filho.slaPausadoEm && filho.dataLimiteSla) {
      const pausadoMs = Date.now() - filho.slaPausadoEm.getTime();
      novaDataLimite = new Date(filho.dataLimiteSla.getTime() + pausadoMs);
    }

    const statusRestaurado = (filho.statusAnteriorAgrupamento as StatusChamado) || 'ABERTO';

    await this.prisma.chamado.update({
      where: { id: chamadoFilhoId },
      data: {
        chamadoAgrupadorId: null,
        statusAnteriorAgrupamento: null,
        slaPausadoEm: null,
        status: statusRestaurado,
        dataLimiteSla: novaDataLimite,
      },
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'DESAGRUPADO',
        descricao: `Desagrupado — volta ao status ${statusRestaurado}`,
        publico: true,
        chamadoId: chamadoFilhoId,
        usuarioId: user.sub,
      },
    });

    if (filho.solicitanteId !== user.sub) {
      this.notificacaoService.criarParaUsuario(
        filho.solicitanteId,
        'CHAMADO_ATUALIZADO',
        `Chamado #${filho.numero} desagrupado`,
        `Seu chamado "${filho.titulo}" voltou a ser tratado separadamente.`,
        { chamadoId: chamadoFilhoId },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return this.prisma.chamado.findUnique({
      where: { id: chamadoFilhoId },
      select: { id: true, status: true, chamadoAgrupadorId: true, dataLimiteSla: true },
    });
  }

  async listarAgrupados(agrupadorId: string) {
    return this.prisma.chamado.findMany({
      where: { chamadoAgrupadorId: agrupadorId },
      select: {
        id: true, numero: true, titulo: true, status: true,
        statusAnteriorAgrupamento: true, slaPausadoEm: true,
        solicitante: { select: { id: true, nome: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Propaga resposta/comentario do agrupador para os filhos.
   * Cada filho recebe um historico RESPONDIDO_EM_GRUPO e o solicitante do filho
   * recebe notificacao apontando para o pai.
   */
  async propagarComentario(
    agrupadorId: string,
    comentarioTexto: string,
    autor: JwtPayload,
  ) {
    const filhos = await this.prisma.chamado.findMany({
      where: { chamadoAgrupadorId: agrupadorId, status: 'AGRUPADO' },
      select: { id: true, numero: true, titulo: true, solicitanteId: true },
    });
    if (filhos.length === 0) return;

    const pai = await this.prisma.chamado.findUnique({
      where: { id: agrupadorId },
      select: { numero: true, titulo: true },
    });
    if (!pai) return;

    // Historico em cada filho
    await this.prisma.historicoChamado.createMany({
      data: filhos.map((f) => ({
        tipo: 'RESPONDIDO_EM_GRUPO' as const,
        descricao: `Resposta do agrupador #${pai.numero}: ${comentarioTexto.slice(0, 500)}`,
        publico: true,
        chamadoId: f.id,
        usuarioId: autor.sub,
      })),
    });

    // Notificar solicitantes dos filhos (deduplicados, exceto autor)
    const ids = Array.from(new Set(filhos.map((f) => f.solicitanteId))).filter((id) => id !== autor.sub);
    if (ids.length > 0) {
      this.notificacaoService.criarParaUsuarios(
        ids,
        'CHAMADO_ATUALIZADO',
        `Resposta no chamado agrupado #${pai.numero}`,
        `Houve uma resposta no chamado #${pai.numero} - "${pai.titulo}" (onde seu chamado esta agrupado).`,
        { agrupadorId },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }
  }

  /**
   * Propaga um evento generico do agrupador para os filhos como historico
   * COMENTARIO publico com prefixo `[Agrupador #N]`. Usado para que
   * interacoes do pai (assumir, transferir equipe/tecnico) apareçam na
   * timeline de cada filho — pedido suporte 13/05/2026.
   *
   * Por que tipo COMENTARIO: evita criar valores novos no enum
   * TipoHistorico (que exigiria ALTER TYPE) e mantem a aparencia visual
   * "informativa" nos filhos sem fingir que eles foram transferidos.
   */
  async propagarEventoNoFilho(
    agrupadorId: string,
    descricao: string,
    autorId: string,
  ) {
    const filhos = await this.prisma.chamado.findMany({
      where: { chamadoAgrupadorId: agrupadorId, status: 'AGRUPADO' },
      select: { id: true },
    });
    if (filhos.length === 0) return;

    const pai = await this.prisma.chamado.findUnique({
      where: { id: agrupadorId },
      select: { numero: true },
    });
    if (!pai) return;

    await this.prisma.historicoChamado.createMany({
      data: filhos.map((f) => ({
        tipo: 'COMENTARIO' as const,
        descricao: `[Agrupador #${pai.numero}] ${descricao}`,
        publico: true,
        chamadoId: f.id,
        usuarioId: autorId,
      })),
    });
  }

  /**
   * Cascata de resolucao/fechamento do agrupador para os filhos.
   * Filhos viram RESOLVIDO/FECHADO com mesma dataResolucao/dataFechamento.
   * SLA pausado eh limpado (campo slaPausadoEm fica como audit).
   */
  async cascataResolverFechar(
    agrupadorId: string,
    novoStatus: 'RESOLVIDO' | 'FECHADO',
    dataResolucao: Date,
    autor: JwtPayload,
  ) {
    const filhos = await this.prisma.chamado.findMany({
      where: { chamadoAgrupadorId: agrupadorId, status: 'AGRUPADO' },
      select: { id: true, numero: true, titulo: true, solicitanteId: true },
    });
    if (filhos.length === 0) return;

    const dataFechamento = novoStatus === 'FECHADO' ? dataResolucao : undefined;
    const dadosUpdate: Record<string, unknown> = {
      status: novoStatus,
      statusAnteriorAgrupamento: null,
      dataResolucao,
    };
    if (dataFechamento) dadosUpdate.dataFechamento = dataFechamento;

    await this.prisma.chamado.updateMany({
      where: { chamadoAgrupadorId: agrupadorId, status: 'AGRUPADO' },
      data: dadosUpdate,
    });

    const tipoHist = novoStatus === 'RESOLVIDO' ? 'RESOLVIDO_EM_GRUPO' : 'FECHADO_EM_GRUPO';
    await this.prisma.historicoChamado.createMany({
      data: filhos.map((f) => ({
        tipo: tipoHist as 'RESOLVIDO_EM_GRUPO' | 'FECHADO_EM_GRUPO',
        descricao: `${novoStatus === 'RESOLVIDO' ? 'Resolvido' : 'Fechado'} em cascata pelo agrupador`,
        publico: true,
        chamadoId: f.id,
        usuarioId: autor.sub,
      })),
    });

    const ids = Array.from(new Set(filhos.map((f) => f.solicitanteId))).filter((id) => id !== autor.sub);
    if (ids.length > 0) {
      this.notificacaoService.criarParaUsuarios(
        ids,
        'CHAMADO_ATUALIZADO',
        `Chamado ${novoStatus.toLowerCase()} em grupo`,
        `Seu chamado foi ${novoStatus.toLowerCase()} junto com o agrupador.`,
        { agrupadorId },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }
  }
}
