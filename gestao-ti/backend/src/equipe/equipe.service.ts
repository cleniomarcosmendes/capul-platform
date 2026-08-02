import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEquipeDto } from './dto/create-equipe.dto.js';
import { UpdateEquipeDto } from './dto/update-equipe.dto.js';
import { AddMembroDto } from './dto/add-membro.dto.js';
import { UpdateMembroDto } from './dto/update-membro.dto.js';
import { StatusGeral } from '@prisma/client';
import { resolveDepartamento } from '../common/helpers/resolve-departamento.helper.js';
import {
  assertDepartamentoDoUser,
  assertStaffEmDepto,
} from '../common/helpers/departamento-filter.helper.js';
import { hasCapability } from '../common/helpers/capability.helper.js';
import { getDeptosOndeStaff } from '../common/constants/roles.constant.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class EquipeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: StatusGeral) {
    // Workspace Onda 2 C2.7 — leitura GLOBAL: qualquer user precisa ver
    // qualquer equipe pra poder abrir chamado pra ela (T.I. atende todos os
    // deptos, Fiscal pode demandar pra Controladoria, etc.). Filtro
    // departamental movido pra create/update/delete (escrita por depto-dono).
    // C2.7 UX 24/05 — inclui `departamento` pra UI montar select encadeado
    // (escolhe depto destino, equipes filtram pelo depto).
    // NB: listagem GLOBAL (sem filtro de visibilidade) — é a usada pela
    // TRANSFERÊNCIA de chamado, que precisa enxergar até equipes privadas.
    // A ABERTURA usa `findSelecionaveis` (filtrada). Não filtrar aqui.
    return this.prisma.equipe.findMany({
      where: status ? { status } : {},
      include: {
        membros: {
          include: { usuario: true },
          where: { status: 'ATIVO' },
        },
        departamento: { select: { id: true, nome: true } },
      },
      orderBy: { ordem: 'asc' },
    });
  }

  /**
   * Equipes SELECIONÁVEIS na ABERTURA de chamado. Aplica a visibilidade:
   * equipe pública (privada=false) aparece pra todos; equipe privada só
   * aparece pra quem é STAFF (ADMIN/GESTOR/SUPORTE) do departamento dela —
   * via `getDeptosOndeStaff` — ou pra quem tem `OVERSIGHT_PLATAFORMA`.
   * Usuário final/chave/terceirizado e staff de outros deptos não veem as
   * privadas. Filtro server-side (defesa em profundidade — o backend de
   * criação `ChamadoCoreService.create` revalida). NÃO usada pela
   * transferência (essa continua no `findAll` global).
   */
  async findSelecionaveis(user: JwtPayload, status: StatusGeral = 'ATIVO') {
    const whereStatus = { status };
    const where = hasCapability(user, 'OVERSIGHT_PLATAFORMA')
      ? whereStatus
      : {
          ...whereStatus,
          OR: [
            { privada: false },
            { departamentoId: { in: getDeptosOndeStaff(user) } },
          ],
        };
    return this.prisma.equipe.findMany({
      where,
      include: {
        membros: {
          include: { usuario: true },
          where: { status: 'ATIVO' },
        },
        departamento: { select: { id: true, nome: true } },
      },
      orderBy: { ordem: 'asc' },
    });
  }

  async findOne(id: string) {
    const equipe = await this.prisma.equipe.findUnique({
      where: { id },
      include: {
        membros: {
          include: { usuario: true },
          orderBy: [{ isLider: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!equipe) {
      throw new NotFoundException('Equipe não encontrada');
    }

    return equipe;
  }

  /**
   * S15.4 (27/05) — Lista equipes pra TELA DE CONFIGURAÇÃO (`/equipes`).
   *
   * Diferente do `findAll` global (mantido pra dropdowns de chamado/contrato/
   * conhecimento/etc.), aqui restringe a deptos onde o user é STAFF (ADMIN/
   * GESTOR/SUPORTE). USUARIO_FINAL com perfil no workspace NÃO vê equipes do
   * depto na tela admin. Bypass via OVERSIGHT_PLATAFORMA.
   *
   * Incidente Juliana (GESTOR/Controladoria + USUARIO_FINAL/T.I.): via
   * equipes de T.I. na tela "Conf. Equipes" e podia tentar editá-las
   * (write é bloqueado por assertDepartamentoDoUser, mas o leak da listagem
   * já era informacional — e poderia confundir/induzir tentativas de bypass).
   */
  async findAllParaConfig(status: StatusGeral | undefined, user: JwtPayload) {
    const whereStatus = status ? { status } : {};
    const where = hasCapability(user, 'OVERSIGHT_PLATAFORMA')
      ? whereStatus
      : { ...whereStatus, departamentoId: { in: getDeptosOndeStaff(user) } };

    return this.prisma.equipe.findMany({
      where,
      include: {
        membros: {
          include: { usuario: true },
          where: { status: 'ATIVO' },
        },
        departamento: { select: { id: true, nome: true } },
      },
      orderBy: { ordem: 'asc' },
    });
  }

  /**
   * S15.4 (27/05) — Detalhe de equipe pra TELA DE CONFIGURAÇÃO. Exige STAFF
   * no depto da equipe (bypass via OVERSIGHT). Usado por `EquipeDetalhePage`
   * e `EquipeFormPage` (admin). Para mostrar membros num chamado, o frontend
   * continua usando `findOne` (`GET /equipes/:id`) global — sem assert.
   */
  async findOneParaConfig(id: string, user: JwtPayload) {
    const equipe = await this.findOne(id);
    assertStaffEmDepto(user, equipe.departamentoId);
    return equipe;
  }

  async create(dto: CreateEquipeDto, user?: JwtPayload) {
    const existing = await this.prisma.equipe.findFirst({
      where: {
        OR: [{ nome: dto.nome }, { sigla: dto.sigla }],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.nome === dto.nome
          ? 'Já existe uma equipe com este nome'
          : 'Já existe uma equipe com esta sigla',
      );
    }

    // Onda 1 Sub-fase 1.6.1 — resolveDepartamento em cascata.
    const departamentoId = await resolveDepartamento(
      this.prisma,
      user ?? null,
      'WORKSPACE',
      dto.departamentoId,
    );

    // Onda 3 S10 fix (ultrareview bug_011, MAIS GRAVE) — gate IDOR
    // cross-depto. Equipe sem assert cascateia: chamado-core.service.ts:540
    // deriva chamado.departamentoId = equipe.departamentoId, então uma
    // equipe plantada por GESTOR de outro depto envenenaria a visibilidade
    // do depto-alvo silenciosamente.
    if (user) assertDepartamentoDoUser(user, null, departamentoId);

    this.assertModalidadeCoerente(dto.atendeSac, dto.vendaAtiva);
    return this.prisma.equipe.create({
      data: {
        nome: dto.nome,
        sigla: dto.sigla.toUpperCase(),
        descricao: dto.descricao,
        cor: dto.cor,
        icone: dto.icone,
        privada: dto.privada,
        restritaVisibilidade: dto.restritaVisibilidade,
        apoioSac: dto.apoioSac,
        atendeSac: dto.atendeSac,
        vendaAtiva: dto.vendaAtiva,
        emailEquipe: dto.emailEquipe,
        ordem: dto.ordem,
        departamentoId,
      },
    });
  }

  /**
   * SAC e VENDA ATIVA são modalidades DIFERENTES da mesma equipe e não se acumulam.
   *
   * As duas abrem o bloco de cliente no formulário, mas com sentidos opostos: no SAC o
   * cliente procurou a empresa (canal de origem, e-mail de retorno); na Venda Ativa a
   * empresa procurou o cliente. Ligar as duas faria o formulário ter de adivinhar qual
   * bloco mostrar, e o relatório de uma poluiria o da outra.
   *
   * Quem precisa das duas cria DUAS equipes — o flag é por equipe, não por
   * departamento, justamente para permitir isso.
   */
  private assertModalidadeCoerente(atendeSac?: boolean | null, vendaAtiva?: boolean | null) {
    if (atendeSac && vendaAtiva) {
      throw new BadRequestException(
        'Uma equipe é de SAC ou de Venda Ativa — não as duas. Crie uma equipe para cada modalidade (o comportamento é por equipe, não por departamento).',
      );
    }
  }

  async update(id: string, dto: UpdateEquipeDto, user?: JwtPayload) {
    const equipe = await this.findOne(id);
    // No update o DTO pode trazer só UM dos flags — vale a combinação RESULTANTE.
    this.assertModalidadeCoerente(
      dto.atendeSac ?? equipe.atendeSac,
      dto.vendaAtiva ?? equipe.vendaAtiva,
    );

    // Onda 3 S10 sweep (26/05) — fecha IDOR cross-depto na edição (bug_011
    // completou-se só no create; security-review #1 sinalizou).
    if (user) {
      assertDepartamentoDoUser(user, null, equipe.departamentoId);
      // Se o caller está MOVENDO a equipe pra outro depto, exige permissão
      // também no destino (mesma regra de licenca.update/contrato.update).
      if (dto.departamentoId && dto.departamentoId !== equipe.departamentoId) {
        assertDepartamentoDoUser(user, null, dto.departamentoId);
      }
    }

    if (dto.nome || dto.sigla) {
      const existing = await this.prisma.equipe.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.nome ? [{ nome: dto.nome }] : []),
            ...(dto.sigla ? [{ sigla: dto.sigla }] : []),
          ],
        },
      });

      if (existing) {
        throw new ConflictException(
          existing.nome === dto.nome
            ? 'Já existe uma equipe com este nome'
            : 'Já existe uma equipe com esta sigla',
        );
      }
    }

    return this.prisma.equipe.update({
      where: { id },
      data: {
        ...dto,
        sigla: dto.sigla ? dto.sigla.toUpperCase() : undefined,
      },
    });
  }

  async updateStatus(id: string, status: StatusGeral, user?: JwtPayload) {
    const equipe = await this.findOne(id);
    if (user) assertDepartamentoDoUser(user, null, equipe.departamentoId);

    return this.prisma.equipe.update({
      where: { id },
      data: { status },
    });
  }

  // ---- Membros ----

  async addMembro(equipeId: string, dto: AddMembroDto, user?: JwtPayload) {
    const equipe = await this.findOne(equipeId);
    // Onda 3 S10 sweep #2 (26/05, security-review #2) — fecha membership.
    // Mesmo vetor do equipe.update: GESTOR cross-depto entrava na equipe
    // de outro workspace pra capturar chamados rotados via ela.
    if (user) assertDepartamentoDoUser(user, null, equipe.departamentoId);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
    });

    if (!usuario) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const existing = await this.prisma.membroEquipe.findUnique({
      where: {
        usuarioId_equipeId: {
          usuarioId: dto.usuarioId,
          equipeId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Usuário já é membro desta equipe');
    }

    return this.prisma.membroEquipe.create({
      data: {
        usuarioId: dto.usuarioId,
        equipeId,
        isLider: dto.isLider ?? false,
      },
      include: { usuario: true },
    });
  }

  async updateMembro(equipeId: string, membroId: string, dto: UpdateMembroDto, user?: JwtPayload) {
    const equipe = await this.findOne(equipeId);
    if (user) assertDepartamentoDoUser(user, null, equipe.departamentoId);

    const membro = await this.prisma.membroEquipe.findFirst({
      where: { id: membroId, equipeId },
    });

    if (!membro) {
      throw new NotFoundException('Membro não encontrado nesta equipe');
    }

    return this.prisma.membroEquipe.update({
      where: { id: membroId },
      data: dto,
      include: { usuario: true },
    });
  }

  async remove(id: string, user?: JwtPayload) {
    const equipe = await this.prisma.equipe.findUnique({ where: { id } });
    if (!equipe) throw new NotFoundException('Equipe nao encontrada');
    if (user) assertDepartamentoDoUser(user, null, equipe.departamentoId);

    try {
      await this.prisma.equipe.delete({ where: { id } });
      return { success: true, message: 'Equipe excluida com sucesso' };
    } catch {
      throw new NotFoundException('Equipe possui vinculos (chamados, catalogo, SLA, etc). Inative-a em vez de excluir.');
    }
  }

  async removeMembro(equipeId: string, membroId: string, user?: JwtPayload) {
    const equipe = await this.findOne(equipeId);
    if (user) assertDepartamentoDoUser(user, null, equipe.departamentoId);

    const membro = await this.prisma.membroEquipe.findFirst({
      where: { id: membroId, equipeId },
    });

    if (!membro) {
      throw new NotFoundException('Membro não encontrado nesta equipe');
    }

    await this.prisma.membroEquipe.delete({
      where: { id: membroId },
    });

    return { message: 'Membro removido com sucesso' };
  }

  /**
   * Retorna as equipes onde o usuario pode gerir contratos.
   * Para ADMIN/GESTOR_TI retorna todas as equipes ativas.
   * Para outros roles, retorna apenas equipes onde o usuario tem podeGerirContratos.
   */
  async findEquipesParaContratos(usuarioId: string, role: string) {
    if (role === 'ADMIN' || role === 'GESTOR') {
      return this.prisma.equipe.findMany({
        where: { status: 'ATIVO' },
        orderBy: { ordem: 'asc' },
      });
    }

    const membros = await this.prisma.membroEquipe.findMany({
      where: {
        usuarioId,
        status: 'ATIVO',
        podeGerirContratos: true,
      },
      include: {
        equipe: true,
      },
    });

    return membros
      .filter(m => m.equipe.status === 'ATIVO')
      .map(m => m.equipe)
      .sort((a, b) => a.ordem - b.ordem);
  }
}
