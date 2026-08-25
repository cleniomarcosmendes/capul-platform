import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateChamadoDto } from '../dto/create-chamado.dto.js';
import { UpdateChamadoHeaderDto } from '../dto/update-chamado-header.dto.js';
import { UpdateClienteSacDto } from '../dto/update-cliente-sac.dto.js';
import { TransferirEquipeDto, TransferirTecnicoDto } from '../dto/transferir-chamado.dto.js';
import { ComentarioChamadoDto } from '../dto/comentario-chamado.dto.js';
import { ResolverChamadoDto, ReabrirChamadoDto, CsatDto } from '../dto/resolver-chamado.dto.js';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { getDeptoIdsDoUser } from '../../common/helpers/departamento-filter.helper.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { EmailEnvolvidosService } from '../../email/email-envolvidos.service.js';
import * as emailTpl from '../../email/email-templates.js';
import { ChamadoHelpersService } from './chamado-helpers.service.js';
import { ChamadoAgrupamentoService } from './chamado-agrupamento.service.js';
import { ChamadoTempoService } from './chamado-tempo.service.js';
import { ProtheusService } from '../../protheus/protheus.service.js';
import { chamadoInclude, UPLOADS_DIR } from './chamado.constants.js';
import { isGestor, isTI, hasStaffPerfilEmTI, getDeptosOndeStaff, getDeptosOndeGestor, getRoleNoDepto, ehStaffNoDepto, ehGestorNoDepto } from '../../common/constants/roles.constant.js';
import { hasCapability } from '../../common/helpers/capability.helper.js';
import { Prisma, StatusChamado, Visibilidade } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

/** Origem de um match da busca profunda (PR2) — alimenta badge + snippet. */
interface BuscaMatch {
  campo: 'historico';
  tipo: string;
  trecho: string;
}

/**
 * Janela de ~`contexto` chars em volta da 1ª ocorrência do termo, com
 * reticências nas pontas. O frontend destaca o termo dentro do trecho.
 */
function extrairTrecho(texto: string, termo: string, contexto = 60): string {
  const idx = texto.toLowerCase().indexOf(termo.toLowerCase());
  if (idx < 0) {
    return texto.length > contexto * 2 ? texto.slice(0, contexto * 2) + '…' : texto;
  }
  const ini = Math.max(0, idx - contexto);
  const fim = Math.min(texto.length, idx + termo.length + contexto);
  return (ini > 0 ? '…' : '') + texto.slice(ini, fim) + (fim < texto.length ? '…' : '');
}

@Injectable()
export class ChamadoCoreService {
  private readonly logger = new Logger(ChamadoCoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
    private readonly emailEnvolvidos: EmailEnvolvidosService,
    private readonly helpers: ChamadoHelpersService,
    private readonly tempo: ChamadoTempoService,
    private readonly agrupamento: ChamadoAgrupamentoService,
    private readonly protheus: ProtheusService,
  ) {}

  // ─── Coletar todos os envolvidos no chamado (para notificacoes) ───
  // Inclui solicitante, tecnico atual, colaboradores (T.I.) e copias (extras).
  // Copias entraram em 13/05/2026 — ver feature "Em copia" no chamado.
  private async getDestinatariosChamado(
    chamadoId: string,
    excluirIds: string[],
  ): Promise<string[]> {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: {
        solicitanteId: true,
        tecnicoId: true,
        colaboradores: { select: { usuarioId: true } },
        copias: { select: { usuarioId: true } },
      },
    });
    if (!chamado) return [];

    const ids = new Set<string>();
    ids.add(chamado.solicitanteId);
    if (chamado.tecnicoId) ids.add(chamado.tecnicoId);
    for (const c of chamado.colaboradores) ids.add(c.usuarioId);
    for (const c of chamado.copias) ids.add(c.usuarioId);

    for (const id of excluirIds) ids.delete(id);
    return Array.from(ids);
  }

  // ─── Helpers de e-mail (Sub-fase 3 do plano e-mail aos envolvidos) ───
  // Os 2 abaixo encapsulam: lista de envolvidos → filtro PRIVADO (sem cópias) →
  // template HTML → chamada ao EmailEnvolvidosService. A pref do destinatário
  // (default opt-in) é aplicada lá dentro.
  private async dispararEmailStatusChamado(
    chamadoId: string,
    chamado: { numero: number; titulo: string; visibilidade: Visibilidade },
    user: JwtPayload,
    statusAnterior: string,
    statusNovo: string,
  ): Promise<void> {
    const ids = await this.colherEnvolvidosParaEmail(chamadoId, chamado.visibilidade, [user.sub]);
    if (ids.length === 0) return;
    const autor = await this.nomeDoEmissor(user.sub);
    await this.emailEnvolvidos.enviar({
      canal: 'chamados',
      emissorId: user.sub,
      destinatarioIds: ids,
      subject: `[Chamado #${chamado.numero}] ${chamado.titulo}`,
      html: emailTpl.chamadoStatus({
        numero: chamado.numero,
        titulo: chamado.titulo,
        autor,
        statusAnterior,
        statusNovo,
        chamadoId,
      }),
    });
  }

  private async dispararEmailAtribuicao(
    chamadoId: string,
    chamado: { numero: number; titulo: string; visibilidade: Visibilidade },
    user: JwtPayload,
    tecnicoNome: string,
  ): Promise<void> {
    const ids = await this.colherEnvolvidosParaEmail(chamadoId, chamado.visibilidade, [user.sub]);
    if (ids.length === 0) return;
    const autor = await this.nomeDoEmissor(user.sub);
    await this.emailEnvolvidos.enviar({
      canal: 'chamados',
      emissorId: user.sub,
      destinatarioIds: ids,
      subject: `[Chamado #${chamado.numero}] ${chamado.titulo}`,
      html: emailTpl.chamadoAtribuicao({
        numero: chamado.numero,
        titulo: chamado.titulo,
        autor,
        tecnico: tecnicoNome,
        chamadoId,
      }),
    });
  }

  private async colherEnvolvidosParaEmail(
    chamadoId: string,
    visibilidade: Visibilidade,
    excluirIds: string[],
  ): Promise<string[]> {
    const ids = await this.getDestinatariosChamado(chamadoId, excluirIds);
    if (visibilidade !== 'PRIVADO') return ids;
    const copias = await this.prisma.chamadoCopia.findMany({
      where: { chamadoId },
      select: { usuarioId: true },
    });
    if (copias.length === 0) return ids;
    const copiasIds = new Set(copias.map((c) => c.usuarioId));
    return ids.filter((uid) => !copiasIds.has(uid));
  }

  private async nomeDoEmissor(userId: string): Promise<string> {
    const u = await this.prisma.usuario.findUnique({ where: { id: userId }, select: { nome: true } });
    return u?.nome ?? 'Sistema';
  }

  async findAll(user: JwtPayload, role: string, filters: {
    status?: StatusChamado | string;
    equipeId?: string;
    visibilidade?: Visibilidade;
    meusChamados?: boolean;
    projetoId?: string;
    filialId?: string;
    departamentoId?: string;
    pendentesAvaliacao?: boolean;
    search?: string;
    tecnicoId?: string;
    dataInicio?: string;
    dataFim?: string;
    /**
     * Paginação (introduzida em 23/04/2026 após chamados passarem de 500 em
     * produção). Padrão: página 1, 50 por página. `pageSize` aceita até 200
     * para permitir export/visualização consolidada, mas o client padrão fica
     * em 50 para manter a UI ágil.
     */
    page?: number;
    pageSize?: number;
    /**
     * Ordenação por clique no header (10/05/2026). Whitelist de colunas
     * impede SQL injection via query param. Default mantido: createdAt desc.
     */
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    /**
     * Inclui chamados em status AGRUPADO na listagem. Default false
     * (filhos ficam "escondidos" — operacao acontece no agrupador).
     * Decidido em 13/05/2026.
     */
    incluirAgrupados?: boolean;
    /**
     * S15.2 (25/05) — Workspace ATIVO da sessão (header X-Workspace-Id).
     * Null/undefined → fallback S13/S14 (user vê união de todos os perfis).
     * String → intersect final `departamentoId = workspaceAtivoId`.
     */
    workspaceAtivoId?: string | null;
  }) {
    const where: Record<string, unknown> = {};
    // Termo de busca — no escopo do metodo: o filtro "Meus Chamados" e o
    // enriquecimento pos-query (anexarMatchHistorico) tambem usam.
    const searchTerm = filters.search?.trim();

    if (filters.pendentesAvaliacao) {
      where.solicitanteId = user.sub;
      where.status = { in: ['RESOLVIDO', 'FECHADO'] };
      where.notaSatisfacao = null;
    } else {
      if (filters.status) {
        // `incluirAgrupados` é ortogonal ao filtro de status: ele SOMA AGRUPADO
        // ao conjunto filtrado (a menos que o próprio status escolhido já seja
        // AGRUPADO). Bug 20/05/2026: o `else if` abaixo nunca disparava quando
        // havia status (caso default `ATIVOS`), então o checkbox não influenciava
        // a lista. Agora composição é aditiva.
        if ((filters.status as string) === 'ATIVOS') {
          const atvs = ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'PENDENTE_USUARIO', 'REABERTO'];
          if (filters.incluirAgrupados) atvs.push('AGRUPADO');
          where.status = { in: atvs };
        } else if ((filters.status as string) === 'AGRUPADO') {
          where.status = 'AGRUPADO';
        } else if (filters.incluirAgrupados) {
          where.status = { in: [filters.status, 'AGRUPADO'] };
        } else {
          where.status = filters.status;
        }
      } else if (!filters.incluirAgrupados) {
        // Sem filtro de status: por default excluir AGRUPADO (filho fica escondido).
        where.NOT = { status: 'AGRUPADO' };
      }
      if (filters.equipeId) where.equipeAtualId = filters.equipeId;
      if (filters.visibilidade) where.visibilidade = filters.visibilidade;
      if (filters.projetoId) where.projetoId = filters.projetoId;
      if (filters.filialId) where.filialId = filters.filialId;
      // Filtro "Departamento" da tela = departamento de QUEM ABRIU o chamado
      // (bate com a coluna "Depto" = solicitante.departamentoId). NÃO filtra pelo
      // depto-dono do workspace (chamado.departamentoId) — senão só o depto que
      // ATENDE (ex.: T.I.) casaria, e nenhum chamado é "dono" de Financeiro etc.
      // O escopo por workspace é feito à parte (workspaceAtivoId).
      if (filters.departamentoId) where.solicitante = { departamentoId: filters.departamentoId };
      if (filters.tecnicoId) where.tecnicoId = filters.tecnicoId;

      if (filters.dataInicio || filters.dataFim) {
        const range: Record<string, Date> = {};
        if (filters.dataInicio) range.gte = new Date(filters.dataInicio);
        if (filters.dataFim) {
          const fim = new Date(filters.dataFim);
          fim.setHours(23, 59, 59, 999);
          range.lte = fim;
        }
        // Filtro por "atividade no período" (decisão 14/05/2026): inclui
        // chamado aberto E chamados com qualquer movimento (reabertura,
        // comentário, transferência) dentro do range, mesmo que abertos antes.
        // Caso real: chamado #152 aberto 13/05, reaberto 14/05 — sumia ao
        // filtrar 14/05 porque o filtro olhava só createdAt. Agora aparece.
        const dateCondition = { OR: [{ createdAt: range }, { updatedAt: range }] };
        if (where.AND) {
          (where.AND as object[]).push(dateCondition);
        } else if (where.OR) {
          where.AND = [{ OR: where.OR }, dateCondition];
          delete where.OR;
        } else {
          where.AND = [dateCondition];
        }
      }

      // Para roles nao-staff, restringir as filiais vinculadas ao usuario.
      // S12 (25/05): `hasStaffPerfilEmTI(user)` substitui o check baseado em
      // role denormalizado — multi-perfil (Juliana = GESTOR/CTL +
      // USUARIO_FINAL/T.I.) precisa ser tratado como NÃO-staff pra filiais.
      const isStaff = isGestor(role) || hasStaffPerfilEmTI(user);
      if (!isStaff && !filters.filialId) {
        const userFiliais = await this.prisma.$queryRaw<{ filial_id: string }[]>`
          SELECT filial_id FROM core.usuario_filiais WHERE usuario_id = ${user.sub}
        `;
        const filialIds = userFiliais.map((f) => f.filial_id);
        if (filialIds.length > 0) {
          where.filialId = { in: filialIds };
        } else if (user.filialId) {
          // Fallback: filial do JWT
          where.filialId = user.filialId;
        }
      }

      if (role === 'USUARIO_FINAL') {
        where.solicitanteId = user.sub;
        where.visibilidade = 'PUBLICO';
      } else if (['USUARIO_CHAVE', 'TERCEIRIZADO'].includes(role)) {
        // Workspace Onda 2 C2.9 (24/05) — adicionado `equipeAtualId IN
        // equipes_membro`: USUARIO_CHAVE/TERCEIRIZADO que é membro ativo
        // de uma equipe vê os chamados que essa equipe atende, mesmo sem
        // ter perfil naquele depto-workspace. Exemplo: Juliana Marques é
        // USUARIO_CHAVE/T.I. mas membro da equipe CTL (Controladoria);
        // antes só via #170 (que abriu), agora vê também #181/#182 (CTL).
        const equipesMembroUC = await this.prisma.membroEquipe.findMany({
          where: { usuarioId: user.sub, status: 'ATIVO' },
          select: { equipeId: true },
        });
        const equipeIdsUC = equipesMembroUC.map((m) => m.equipeId);
        where.OR = [
          { solicitanteId: user.sub },
          { tecnicoId: user.sub },
          { colaboradores: { some: { usuarioId: user.sub } } },
          ...(equipeIdsUC.length > 0 ? [{ equipeAtualId: { in: equipeIdsUC } }] : []),
        ];
        // Cinto-e-suspensório (14/05/2026): chamado PRIVADO é staff-only.
        // Mesmo que TI vincule um USUARIO_CHAVE/TERCEIRIZADO por engano,
        // ele não enxerga PRIVADO na listagem. Criação já é restrita a
        // ROLES_PODE_PRIVADO; este é o filtro de leitura espelhado.
        where.visibilidade = 'PUBLICO';
      } else if (filters.meusChamados && !searchTerm) {
        // `!searchTerm`: com termo digitado a busca e GLOBAL (decisao 22/05) —
        // ignora "Meus Chamados" p/ achar o termo em qualquer chamado. As
        // restricoes de seguranca (USUARIO_FINAL / UC / TERC, acima) seguem.
        where.OR = [
          { solicitanteId: user.sub },
          { tecnicoId: user.sub },
          { colaboradores: { some: { usuarioId: user.sub } } },
        ];
      } else if (!filters.equipeId && !hasStaffPerfilEmTI(user)) {
        // S12 (25/05) — substituído `isTI(role)` por `hasStaffPerfilEmTI(user)`.
        // Incidente Juliana: role denormalizada vinha 'GESTOR' (do perfil CTL),
        // isTI('GESTOR')=true → este else-if era pulado → Layer 2 sozinho deixava
        // todos os chamados de T.I. passarem (T.I. ∈ deptos dela por causa do
        // perfil USUARIO_FINAL/T.I.). Agora classifica corretamente como
        // não-staff TI → restringe ao escopo "equipes-membro + pessoal".
        //
        // `solicitanteId` somado ao OR (S12) — antes o caminho assumia que
        // staff TI não abre chamados, mas agora pode entrar usuário multi-perfil
        // que TAMBÉM é solicitante (Juliana abriu #170 e precisa vê-lo).
        const minhasEquipes = await this.prisma.membroEquipe.findMany({
          where: { usuarioId: user.sub, status: 'ATIVO' },
          select: { equipeId: true },
        });
        const equipeIds = minhasEquipes.map((e) => e.equipeId);
        where.OR = [
          { solicitanteId: user.sub },
          { tecnicoId: user.sub },
          { colaboradores: { some: { usuarioId: user.sub } } },
          ...(equipeIds.length > 0 ? [{ equipeAtualId: { in: equipeIds } }] : []),
        ];
      }
    }

    // Busca: numero exato (se numerico) + titulo + descricao + nome do
    // solicitante + busca profunda no historico/comentarios do chamado
    // (PR2 — pg_trgm). `histVisibilidade` reusado no enriquecimento pos-query.
    // Visibilidade D29: nao-staff TI so casa historico publico — sem isto a
    // busca profunda varreria nota interna e viraria vazamento.
    // S12 — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`. Multi-perfil
    // não-staff TI (Juliana) precisa ter histórico privado escondido da busca
    // profunda (era vazamento pré-S12).
    const histVisibilidade: Prisma.HistoricoChamadoWhereInput = hasStaffPerfilEmTI(user)
      ? {}
      : { publico: true };

    if (searchTerm) {
      const numero = parseInt(searchTerm, 10);
      const orClauses: Record<string, unknown>[] = [
        { titulo: { contains: searchTerm, mode: 'insensitive' } },
        { descricao: { contains: searchTerm, mode: 'insensitive' } },
        { solicitante: { nome: { contains: searchTerm, mode: 'insensitive' } } },
        // CLIENTE externo (SAC e Venda Ativa): digitar a matrícula do SA1010 ou o
        // nome do cliente traz os chamados dele. É o que responde "todos os contatos
        // deste cliente" sem precisar de tela nova — reusa a busca que o usuário já
        // conhece. A visibilidade do chamado continua sendo a da própria listagem.
        { clienteMatricula: { contains: searchTerm, mode: 'insensitive' } },
        { clienteNome: { contains: searchTerm, mode: 'insensitive' } },
        // Busca profunda: varre comentarios/historico (campo descricao).
        // Visibilidade por role aplicada via histVisibilidade.
        {
          historicos: {
            some: {
              descricao: { contains: searchTerm, mode: 'insensitive' },
              ...histVisibilidade,
            },
          },
        },
      ];
      if (numero) orClauses.unshift({ numero });
      const searchCondition = { OR: orClauses };

      // Compat com filtro de data acima (que pode ter criado where.AND).
      if (where.AND) {
        (where.AND as object[]).push(searchCondition);
      } else if (where.OR) {
        where.AND = [{ OR: where.OR }, searchCondition];
        delete where.OR;
      } else {
        Object.assign(where, searchCondition);
      }
    }

    // Paginação: default 1 × 50; teto 200 para proteger contra payloads
    // muito grandes. count e findMany no mesmo $transaction para consistência
    // (evita total que não bate com a página retornada se houver insert entre
    // as duas queries).
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

    // Whitelist de ordenação (10/05/2026): protege contra SQL injection via
    // query param e mapeia colunas amigáveis pra estrutura Prisma (alguns
    // campos são em relations, ex.: filial.nome via JOIN).
    const SORT_MAP: Record<string, Record<string, unknown>> = {
      numero: { numero: filters.sortOrder ?? 'asc' },
      titulo: { titulo: filters.sortOrder ?? 'asc' },
      status: { status: filters.sortOrder ?? 'asc' },
      prioridade: { prioridade: filters.sortOrder ?? 'asc' },
      createdAt: { createdAt: filters.sortOrder ?? 'desc' },
      updatedAt: { updatedAt: filters.sortOrder ?? 'desc' },
      filial: { filial: { nome: filters.sortOrder ?? 'asc' } },
      equipe: { equipeAtual: { nome: filters.sortOrder ?? 'asc' } },
      tecnico: { tecnico: { nome: filters.sortOrder ?? 'asc' } },
      solicitante: { solicitante: { nome: filters.sortOrder ?? 'asc' } },
      departamento: { departamento: { nome: filters.sortOrder ?? 'asc' } },
    };
    // Default: ordenar por ultima atividade (updatedAt) — chamado reaberto,
    // comentado ou transferido sobe ao topo. Decidido em 13/05/2026 pos
    // feedback do Clenio: chamado reaberto antigo nao aparecia no topo.
    const orderBy = (filters.sortBy && SORT_MAP[filters.sortBy])
      ? SORT_MAP[filters.sortBy]
      : { updatedAt: 'desc' as const };

    // Workspace Onda 2 C2.7 + C2.9 (24/05) — visibilidade do chamado.
    // Regra: user vê chamado SE for solicitante OU técnico OU colaborador
    // OU SE o chamado pertencer a depto onde ele tem perfil no Workspace
    // OU SE for membro ativo da equipe atual (C2.9). ADMIN escapa (D36).
    //
    // Ultrareview bug_001 fix (24/05): `tecnicoId` e `colaboradores` foram
    // adicionados ao OR pra preservar visibilidade de UC/TERC adicionados
    // como colab cross-depto (Layer 1 acima já mantém esses casos; sem
    // espelhar aqui, o AND filtrava chamados que `adicionarColaborador`
    // havia autorizado explicitamente — regressão pós-C2.9).
    const deptoIds = getDeptoIdsDoUser(user, role);
    let whereFiltrado: Record<string, unknown> = where;
    if (deptoIds !== null) {
      const equipesAtivasUser = await this.prisma.membroEquipe.findMany({
        where: { usuarioId: user.sub, status: 'ATIVO' },
        select: { equipeId: true },
      });
      const equipeIds = equipesAtivasUser.map((m) => m.equipeId);
      // S12 (25/05) + refino S13a (25/05) — visão "abre por estar no depto"
      // só faz sentido pra deptos onde o user é STAFF (ADMIN/GESTOR/SUPORTE).
      // Pra Juliana (GESTOR/CTL + USUARIO_FINAL/TI): deptosStaff=[CTL], então
      // ela vê todos chamados de CTL via depto + seus chamados em TI. Antes
      // o S12 zerava o filtro inteiro pra não-staffTI — agora restringe pelos
      // deptos onde ela é staff (mais correto: gestor CTL vê CTL completo).
      const ehStaffTI = hasStaffPerfilEmTI(user);
      const deptosStaff = getDeptosOndeStaff(user);
      // Visibilidade restrita por equipe (18/06): a cláusula "vejo todos os
      // chamados do meu depto-staff" ganha um carve-out — chamado de equipe
      // `restritaVisibilidade` só passa por aqui se eu for GESTOR/ADMIN do
      // depto (gestor do workspace navega todas as equipes) OU membro da
      // equipe. SUPORTE não-membro não vê. Solicitante/técnico/colaborador
      // (cláusulas acima) seguem vendo, restrita ou não.
      const deptosGestor = getDeptosOndeGestor(user);
      const deptosSuporteOnly = deptosStaff.filter((d) => !deptosGestor.includes(d));
      const deptoStaffClauses: Record<string, unknown>[] = [];
      if (deptosGestor.length > 0) {
        // GESTOR/ADMIN do depto: vê tudo do depto (inclusive equipe restrita).
        deptoStaffClauses.push({ departamentoId: { in: deptosGestor } });
      }
      if (deptosSuporteOnly.length > 0) {
        // SUPORTE: vê o depto, MENOS chamados de equipe restrita de que não é membro.
        deptoStaffClauses.push({
          AND: [
            { departamentoId: { in: deptosSuporteOnly } },
            {
              OR: [
                { equipeAtual: { is: { restritaVisibilidade: false } } },
                // (removido `{ equipeAtualId: null }` — equipeAtualId é NÃO-nulável;
                //  além de inútil, o Prisma rejeitava com "Argument `equipeAtualId`
                //  is missing" → 500 na listagem pra SUPORTE não-gestor de um depto.)
                ...(equipeIds.length > 0 ? [{ equipeAtualId: { in: equipeIds } }] : []),
              ],
            },
          ],
        });
      }
      const orVisibilidade: Record<string, unknown>[] = [
        { solicitanteId: user.sub },
        { tecnicoId: user.sub },
        { colaboradores: { some: { usuarioId: user.sub } } },
        // SAC Fase 1 (camada 5): quem está EM CÓPIA vê o chamado na LISTAGEM, não
        // só no detalhe (findOne já liberava via isCopiado). Sem isto, o apoiador
        // do SAC puxado por cópia não via o chamado na lista dele. Copiado é
        // sempre não-TI → o S12 abaixo já restringe a visibilidade=PUBLICO.
        { copias: { some: { usuarioId: user.sub } } },
        ...(equipeIds.length > 0 ? [{ equipeAtualId: { in: equipeIds } }] : []),
        ...deptoStaffClauses,
      ];
      const andClauses: Record<string, unknown>[] = [where, { OR: orVisibilidade }];
      // S12 — força visibilidade=PUBLICO se não-staff TI (defesa em
      // profundidade contra qualquer caminho Layer 1 que pule o filtro).
      if (!ehStaffTI) {
        andClauses.push({ visibilidade: 'PUBLICO' });
      }
      whereFiltrado = { AND: andClauses };
    }

    // S15.2 — Intersect com workspace ATIVO no final (sem mexer nos Layer
    // 1/2 existentes — eles continuam funcionando como fallback). Pra
    // Juliana com ativo=TI: vê só seus chamados em TI (#170). Sem ativo:
    // vê os 3 do fallback S13.
    const whereFinal = filters.workspaceAtivoId
      ? { AND: [whereFiltrado, { departamentoId: filters.workspaceAtivoId }] }
      : whereFiltrado;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.chamado.count({ where: whereFinal }),
      this.prisma.chamado.findMany({
        where: whereFinal,
        include: chamadoInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    if (!searchTerm) return { items, total, page, pageSize };
    // Enriquecimento pos-busca: anexa a origem do match (badge + snippet).
    const itemsComMatch = await this.anexarMatchHistorico(items, searchTerm, histVisibilidade);
    return { items: itemsComMatch, total, page, pageSize };
  }

  /**
   * Enriquecimento pos-busca profunda (PR2): para os chamados da pagina,
   * anexa `buscaMatch` quando o termo casou no historico/comentarios — com o
   * trecho em volta do termo, para o badge + snippet do frontend. So roda
   * quando ha `searchTerm`. Uma query extra (IN dos ids da pagina), acelerada
   * pelo indice GIN trgm de historicos_chamado.descricao (PR1).
   */
  private async anexarMatchHistorico<T extends { id: string }>(
    items: T[],
    termo: string,
    histVisibilidade: Prisma.HistoricoChamadoWhereInput,
  ): Promise<(T & { buscaMatch?: BuscaMatch })[]> {
    if (items.length === 0) return items;
    const historicos = await this.prisma.historicoChamado.findMany({
      where: {
        chamadoId: { in: items.map((c) => c.id) },
        descricao: { contains: termo, mode: 'insensitive' },
        ...histVisibilidade,
      },
      select: { chamadoId: true, descricao: true, tipo: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    // 1 match por chamado — o historico visivel mais recente que casou.
    const porChamado = new Map<string, { tipo: string; descricao: string }>();
    for (const h of historicos) {
      if (h.descricao && !porChamado.has(h.chamadoId)) {
        porChamado.set(h.chamadoId, { tipo: h.tipo, descricao: h.descricao });
      }
    }
    return items.map((c) => {
      const hit = porChamado.get(c.id);
      if (!hit) return c;
      return {
        ...c,
        buscaMatch: {
          campo: 'historico' as const,
          tipo: hit.tipo,
          trecho: extrairTrecho(hit.descricao, termo),
        },
      };
    });
  }

  async findOne(id: string, user: JwtPayload, role: string) {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id },
      include: {
        ...chamadoInclude,
        historicos: {
          include: {
            usuario: { select: { id: true, nome: true, username: true } },
            equipeOrigem: { select: { id: true, nome: true, sigla: true } },
            equipeDestino: { select: { id: true, nome: true, sigla: true } },
          },
          // Mais recente em cima (chat-style TOTVS — decisao 13/05/2026).
          orderBy: { createdAt: 'desc' },
        },
        colaboradores: {
          include: { usuario: { select: { id: true, nome: true, username: true } } },
        },
        copias: {
          include: {
            usuario: { select: { id: true, nome: true, username: true } },
            adicionadoPor: { select: { id: true, nome: true, username: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        chamadoAgrupador: {
          select: { id: true, numero: true, titulo: true, status: true },
        },
        chamadosAgrupados: {
          select: {
            id: true, numero: true, titulo: true, status: true,
            statusAnteriorAgrupamento: true, slaPausadoEm: true,
            solicitante: { select: { id: true, nome: true } },
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        registrosTempo: {
          where: { horaFim: null },
          select: { id: true, usuarioId: true, horaInicio: true },
        },
      },
    });

    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    if (role === 'USUARIO_FINAL') {
      // Copiados tem papel de solicitante: leem o chamado mesmo nao sendo
      // dono. Decidido em 13/05/2026 (feature "Em copia").
      const isCopiado = chamado.copias.some((c) => c.usuarioId === user.sub);
      if (chamado.solicitanteId !== user.sub && !isCopiado) {
        throw new ForbiddenException('Sem acesso a este chamado');
      }
    }

    // Cinto-e-suspensório (14/05/2026): PRIVADO é staff-only no detalhe
    // também. Criação já é restrita a ROLES_PODE_PRIVADO; aqui bloqueia
    // acesso via link direto caso TI vincule non-staff por engano.
    // S12 — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`. Multi-perfil
    // GESTOR de outro depto (Juliana/CTL) NÃO é staff TI → não pode ver
    // PRIVADO mesmo via link direto.
    if (chamado.visibilidade === 'PRIVADO' && !hasStaffPerfilEmTI(user)) {
      throw new ForbiddenException('Chamado privado — acesso restrito a equipe de TI');
    }

    // Filtro de comentário interno (14/05/2026 — fix): qualquer role
    // NÃO-staff só vê comentários públicos. Antes só filtrava USUARIO_FINAL
    // — USUARIO_CHAVE e TERCEIRIZADO podiam virar solicitante/em-cópia/
    // colaborador e enxergavam comentários internos da equipe T.I.
    // (vazamento). Regra única S12 (25/05): staff = `hasStaffPerfilEmTI(user)`
    // — multi-perfil precisa ser detectado pelo JWT.departamentos[], não pela
    // role denormalizada (incidente Juliana).
    if (!hasStaffPerfilEmTI(user)) {
      chamado.historicos = chamado.historicos.filter((h) => h.publico);
    }

    return chamado;
  }

  async create(dto: CreateChamadoDto, user: JwtPayload, role: string) {
    // Identificação do colaborador (perfil PADRAO): a matrícula só é aceita se
    // a senha do portal RH conferir. Defesa em profundidade — a tela já valida,
    // mas o backend não confia no cliente (request manipulado poderia abrir
    // chamado em nome de outra matrícula). A senha é transiente: validada aqui
    // e descartada, NUNCA persistida. Se o Protheus estiver fora, não bloqueia
    // o atendimento (libera, igual ao fallback do autofill de nome).
    if (dto.matriculaColaborador) {
      if (!dto.senhaColaborador) {
        throw new BadRequestException('Informe a senha do colaborador para validar a matrícula.');
      }
      const r = await this.protheus.validarCredencialPortal(
        dto.matriculaColaborador,
        dto.senhaColaborador,
      );
      if (!r.valida && r.motivo === 'CREDENCIAIS_INVALIDAS') {
        throw new BadRequestException('Matrícula ou senha inválida.');
      }
      // r.motivo === 'INDISPONIVEL' → Protheus fora: segue sem bloquear.
    }

    const equipe = await this.prisma.equipe.findUnique({
      where: { id: dto.equipeAtualId },
    });
    if (!equipe) throw new BadRequestException('Equipe nao encontrada');

    // SAC (Fase 1) — guard "roster não roteável": equipe de apoio SAC é só
    // catálogo de apoiadores (puxados em cópia), nunca recebe chamado.
    if (equipe.apoioSac) {
      throw new BadRequestException('Equipe de apoio SAC é catálogo de apoiadores — não recebe chamados. Selecione a equipe operadora.');
    }

    // Equipe PRIVADA: só staff (ADMIN/GESTOR/SUPORTE) do PRÓPRIO departamento
    // — ou quem tem OVERSIGHT_PLATAFORMA — pode abrir chamado direto. Usuário
    // final/chave/terceirizado e staff de outros deptos passam pela equipe de
    // suporte (pública), que tria e transfere. Defesa em profundidade: o
    // frontend já oculta via GET /equipes/abertura; aqui revalida contra
    // request manipulado. (Substitui o antigo gate aceitaChamadoExterno.)
    if (
      equipe.privada &&
      !getDeptosOndeStaff(user).includes(equipe.departamentoId) &&
      !hasCapability(user, 'OVERSIGHT_PLATAFORMA')
    ) {
      throw new ForbiddenException(
        'Esta equipe é privada — apenas o próprio departamento pode abrir chamado direto. Selecione a equipe de suporte.',
      );
    }

    // Visibilidade PRIVADO restrita a equipe de TI (ROLES_TI). Outros roles
    // (USUARIO_FINAL, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA, USUARIO_CHAVE,
    // TERCEIRIZADO) só podem criar PUBLICO — solicitante tem direito de
    // acompanhar. Defesa em profundidade — frontend já oculta a opção,
    // backend valida pra defender contra request manipulado.
    const ROLES_PODE_PRIVADO = ['ADMIN', 'GESTOR', 'SUPORTE'];
    const visibilidade = dto.visibilidade ?? 'PUBLICO';

    if (visibilidade === 'PRIVADO' && !ROLES_PODE_PRIVADO.includes(role)) {
      throw new ForbiddenException(
        'Apenas equipe de TI (ADMIN/GESTOR_TI/SUPORTE_TI) pode criar chamados PRIVADOS',
      );
    }

    const sla = await this.prisma.slaDefinicao.findUnique({
      where: {
        equipeId_prioridade: {
          equipeId: dto.equipeAtualId,
          prioridade: dto.prioridade ?? 'MEDIA',
        },
      },
    });

    const dataLimiteSla = sla
      ? new Date(Date.now() + sla.horasResolucao * 60 * 60 * 1000)
      : null;

    // Auto-preencher nomes a partir do portfolio (integracao retroativa)
    let softwareNome = dto.softwareNome;
    let moduloNome = dto.moduloNome;

    if (dto.softwareId && !softwareNome) {
      const sw = await this.prisma.software.findUnique({ where: { id: dto.softwareId }, select: { nome: true } });
      if (sw) softwareNome = sw.nome;
    }
    if (dto.softwareModuloId && !moduloNome) {
      const mod = await this.prisma.softwareModulo.findUnique({ where: { id: dto.softwareModuloId }, select: { nome: true } });
      if (mod) moduloNome = mod.nome;
    }

    // Filial do SOLICITANTE — técnico pode informar outra ao abrir em nome
    // de outro setor (label do form "Filial do solicitante").
    let filialId = user.filialId;

    if (role !== 'USUARIO_FINAL' && dto.filialId) {
      const filial = await this.prisma.filial.findUnique({ where: { id: dto.filialId } });
      if (!filial) throw new BadRequestException('Filial nao encontrada');
      filialId = dto.filialId;
    }

    // Workspace Onda 2 C2.7 — `chamado.departamentoId` é o depto-dono
    // (workspace que ATENDE), derivado SEMPRE da equipe escolhida.
    // `dto.departamentoId` (campo "Departamento do solicitante" no form) é
    // ignorado aqui — segue como info visual no form mas não define dono.
    const departamentoId = equipe.departamentoId ?? undefined;

    // Auto-assumir o chamado só quando o solicitante é membro ATIVO da própria
    // EQUIPE escolhida na abertura (equipeAtualId). USUARIO_CHAVE e TERCEIRIZADO
    // nunca auto-assumem (não são membros de equipe; guard explícito como reforço).
    //
    // Workspace (fix deploy 01/06) — antes usava a `role` denormalizada do JWT,
    // que p/ users multi-workspace reflete a role no PRIMEIRO depto. Resultado:
    // um user do Setor Fiscal abrindo chamado PARA a T.I. nascia EM_ATENDIMENTO
    // assumido por ele. Refino (mesma sessão): mesmo dentro da T.I. há várias
    // equipes — um técnico de uma equipe abrindo chamado PARA OUTRA equipe não
    // deve auto-assumir. O sinal preciso é o pertencimento à equipe-alvo (vem do
    // banco, independe da role denormalizada): se ele não é membro da equipe
    // selecionada, o chamado nasce ABERTO pra um membro real daquela equipe pegar.
    const rolesNaoAssumem = ['USUARIO_FINAL', 'USUARIO_CHAVE', 'TERCEIRIZADO'];
    const membroDaEquipe = await this.prisma.membroEquipe.findUnique({
      where: { usuarioId_equipeId: { usuarioId: user.sub, equipeId: dto.equipeAtualId } },
      select: { status: true },
    });
    // Role do user no depto-dono (fallback p/ role principal em token antigo).
    const roleNoDeptoDono = getRoleNoDepto(user, departamentoId) ?? role;
    const autoAssumir =
      membroDaEquipe?.status === 'ATIVO' && !rolesNaoAssumem.includes(roleNoDeptoDono);

    const chamado = await this.prisma.chamado.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        visibilidade,
        prioridade: dto.prioridade ?? 'MEDIA',
        status: autoAssumir ? 'EM_ATENDIMENTO' : 'ABERTO',
        solicitanteId: user.sub,
        tecnicoId: autoAssumir ? user.sub : undefined,
        equipeAtualId: dto.equipeAtualId,
        filialId,
        departamentoId,
        softwareNome,
        moduloNome,
        softwareId: dto.softwareId,
        softwareModuloId: dto.softwareModuloId,
        catalogoServicoId: dto.catalogoServicoId,
        projetoId: dto.projetoId,
        ativoId: dto.ativoId,
        ipMaquina: dto.ipMaquina,
        matriculaColaborador: dto.matriculaColaborador,
        nomeColaborador: dto.nomeColaborador?.trim() || undefined,
        // Cliente externo — SAC e Venda Ativa. Matrícula normalizada em maiúsculas
        // (o SA1010 usa código alfanumérico) para a consulta por cliente casar.
        clienteMatricula: dto.clienteMatricula?.trim().toUpperCase() || undefined,
        clienteNome: dto.clienteNome?.trim() || undefined,
        clienteEmail: dto.clienteEmail?.trim() || undefined,
        clienteTelefone: dto.clienteTelefone?.trim() || undefined,
        canalOrigem: dto.canalOrigem,
        slaDefinicaoId: sla?.id,
        dataLimiteSla,
      },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'ABERTURA',
        descricao: 'Chamado aberto',
        publico: true,
        chamadoId: chamado.id,
        usuarioId: user.sub,
      },
    });

    // Adicionar usuarios em copia (se informados). Validacao isTI + criacao
    // dos registros + notificacao individual aos copiados ocorrem aqui para
    // que o solicitante so receba uma resposta apos o chamado estar 100%
    // configurado. Se algum copiado falhar validacao, o chamado ja foi
    // criado — copiados validos ainda sao processados.
    if (dto.copiasUsuariosIds && dto.copiasUsuariosIds.length > 0) {
      await this.adicionarCopias(chamado.id, dto.copiasUsuariosIds, user, { silenciarErrosIndividuais: false });
    }

    return chamado;
  }

  /**
   * Adiciona usuarios em copia ao chamado. Valida isTI em cada um.
   * Notifica cada copiado da inclusao (mensagem dedicada).
   */
  async adicionarCopias(
    chamadoId: string,
    usuariosIds: string[],
    user: JwtPayload,
    opts: { silenciarErrosIndividuais?: boolean } = {},
  ) {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: { id: true, numero: true, titulo: true, copias: { select: { usuarioId: true } } },
    });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    const jaCopiados = new Set(chamado.copias.map((c) => c.usuarioId));
    const novos: string[] = [];
    const erros: { usuarioId: string; motivo: string }[] = [];

    for (const usuarioId of usuariosIds) {
      if (jaCopiados.has(usuarioId)) continue;
      try {
        // Em cópia = QUALQUER usuário cadastrado (sem restrição de "não-TI"). A
        // regra antiga (assertNaoSeTI) era herança do tempo em que só existia o
        // workspace de T.I.; com Workspace multi-departamento ela não se aplica.
        // Garantir que o usuario existe (defensive)
        const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
        if (!u) {
          erros.push({ usuarioId, motivo: 'Usuario nao encontrado' });
          continue;
        }
        await this.prisma.chamadoCopia.create({
          data: { chamadoId, usuarioId, adicionadoPorId: user.sub },
        });
        novos.push(usuarioId);
      } catch (err) {
        const msg = (err as { message?: string })?.message ?? 'Erro';
        erros.push({ usuarioId, motivo: msg });
      }
    }

    // Erros: na criacao do chamado (silenciarErrosIndividuais=false) lancamos
    // BadRequest se NENHUM copiado entrou (mas chamado ja existe — UI mostra
    // mensagem amigavel). Em adicao via endpoint dedicado, retornamos relatorio.
    if (!opts.silenciarErrosIndividuais && novos.length === 0 && erros.length > 0) {
      throw new BadRequestException({
        message: 'Nenhum usuario foi adicionado em copia',
        erros,
      });
    }

    // Notificar copiados novos da inclusao (somente novos, nao reativados)
    if (novos.length > 0) {
      this.notificacaoService.criarParaUsuarios(
        novos,
        'CHAMADO_ATUALIZADO',
        `Voce foi adicionado em copia no chamado #${chamado.numero}`,
        `${this.prefixoAutor(user)}adicionou voce em copia no chamado "${chamado.titulo}". Voce recebera atualizacoes e pode comentar.`,
        { chamadoId },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return { adicionados: novos, erros };
  }

  /**
   * Versao com check de "quem pode adicionar copia" para endpoint dedicado
   * (POST /chamados/:id/copias). Aceita gestor, tecnico, colaborador,
   * solicitante e ate copiados existentes — qualquer envolvido pode
   * trazer mais gente. Erros individuais sao retornados em vez de
   * lancar (silenciarErrosIndividuais=true).
   */
  async adicionarCopiasComCheck(chamadoId: string, usuariosIds: string[], user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(chamadoId, user, role, {
      permitirSolicitante: true,
      permitirCopia: true,
    });
    return this.adicionarCopias(chamadoId, usuariosIds, user, { silenciarErrosIndividuais: true });
  }

  async listarCopias(chamadoId: string) {
    await this.helpers.getChamadoOrFail(chamadoId);
    return this.prisma.chamadoCopia.findMany({
      where: { chamadoId },
      include: {
        usuario: { select: { id: true, nome: true, username: true, email: true } },
        adicionadoPor: { select: { id: true, nome: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * SAC (Fase 1) — apoiadores elegíveis: membros ATIVOS de qualquer equipe
   * `apoioSac` (o "roster"/catálogo). É a fonte do seletor de "em cópia" do SAC.
   * Dedup por usuário (alguém pode estar em mais de uma equipe de apoio).
   */
  async listarApoiadoresSac() {
    // Reconciliação 20/06: como "em cópia = qualquer usuário" (assertNaoSeTI
    // removido), o roster inclui TODOS os membros das equipes apoioSac —
    // inclusive quem também é T.I. (não há mais bloqueio de T.I. na cópia).
    const membros = await this.prisma.membroEquipe.findMany({
      where: { status: 'ATIVO', equipe: { is: { apoioSac: true, status: 'ATIVO' } } },
      select: { usuario: { select: { id: true, nome: true, username: true, email: true } } },
      orderBy: { usuario: { nome: 'asc' } },
    });
    const vistos = new Set<string>();
    const apoiadores: { id: string; nome: string; username: string; email: string | null }[] = [];
    for (const m of membros) {
      if (!m.usuario || vistos.has(m.usuario.id)) continue;
      vistos.add(m.usuario.id);
      apoiadores.push(m.usuario);
    }
    return apoiadores;
  }

  /**
   * SAC Fase 2 — resposta ao CLIENTE por e-mail. Cria um histórico público
   * (timeline) marcando a resposta e dispara o e-mail externo (assunto
   * `[SAC-<numero>]` para preparar o threading da Fase 3). Só em chamado de
   * workspace SAC, com contato do cliente. Em DEV o envio é mockado (logado).
   */
  async responderSac(id: string, texto: string, user: JwtPayload, role: string, file?: Express.Multer.File) {
    await this.helpers.assertTecnicoOuColaborador(id, user, role);
    const chamado = await this.helpers.getChamadoOrFail(id);
    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Chamado finalizado — reabra para responder o cliente.');
    }
    // "Chamado é SAC" = a EQUIPE que o atende tem atendeSac (não o departamento —
    // um workspace pode ter equipe de SAC E de chamado normal).
    const equipe = await this.prisma.equipe.findUnique({
      where: { id: chamado.equipeAtualId },
      select: { atendeSac: true },
    });
    if (!equipe?.atendeSac) throw new BadRequestException('Este chamado não é de uma equipe de atendimento ao SAC.');
    if (!chamado.clienteEmail) {
      throw new BadRequestException('Cliente sem e-mail cadastrado — não dá para responder por e-mail.');
    }
    const corpo = (texto ?? '').trim();
    if (!corpo) throw new BadRequestException('Escreva a resposta ao cliente.');

    // Anexo (opcional): o multer já gravou em disco. Registra como AnexoChamado
    // (lastro/auditoria do SAC — fica baixável no chamado) e carrega o conteúdo
    // em base64 pra anexar no e-mail ao cliente.
    let anexoRegistro: { id: string; nomeOriginal: string } | null = null;
    let anexoEmail: { filename: string; contentBase64: string; contentType?: string }[] | undefined;
    if (file) {
      const registro = await this.prisma.anexoChamado.create({
        data: {
          nomeOriginal: file.originalname,
          nomeArquivo: file.filename,
          mimeType: file.mimetype,
          tamanho: file.size,
          descricao: 'Anexo da resposta ao cliente (SAC)',
          chamadoId: id,
          usuarioId: user.sub,
        },
        select: { id: true, nomeOriginal: true },
      });
      anexoRegistro = registro;
      try {
        const buf = fs.readFileSync(path.join(UPLOADS_DIR, file.filename));
        anexoEmail = [{ filename: file.originalname, contentBase64: buf.toString('base64'), contentType: file.mimetype }];
      } catch (err) {
        this.logger.warn(`SAC: anexo ${file.filename} salvo mas não pôde ser lido pro e-mail: ${(err as Error).message}`);
      }
    }

    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const html = '<div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a">'
      + `<p style="margin:0 0 12px">${esc(corpo).replace(/\n/g, '<br>')}</p>`
      + (anexoRegistro ? `<p style="font-size:13px;color:#475569;margin:0 0 12px">📎 Anexo: ${esc(anexoRegistro.nomeOriginal)}</p>` : '')
      + '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">'
      + `<p style="font-size:12px;color:#64748b;margin:0">CAPUL — Atendimento ao Cliente (SAC) · Protocolo <strong>[SAC-${chamado.numero}]</strong>. Responda este e-mail para falar com o SAC.</p>`
      + '</div>';
    // Envia ANTES de gravar o histórico, pra o registro refletir o resultado
    // REAL (não afirmar "enviado" quando o envio falhou/foi mockado).
    const email = await this.emailEnvolvidos.enviarExterno(
      chamado.clienteEmail,
      `[SAC-${chamado.numero}] ${chamado.titulo}`,
      html,
      anexoEmail,
    );

    const statusTxt = email.sent
      ? (email.redirected ? '↩️ Resposta ao cliente (e-mail DEV→teste)' : '↩️ Resposta ao cliente (e-mail enviado)')
      : email.mock
        ? '↩️ Resposta ao cliente (e-mail MOCKADO em DEV — NÃO enviado)'
        : '⚠️ FALHA ao enviar a resposta ao cliente (e-mail NÃO entregue — tente novamente)';
    const historico = await this.prisma.historicoChamado.create({
      data: {
        tipo: 'COMENTARIO',
        descricao: `${statusTxt} para ${chamado.clienteEmail}:\n${corpo}`
          + (anexoRegistro ? `\n📎 Anexo: ${anexoRegistro.nomeOriginal}` : ''),
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    return { historico, anexo: anexoRegistro, email };
  }

  private prefixoAutor(user: JwtPayload): string {
    const nome = (user as { nome?: string }).nome || (user as { username?: string }).username;
    return nome ? `${nome} ` : '';
  }

  async updateHeader(id: string, dto: UpdateChamadoHeaderDto, user: JwtPayload, role: string) {
    const chamado = await this.helpers.getChamadoOrFail(id);

    // Apenas o solicitante ou gestores podem editar o cabecalho
    const isCriador = chamado.solicitanteId === user.sub;
    // Gestor DO DEPARTAMENTO DO CHAMADO (25/08) — `isGestor(role)` usava a role
    // denormalizada, que é uma só para o módulo inteiro.
    if (!isCriador && !ehGestorNoDepto(user, chamado.departamentoId, role)) {
      throw new ForbiddenException('Apenas o solicitante ou gestores do departamento podem editar o cabecalho');
    }

    const data: Record<string, string> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar');
    }

    return this.prisma.chamado.update({
      where: { id },
      data,
      include: chamadoInclude,
    });
  }

  /**
   * SAC — edita os dados do cliente externo (nome/e-mail/telefone) de um chamado
   * de SAC já aberto. Permissão = staff/operador do chamado (igual ao responderSac),
   * NÃO o "solicitante ou gestor" do updateHeader (o atendente costuma não ser o
   * solicitante). Guard: só em chamado cuja EQUIPE atende SAC. Não gateia em
   * clienteEmail — é justamente o que pode estar faltando.
   */
  async atualizarDadosClienteSac(id: string, dto: UpdateClienteSacDto, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user, role);
    const chamado = await this.helpers.getChamadoOrFail(id);
    const equipe = await this.prisma.equipe.findUnique({
      where: { id: chamado.equipeAtualId },
      select: { atendeSac: true },
    });
    if (!equipe?.atendeSac) throw new BadRequestException('Este chamado não é de uma equipe de atendimento ao SAC.');

    const data: Record<string, string | null> = {};
    if (dto.clienteNome !== undefined) data.clienteNome = dto.clienteNome.trim() || null;
    if (dto.clienteEmail !== undefined) data.clienteEmail = dto.clienteEmail.trim() || null;
    if (dto.clienteTelefone !== undefined) data.clienteTelefone = dto.clienteTelefone.trim() || null;
    if (Object.keys(data).length === 0) throw new BadRequestException('Nenhum dado do cliente para atualizar.');

    const updated = await this.prisma.chamado.update({ where: { id }, data, include: chamadoInclude });
    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'COMENTARIO',
        descricao: 'Dados do cliente (SAC) atualizados.',
        publico: false,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });
    return updated;
  }

  async assumir(id: string, user: JwtPayload, role: string) {
    const chamado = await this.helpers.getChamadoOrFail(id);

    // ⭐ 25/08 — esta rota confiava SÓ no `@Roles('ADMIN','GESTOR','SUPORTE')` do
    // controller, que lê a role denormalizada (uma para o módulo inteiro). Quem é
    // SUPORTE no Fiscal passava nela também num chamado do T.I., onde é usuário final,
    // e virava o técnico do chamado. Quem atende é staff NAQUELE departamento.
    if (!ehStaffNoDepto(user, chamado.departamentoId, role)) {
      throw new ForbiddenException(
        'Você não atende chamados deste departamento. Só quem tem perfil de atendimento nele pode assumir.',
      );
    }

    if (!['ABERTO', 'PENDENTE', 'PENDENTE_USUARIO', 'REABERTO'].includes(chamado.status)) {
      throw new BadRequestException('Chamado nao pode ser assumido neste status');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { tecnicoId: user.sub, status: 'EM_ATENDIMENTO' },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'ASSUMIDO',
        descricao: 'Chamado assumido',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Auto-iniciar cronometro ao assumir (fecha timers anteriores)
    await this.tempo.encerrarTimersAbertos(user.sub);
    await this.prisma.registroTempoChamado.create({
      data: { horaInicio: new Date(), chamadoId: id, usuarioId: user.sub },
    });

    // Notificar envolvidos (solicitante + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} assumido`,
          `O chamado "${chamado.titulo}" foi assumido por um tecnico.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    // Propaga para filhos agrupados (13/05/2026)
    this.agrupamento.propagarEventoNoFilho(id, 'Chamado assumido por um tecnico', user.sub)
      .catch((err) => console.error('Propagacao assumir error:', err.message));

    return updated;
  }

  async transferirEquipe(id: string, dto: TransferirEquipeDto, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Chamado finalizado nao pode ser transferido. Reabra o chamado primeiro.');
    }

    const equipeDestino = await this.prisma.equipe.findUnique({
      where: { id: dto.equipeDestinoId },
    });
    if (!equipeDestino) throw new BadRequestException('Equipe destino nao encontrada');

    // SAC (Fase 1) — guard "roster não roteável": não transferir chamado para
    // uma equipe de apoio SAC (catálogo de apoiadores, nunca recebe chamado).
    if (equipeDestino.apoioSac) {
      throw new BadRequestException('Equipe de apoio SAC é catálogo de apoiadores — não recebe chamados.');
    }

    // Se indicou tecnico destino, validar que pertence a equipe destino
    if (dto.tecnicoDestinoId) {
      const membro = await this.prisma.membroEquipe.findUnique({
        where: { usuarioId_equipeId: { usuarioId: dto.tecnicoDestinoId, equipeId: dto.equipeDestinoId } },
      });
      if (!membro || membro.status !== 'ATIVO') {
        throw new BadRequestException('Tecnico informado nao pertence a equipe destino');
      }
    }

    // Workspace Onda 2 C2.7 — re-derivar departamentoId quando a equipe
    // muda (o workspace dono acompanha a equipe que atende).
    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        equipeAtualId: dto.equipeDestinoId,
        departamentoId: equipeDestino.departamentoId ?? undefined,
        tecnicoId: dto.tecnicoDestinoId || null,
        status: dto.tecnicoDestinoId ? 'EM_ATENDIMENTO' : 'ABERTO',
      },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'TRANSFERENCIA_EQUIPE',
        descricao: dto.motivo || `Chamado transferido para outra equipe${dto.tecnicoDestinoId ? ' com tecnico indicado' : ''}`,
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
        equipeOrigemId: chamado.equipeAtualId,
        equipeDestinoId: dto.equipeDestinoId,
      },
    });

    // Notificar lideres da equipe destino
    this.prisma.membroEquipe.findMany({
      where: { equipeId: dto.equipeDestinoId, isLider: true, status: 'ATIVO' },
      select: { usuarioId: true },
    }).then((lideres) => {
      const ids = lideres.map((l) => l.usuarioId).filter((uid) => uid !== user.sub);
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATRIBUIDO',
          `Chamado #${chamado.numero} transferido`,
          `Chamado "${chamado.titulo}" foi transferido para sua equipe.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    // Notificar envolvidos (solicitante + tecnico anterior + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} transferido de equipe`,
          `O chamado "${chamado.titulo}" foi transferido para a equipe ${equipeDestino.nome}.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    // Propaga para filhos agrupados (13/05/2026)
    this.agrupamento.propagarEventoNoFilho(id, `Transferido para a equipe ${equipeDestino.nome}`, user.sub)
      .catch((err) => console.error('Propagacao transferir equipe error:', err.message));

    return updated;
  }

  async transferirTecnico(id: string, dto: TransferirTecnicoDto, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Chamado finalizado nao pode ser transferido. Reabra o chamado primeiro.');
    }

    if (!chamado.tecnicoId) {
      throw new BadRequestException('E necessario assumir o chamado antes de transferir para outro tecnico');
    }

    const tecnico = await this.prisma.usuario.findUnique({ where: { id: dto.tecnicoId } });
    if (!tecnico) throw new BadRequestException('Tecnico nao encontrado');

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { tecnicoId: dto.tecnicoId, status: 'EM_ATENDIMENTO' },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'TRANSFERENCIA_TECNICO',
        descricao: dto.motivo || `Chamado transferido para ${tecnico.nome}`,
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar tecnico destino
    this.notificacaoService.criarParaUsuario(
      dto.tecnicoId, 'CHAMADO_ATRIBUIDO',
      `Chamado #${chamado.numero} atribuido a voce`,
      `O chamado "${chamado.titulo}" foi atribuido a voce.`,
      { chamadoId: id },
    ).catch((err) => console.error('Notificacao error:', err.message));

    // Notificar demais envolvidos (solicitante + colaboradores)
    this.getDestinatariosChamado(id, [user.sub, dto.tecnicoId]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} transferido`,
          `O chamado "${chamado.titulo}" foi transferido para ${tecnico.nome}.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    if (dto.emailEnvolvidos === true) {
      this.dispararEmailAtribuicao(id, chamado, user, tecnico.nome)
        .catch((err) => console.error('Email envolvidos (transferirTecnico) error:', (err as Error).message));
    }

    // Propaga para filhos agrupados (13/05/2026)
    this.agrupamento.propagarEventoNoFilho(id, `Transferido para o tecnico ${tecnico.nome}`, user.sub)
      .catch((err) => console.error('Propagacao transferir tecnico error:', err.message));

    return updated;
  }

  async comentar(id: string, dto: ComentarioChamadoDto, user: JwtPayload, role: string) {
    // Solicitante e copiados tambem podem comentar (copiado tem "papel de
    // solicitante" — decidido em 13/05/2026).
    await this.helpers.assertTecnicoOuColaborador(id, user, role, {
      permitirSolicitante: true,
      permitirCopia: true,
    });

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel comentar em chamado finalizado. Reabra o chamado para adicionar comentarios.');
    }

    // Se chamado nao tem tecnico atribuido, podem comentar:
    // - Solicitante (sempre)
    // - Copiados (tem "papel de solicitante" — decidido em 13/05/2026)
    // - Gestor (override)
    if (!chamado.tecnicoId && chamado.solicitanteId !== user.sub && !isGestor(role)) {
      const isCopia = await this.prisma.chamadoCopia.findUnique({
        where: { chamadoId_usuarioId: { chamadoId: id, usuarioId: user.sub } },
        select: { id: true },
      });
      if (!isCopia) {
        throw new BadRequestException('E necessario assumir o chamado antes de comentar');
      }
    }

    // ----- Validações específicas do "Solicitar info ao usuário" -----
    // Apenas técnico/colaborador/gestor pode marcar como PENDENTE_USUARIO
    // (não faz sentido o solicitante "solicitar info de si mesmo").
    const isSolicitarInfo = dto.solicitarInfoUsuario === true;
    if (isSolicitarInfo) {
      if (chamado.solicitanteId === user.sub && !isGestor(role)) {
        throw new BadRequestException(
          'Apenas o tecnico/colaborador/gestor pode solicitar informacoes ao solicitante.',
        );
      }
      if (chamado.status !== 'EM_ATENDIMENTO' && chamado.status !== 'PENDENTE_USUARIO') {
        throw new BadRequestException(
          'So e possivel solicitar info ao usuario quando o chamado esta em atendimento.',
        );
      }
    }

    // ----- Auto-transição PENDENTE_USUARIO → EM_ATENDIMENTO -----
    // Quando solicitante comenta em chamado PENDENTE_USUARIO, o chamado
    // volta para EM_ATENDIMENTO (sai da fila "aguardando usuário" e volta
    // ao radar do técnico). Notificação dedicada.
    const isRespostaSolicitante =
      chamado.status === 'PENDENTE_USUARIO' && chamado.solicitanteId === user.sub;

    // ----- Anexos vinculados (decisao 13/05/2026 — chat-style) -----
    // Cada anexosIds eh um AnexoChamado ja gravado (upload prévio do front).
    // Apos validar que pertencem a este chamado, anexa marcadores
    // `[anexo:<uuid>]` no fim da descricao. Front parseia em chip clicavel.
    let descricaoFinal = dto.descricao;
    if (dto.anexosIds && dto.anexosIds.length > 0) {
      const anexosValidos = await this.prisma.anexoChamado.findMany({
        where: { id: { in: dto.anexosIds }, chamadoId: id },
        select: { id: true },
      });
      if (anexosValidos.length !== dto.anexosIds.length) {
        throw new BadRequestException('Um ou mais anexos nao pertencem a este chamado');
      }
      const marcadores = anexosValidos.map((a) => `[anexo:${a.id}]`).join(' ');
      descricaoFinal = `${dto.descricao}\n\n${marcadores}`;
    }

    // ----- Persistência -----
    // Comentário sempre é registrado. Se for solicitação de info ou resposta
    // do solicitante, registra também uma entrada MUDANCA_STATUS para que
    // a timeline reflita a transição claramente.
    const historico = await this.prisma.historicoChamado.create({
      data: {
        tipo: 'COMENTARIO',
        descricao: descricaoFinal,
        // Defesa em profundidade (14/05/2026): non-staff sempre grava
        // publico=true (mesmo se enviar publico=false no DTO). Frontend não
        // mostra checkbox pra não-staff, mas evita bypass por API direto.
        // "Solicitar info" também força publico=true (solicitante PRECISA ver).
        // S12 — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`. Caso
        // multi-perfil precisa ser detectado pelo JWT.departamentos[], senão
        // GESTOR de outro depto poderia gravar comentário interno (privado).
        publico: !hasStaffPerfilEmTI(user) || isSolicitarInfo ? true : (dto.publico ?? true),
        chamadoId: id,
        usuarioId: user.sub,
      },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
    });

    if (isSolicitarInfo) {
      await this.prisma.chamado.update({
        where: { id },
        data: { status: 'PENDENTE_USUARIO' },
      });
      await this.prisma.historicoChamado.create({
        data: {
          tipo: 'SOLICITACAO_INFO',
          descricao: 'Aguardando informacoes do solicitante',
          publico: true,
          chamadoId: id,
          usuarioId: user.sub,
        },
      });
    } else if (isRespostaSolicitante) {
      await this.prisma.chamado.update({
        where: { id },
        data: { status: 'EM_ATENDIMENTO' },
      });
      await this.prisma.historicoChamado.create({
        data: {
          tipo: 'RETOMADA_USUARIO',
          descricao: 'Solicitante respondeu — chamado retomado em atendimento',
          publico: true,
          chamadoId: id,
          usuarioId: user.sub,
        },
      });
    }

    // ----- Notificações -----
    const destinatarios = await this.getDestinatariosChamado(id, [user.sub]);

    // Processar @mencoes para notificacao diferenciada
    const mencionadoIds = new Set<string>();
    if (dto.descricao) {
      const regex = /@(\S+)/g;
      const usernames: string[] = [];
      let match;
      while ((match = regex.exec(dto.descricao)) !== null) {
        usernames.push(match[1].toLowerCase());
      }
      if (usernames.length > 0) {
        const mencionados = await this.prisma.usuario.findMany({
          where: { username: { in: usernames, mode: 'insensitive' } },
          select: { id: true },
        });
        for (const m of mencionados) {
          if (m.id !== user.sub) mencionadoIds.add(m.id);
        }
      }
    }

    // Caso especial 1: solicitação de info — notificação destacada SOMENTE pro solicitante,
    // demais envolvidos recebem notificação regular de comentário.
    if (isSolicitarInfo && chamado.solicitanteId) {
      this.notificacaoService.criarParaUsuario(
        chamado.solicitanteId,
        'CHAMADO_ATUALIZADO',
        `🔔 Tecnico precisa da sua resposta no chamado #${chamado.numero}`,
        `O tecnico solicitou mais informacoes para continuar o atendimento de "${chamado.titulo}". Acesse e responda assim que possivel.`,
        { chamadoId: id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // Caso especial 2: solicitante respondeu chamado PENDENTE_USUARIO —
    // notificação destacada pro técnico (chamado voltou pra fila dele).
    if (isRespostaSolicitante && chamado.tecnicoId) {
      this.notificacaoService.criarParaUsuario(
        chamado.tecnicoId,
        'CHAMADO_ATUALIZADO',
        `↩ Solicitante respondeu o chamado #${chamado.numero}`,
        `O solicitante respondeu o chamado "${chamado.titulo}". Status voltou para Em Atendimento.`,
        { chamadoId: id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // Mencionados recebem notificacao de mencao (não dispara para solicitante
    // se já recebeu a destacada acima — evita duplicação)
    if (isSolicitarInfo) mencionadoIds.delete(chamado.solicitanteId ?? '');
    if (isRespostaSolicitante) mencionadoIds.delete(chamado.tecnicoId ?? '');
    if (mencionadoIds.size > 0) {
      this.notificacaoService.criarParaUsuarios(
        Array.from(mencionadoIds), 'CHAMADO_ATUALIZADO',
        `Voce foi mencionado no chamado #${chamado.numero}`,
        `Voce foi mencionado em um comentario no chamado "${chamado.titulo}".`,
        { chamadoId: id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // Demais envolvidos (que nao foram mencionados nem receberam destacada)
    let idsComentario = destinatarios.filter((uid) => !mencionadoIds.has(uid));
    if (isSolicitarInfo) {
      idsComentario = idsComentario.filter((uid) => uid !== chamado.solicitanteId);
    }
    if (isRespostaSolicitante) {
      idsComentario = idsComentario.filter((uid) => uid !== chamado.tecnicoId);
    }
    if (idsComentario.length > 0) {
      this.notificacaoService.criarParaUsuarios(
        idsComentario, 'CHAMADO_ATUALIZADO',
        `Novo comentario no chamado #${chamado.numero}`,
        `Novo comentario no chamado "${chamado.titulo}".`,
        { chamadoId: id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // ----- E-mail opcional aos envolvidos (Sub-fase 3 do plano e-mail) -----
    // Emissor explicitamente solicitou (checkbox "Notificar por e-mail").
    // Filtros: interno nunca envia; PRIVADO suprime cópias (não-TI); pref
    // do destinatário pode opt-out (default true).
    if (dto.emailEnvolvidos === true && historico.publico) {
      // Reusa toda a união de envolvidos notificados in-app (não dependemos do
      // tipo de notificação — quem é avisado in-app também recebe e-mail).
      const todosNotificados = new Set<string>([
        ...destinatarios,
        ...mencionadoIds,
      ]);
      if (isSolicitarInfo && chamado.solicitanteId) todosNotificados.add(chamado.solicitanteId);
      if (isRespostaSolicitante && chamado.tecnicoId) todosNotificados.add(chamado.tecnicoId);

      // Chamado PRIVADO: cópias (não-TI por design) não recebem nada.
      let alvoIds = Array.from(todosNotificados);
      if (chamado.visibilidade === 'PRIVADO') {
        const copias = await this.prisma.chamadoCopia.findMany({
          where: { chamadoId: id },
          select: { usuarioId: true },
        });
        if (copias.length > 0) {
          const copiasIds = new Set(copias.map((c) => c.usuarioId));
          alvoIds = alvoIds.filter((uid) => !copiasIds.has(uid));
        }
      }

      this.emailEnvolvidos
        .enviar({
          canal: 'chamados',
          emissorId: user.sub,
          destinatarioIds: alvoIds,
          subject: `[Chamado #${chamado.numero}] ${chamado.titulo}`,
          html: emailTpl.chamadoComentario({
            numero: chamado.numero,
            titulo: chamado.titulo,
            autor: historico.usuario?.nome ?? 'Sistema',
            comentario: dto.descricao,
            chamadoId: id,
          }),
        })
        .catch((err) => console.error('Email envolvidos (comentario) error:', (err as Error).message));
    }

    // Propagar para filhos (se este chamado for agrupador).
    // Apenas comentarios publicos sao propagados — comentario interno fica
    // restrito ao agrupador. Decidido em 13/05/2026 (item 3).
    if (historico.publico) {
      this.agrupamento.propagarComentario(id, dto.descricao, user).catch((err) =>
        console.error('Propagacao comentario error:', err.message),
      );
    }

    return historico;
  }

  async editarComentario(chamadoId: string, historicoId: string, descricao: string, user: JwtPayload, role: string) {
    const historico = await this.prisma.historicoChamado.findFirst({
      where: { id: historicoId, chamadoId, tipo: 'COMENTARIO' },
    });
    if (!historico) throw new NotFoundException('Comentario nao encontrado');

    // Somente o autor ou gestores pode editar
    // Gestor DO DEPARTAMENTO DO CHAMADO (25/08) — vide updateHeader.
    const chamadoDoComentario = await this.helpers.getChamadoOrFail(chamadoId);
    if (historico.usuarioId !== user.sub
        && !ehGestorNoDepto(user, chamadoDoComentario.departamentoId, role)) {
      throw new ForbiddenException('Voce so pode editar seus proprios comentarios');
    }

    return this.prisma.historicoChamado.update({
      where: { id: historicoId },
      data: { descricao },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
    });
  }

  async resolver(id: string, dto: ResolverChamadoDto, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status === 'FECHADO' || chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado ja encerrado');
    }

    if (!chamado.tecnicoId) {
      throw new BadRequestException('E necessario assumir o chamado antes de finaliza-lo');
    }

    // Verificar se ha registro de tempo
    const totalRegistros = await this.prisma.registroTempoChamado.count({
      where: { chamadoId: id },
    });
    if (totalRegistros === 0) {
      throw new BadRequestException('E necessario iniciar o tempo de atendimento antes de finalizar o chamado');
    }

    // Encerrar todos os cronometros ativos
    const timersAtivos = await this.prisma.registroTempoChamado.findMany({
      where: { chamadoId: id, horaFim: null },
    });
    const agora = new Date();
    for (const timer of timersAtivos) {
      const duracao = Math.round((agora.getTime() - new Date(timer.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempoChamado.update({
        where: { id: timer.id },
        data: { horaFim: agora, duracaoMinutos: duracao },
      });
    }

    const dataResolucao = new Date();
    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'RESOLVIDO', dataResolucao },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'RESOLVIDO',
        descricao: dto.descricao || 'Chamado finalizado',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar envolvidos (solicitante + tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} finalizado`,
          `O chamado "${chamado.titulo}" foi finalizado.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    if (dto.emailEnvolvidos === true) {
      this.dispararEmailStatusChamado(id, chamado, user, 'Em atendimento', 'Resolvido')
        .catch((err) => console.error('Email envolvidos (resolver) error:', (err as Error).message));
    }

    // Cascata para filhos agrupados (decidido em 13/05/2026)
    this.agrupamento.cascataResolverFechar(id, 'RESOLVIDO', dataResolucao, user)
      .catch((err) => console.error('Cascata resolver error:', err.message));

    return updated;
  }

  async fechar(id: string, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status !== 'RESOLVIDO') {
      throw new BadRequestException('Apenas chamados resolvidos podem ser fechados');
    }

    const dataFechamento = new Date();
    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'FECHADO', dataFechamento },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'FECHADO',
        descricao: 'Chamado fechado',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Cascata para filhos agrupados (decidido em 13/05/2026)
    this.agrupamento.cascataResolverFechar(id, 'FECHADO', dataFechamento, user)
      .catch((err) => console.error('Cascata fechar error:', err.message));

    // Notificar envolvidos (solicitante + tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} fechado`,
          `O chamado "${chamado.titulo}" foi fechado.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async reabrir(id: string, dto: ReabrirChamadoDto, user: JwtPayload, role: string) {
    // Solicitante tambem pode reabrir
    await this.helpers.assertTecnicoOuColaborador(id, user, role, { permitirSolicitante: true });

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado cancelado nao pode ser reaberto');
    }
    if (chamado.status !== 'RESOLVIDO' && chamado.status !== 'FECHADO') {
      throw new BadRequestException('Apenas chamados resolvidos ou fechados podem ser reabertos');
    }

    // Se quem reabre é membro ATIVO da EQUIPE que atende o chamado
    // (chamado.equipeAtualId), assume automaticamente. Espelha o fix de
    // `create()` — USUARIO_CHAVE/TERCEIRIZADO e qualquer um de fora da equipe
    // (outro workspace OU outra equipe da T.I.) reabrem sem auto-assumir.
    const rolesNaoAssumem = ['USUARIO_FINAL', 'USUARIO_CHAVE', 'TERCEIRIZADO'];
    const membroDaEquipe = await this.prisma.membroEquipe.findUnique({
      where: { usuarioId_equipeId: { usuarioId: user.sub, equipeId: chamado.equipeAtualId } },
      select: { status: true },
    });
    const roleNoDeptoDono = getRoleNoDepto(user, chamado.departamentoId) ?? role;
    const isTecnicoTI =
      membroDaEquipe?.status === 'ATIVO' && !rolesNaoAssumem.includes(roleNoDeptoDono);
    const novoTecnicoId = isTecnicoTI ? user.sub : null;
    const novoStatus = isTecnicoTI ? 'EM_ATENDIMENTO' : 'REABERTO';

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        status: novoStatus,
        tecnicoId: novoTecnicoId,
        dataResolucao: null,
        dataFechamento: null,
      },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'REABERTO',
        descricao: dto.motivo || 'Chamado reaberto',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Se tecnico assumiu ao reabrir, criar historico de assumido tambem
    if (isTecnicoTI) {
      await this.prisma.historicoChamado.create({
        data: {
          tipo: 'ASSUMIDO',
          descricao: 'Chamado assumido ao reabrir',
          publico: true,
          chamadoId: id,
          usuarioId: user.sub,
        },
      });

      // Auto-iniciar cronometro ao assumir (fecha timers anteriores)
      await this.tempo.encerrarTimersAbertos(user.sub);
      await this.prisma.registroTempoChamado.create({
        data: { horaInicio: new Date(), chamadoId: id, usuarioId: user.sub },
      });
    }

    // Notificar envolvidos (solicitante + tecnico anterior + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} reaberto`,
          `O chamado "${chamado.titulo}" foi reaberto.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    if (dto.emailEnvolvidos === true) {
      const statusAnterior = chamado.status === 'RESOLVIDO' ? 'Resolvido' : 'Fechado';
      const statusNovo = isTecnicoTI ? 'Em atendimento' : 'Reaberto';
      this.dispararEmailStatusChamado(id, chamado, user, statusAnterior, statusNovo)
        .catch((err) => console.error('Email envolvidos (reabrir) error:', (err as Error).message));
    }

    return updated;
  }

  /** `user`/`role` entraram em 25/08: a rota decidia só pelo `@Roles` do controller. */
  async vincularProjeto(chamadoId: string, projetoId: string, user: JwtPayload, role: string) {
    const chamado = await this.helpers.getChamadoOrFail(chamadoId);
    if (!ehStaffNoDepto(user, chamado.departamentoId, role)) {
      throw new ForbiddenException('Você não atende chamados deste departamento.');
    }
    return this.prisma.chamado.update({
      where: { id: chamadoId },
      data: { projetoId },
      select: { id: true, projetoId: true },
    });
  }

  async cancelar(id: string, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status === 'FECHADO' || chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado ja encerrado');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'CANCELADO' },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'CANCELADO',
        descricao: 'Chamado cancelado',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar envolvidos (solicitante + tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} cancelado`,
          `O chamado "${chamado.titulo}" foi cancelado.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async avaliar(id: string, dto: CsatDto, user: JwtPayload) {
    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.solicitanteId !== user.sub) {
      throw new ForbiddenException('Apenas o solicitante pode avaliar');
    }

    if (chamado.status !== 'RESOLVIDO' && chamado.status !== 'FECHADO') {
      throw new BadRequestException('Chamado precisa estar resolvido ou fechado para avaliar');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        notaSatisfacao: dto.nota,
        comentarioSatisfacao: dto.comentario,
      },
      include: chamadoInclude,
    });

    // Historico de avaliacao
    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'AVALIADO',
        descricao: `Avaliacao: ${dto.nota}/5${dto.comentario ? ` - "${dto.comentario}"` : ''}`,
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar envolvidos (tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} avaliado`,
          `O chamado "${chamado.titulo}" recebeu avaliacao ${dto.nota}/5.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async excluir(id: string, user: JwtPayload, role: string) {
    const chamado = await this.helpers.getChamadoOrFail(id);

    // ⭐ 25/08 — a lista de roles era conferida contra a role DENORMALIZADA: quem é
    // SUPORTE no Fiscal apagava chamado do T.I., onde é usuário final. Quem apaga é
    // staff NO departamento do chamado.
    if (!ehStaffNoDepto(user, chamado.departamentoId, role)) {
      throw new ForbiddenException('Sem permissao para excluir chamados deste departamento');
    }

    if (chamado.status !== 'ABERTO') {
      throw new BadRequestException('Somente chamados com status ABERTO podem ser excluidos');
    }

    // Remover anexos do disco
    const anexos = await this.prisma.anexoChamado.findMany({ where: { chamadoId: id } });
    const uploadsDir = path.join(process.cwd(), 'uploads', 'chamados');
    for (const anexo of anexos) {
      const filePath = path.join(uploadsDir, anexo.nomeArquivo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Deletar registros dependentes e o chamado (cascade cuida de historicos, anexos, colaboradores, registros tempo)
    await this.prisma.chamado.delete({ where: { id } });

    return { deleted: true, numero: chamado.numero };
  }
}
