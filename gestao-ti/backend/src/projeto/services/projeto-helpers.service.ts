import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { EmailEnvolvidosService } from '../../email/email-envolvidos.service.js';
import * as emailTpl from '../../email/email-templates.js';
import { isGestor, isTI, ehStaffNoDepto } from '../../common/constants/roles.constant.js';
import { hasCapability } from '../../common/helpers/capability.helper.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class ProjetoHelpersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
    private readonly emailEnvolvidos: EmailEnvolvidosService,
  ) {}

  /**
   * Notifica o RESPONSÁVEL DO PROJETO sobre uma movimentação (atividade/pendência),
   * EXCETO quando o autor é o próprio responsável. Ponto único da regra pedida:
   * "toda movimentação notifica o responsável, menos a que ele mesmo fez".
   *
   * - Sino (in-app) SEMPRE; e-mail conforme `emailPermitido` (nota interna não
   *   envia), respeitando opt-out do canal no EmailEnvolvidosService.
   * - Dedup: `jaNotificados` = quem a ação já avisou no sino (não duplica o sino);
   *   `emailJaEnviado` = a ação já mandou e-mail a essa lista (não duplica e-mail).
   * - `restringirNaoStaff` (nota interna): pula o responsável se ele for
   *   USUARIO_CHAVE/TERCEIRIZADO vinculado (não vê conteúdo interno — Regra 14/05).
   * Fire-and-forget: nunca lança (erros só logam), não deve travar a request.
   */
  async notificarResponsavelProjeto(opts: {
    projetoId: string;
    autorId: string;
    titulo: string;
    mensagem: string;
    itemTipo: 'atividade' | 'pendência';
    dados?: Record<string, unknown>;
    jaNotificados?: Iterable<string>;
    emailJaEnviado?: boolean;
    emailPermitido?: boolean;
    restringirNaoStaff?: boolean;
  }): Promise<void> {
    try {
      const projeto = await this.prisma.projeto.findUnique({
        where: { id: opts.projetoId },
        select: { responsavelId: true, numero: true, nome: true },
      });
      const resp = projeto?.responsavelId;
      if (!resp || resp === opts.autorId) return; // a regra: nada quando o autor é o responsável

      // Nota interna: responsável UC/TERC vinculado não é notificado (não vê o conteúdo).
      if (opts.restringirNaoStaff) {
        const chave = await this.prisma.usuarioChaveProjeto.findUnique({
          where: { projetoId_usuarioId: { projetoId: opts.projetoId, usuarioId: resp } },
        });
        if (chave && chave.ativo) return;
      }

      const ja = new Set(opts.jaNotificados ?? []);
      if (!ja.has(resp)) {
        this.notificacaoService.criarParaUsuario(
          resp, 'PROJETO_ATUALIZADO', opts.titulo, opts.mensagem,
          { projetoId: opts.projetoId, ...opts.dados },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }

      const emailPermitido = opts.emailPermitido ?? true;
      const emailDedup = opts.emailJaEnviado ? ja : new Set<string>();
      if (emailPermitido && !emailDedup.has(resp)) {
        const autor = await this.prisma.usuario.findUnique({ where: { id: opts.autorId }, select: { nome: true } });
        this.emailEnvolvidos.enviar({
          canal: opts.itemTipo === 'pendência' ? 'pendencias' : 'atividades',
          emissorId: opts.autorId,
          destinatarioIds: [resp],
          subject: `[Projeto #${projeto!.numero}] ${opts.titulo}`,
          html: emailTpl.projetoMovimentacaoResponsavel({
            projetoNumero: projeto!.numero,
            projetoNome: projeto!.nome,
            projetoId: opts.projetoId,
            resumo: opts.mensagem,
            autor: autor?.nome ?? 'Sistema',
            itemTipo: opts.itemTipo,
            atividadeId: opts.dados?.atividadeId as string | undefined,
            pendenciaId: opts.dados?.pendenciaId as string | undefined,
          }),
        }).catch((err) => console.error('Email responsavel projeto error:', (err as Error).message));
      }
    } catch (err) {
      console.error('notificarResponsavelProjeto error:', (err as Error).message);
    }
  }

  async ensureProjetoExists(id: string) {
    const projeto = await this.prisma.projeto.findUnique({ where: { id } });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');
    return projeto;
  }

  async getSubProjetosRecursivo(projetoId: string) {
    const diretos = await this.prisma.projeto.findMany({
      where: { projetoPaiId: projetoId },
      select: { id: true, custoPrevisto: true, custoRealizado: true },
    });

    const todos = [...diretos];
    for (const sub of diretos) {
      const netos = await this.getSubProjetosRecursivo(sub.id);
      todos.push(...netos);
    }

    return todos;
  }

  /**
   * Detecta @username em texto e envia notificacao para os mencionados
   */
  async processarMencoes(texto: string, projetoId: string, autorId: string, contexto: string, dadosExtras?: Record<string, unknown>, soStaffTI = false): Promise<string[]> {
    const regex = /@(\S+)/g;
    const usernames: string[] = [];
    let match;
    while ((match = regex.exec(texto)) !== null) {
      usernames.push(match[1].toLowerCase());
    }
    if (usernames.length === 0) return [];

    const usuarios = await this.prisma.usuario.findMany({
      where: { username: { in: usernames, mode: 'insensitive' } },
      select: { id: true, username: true },
    });

    const autor = await this.prisma.usuario.findUnique({
      where: { id: autorId },
      select: { nome: true },
    });

    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { numero: true, nome: true },
    });

    let idsParaNotificar = usuarios.map((u) => u.id).filter((id) => id !== autorId);
    // Nota/interação INTERNA (publica=false): não notificar @menção a
    // USUARIO_CHAVE/TERCEIRIZADO vinculado — não veem o conteúdo (Regra
    // única 14/05). Role não vive neste DB; usuarios_chave_projeto = proxy
    // de não-staff (mesma fonte de checkProjetoAccessChave). Default
    // soStaffTI=false ⇒ comportamento legado (notas públicas inalteradas).
    if (soStaffTI && idsParaNotificar.length > 0) {
      const chave = await this.prisma.usuarioChaveProjeto.findMany({
        where: { projetoId, ativo: true, usuarioId: { in: idsParaNotificar } },
        select: { usuarioId: true },
      });
      const chaveIds = new Set(chave.map((c) => c.usuarioId));
      idsParaNotificar = idsParaNotificar.filter((id) => !chaveIds.has(id));
    }
    if (idsParaNotificar.length > 0 && projeto) {
      this.notificacaoService.criarParaUsuarios(
        idsParaNotificar,
        'PROJETO_ATUALIZADO',
        `${autor?.nome || 'Alguem'} mencionou voce no projeto #${projeto.numero}`,
        `Voce foi mencionado em ${contexto} do projeto "${projeto.nome}".`,
        { projetoId, ...dadosExtras },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }
    return idsParaNotificar;
  }

  /**
   * Verifica se o usuario e membro do projeto, responsavel ou ADMIN/GESTOR_TI.
   * SUPORTE_TI precisa ser membro do projeto para editar.
   *
   * S13a (25/05) — `user` substitui `userId`. Bypass de TI agora é
   * `hasStaffPerfilEmTI(user)` (multi-perfil seguro). Pré-S13a: Juliana
   * (role denormalizada GESTOR) escapava esta validação e podia editar
   * projetos de TI sem ser membro.
   */
  async assertMembroOuGestor(projetoId: string, user: JwtPayload, role: string) {
    // ⭐ 26/08 — quem atende NO DEPARTAMENTO DO PROJETO edita sem ser membro (antes:
    // staff de T.I. editava projeto de qualquer departamento, e quem atende no Fiscal
    // não editava nem o do Fiscal).
    if (await this.ehStaffNoProjeto(projetoId, user, role)) return;

    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { responsavelId: true },
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    // Responsavel pelo projeto
    if (projeto.responsavelId === user.sub) return;

    // Membro do projeto
    const membro = await this.prisma.membroProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: user.sub } },
    });
    if (membro) return;

    throw new ForbiddenException('Voce nao e membro deste projeto');
  }

  /**
   * Verifica se usuario tem acesso ao projeto (USUARIO_CHAVE ou TERCEIRIZADO).
   * Ambas as roles compartilham `usuario_chave_projeto` como tabela de vinculo
   * desde 13/05/2026 — antes `TerceirizadoProjeto` era paralela mas a UI sempre
   * gravava em UsuarioChaveProjeto, criando mismatch que travava terceirizados.
   *
   * Politica de acesso a projeto (alinhada 18/05/2026): liberado para
   * TI (ADMIN/GESTOR_TI/SUPORTE_TI), responsavel, membro da equipe ou
   * USUARIO_CHAVE/TERCEIRIZADO vinculado e ativo. Qualquer outro -> 403.
   * Antes so liberava TI + chave/terc-vinculado: responsavel/membro nao-TI
   * tomavam 403 indevido (espelho invertido de assertMembroOuGestor — quem
   * podia EDITAR nao conseguia VER). Esta uniao corrige o over-block e da
   * consistencia aos 13 call-sites que herdam esta regra.
   */
  async checkProjetoAccessChave(projetoId: string, user: JwtPayload, role: string) {
    // ⭐ 26/08 — idem: quem atende no departamento DO PROJETO.
    if (await this.ehStaffNoProjeto(projetoId, user, role)) return;

    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { responsavelId: true, departamentoId: true },
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    // Responsavel pelo projeto
    if (projeto.responsavelId === user.sub) return;

    // Membro da equipe do projeto
    const membro = await this.prisma.membroProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: user.sub } },
    });
    if (membro) return;

    // USUARIO_CHAVE / TERCEIRIZADO vinculados (compartilham usuario_chave_projeto).
    // 29/05 — multi-perfil: a role precisa ser avaliada NO DEPTO DO PROJETO,
    // não a role principal do JWT. Caso reportado em HOM: Tatiane GESTOR/Fiscal
    // + USUARIO_CHAVE/T.I. tomava 403 em projeto T.I. onde era chave, porque
    // `role` (principal) vinha como GESTOR ou GESTOR_FISCAL e não batia em
    // `USUARIO_CHAVE || TERCEIRIZADO`. Memory feedback_workspace_role_por_depto.
    const roleNoDeptoProjeto = user.modulos
      ?.find((m) => m.codigo === 'WORKSPACE')
      ?.departamentos?.find((d) => d.id === projeto.departamentoId)?.role;
    const roleEfetiva = roleNoDeptoProjeto ?? role;

    if (roleEfetiva === 'USUARIO_CHAVE' || roleEfetiva === 'TERCEIRIZADO') {
      const uc = await this.prisma.usuarioChaveProjeto.findUnique({
        where: { projetoId_usuarioId: { projetoId, usuarioId: user.sub } },
      });
      if (uc && uc.ativo) return;
    }

    throw new ForbiddenException('Sem acesso a este projeto');
  }

  validarEdicaoRegistro(registro: { horaFim: Date | null; horaInicio: Date; usuarioId: string }, userId: string, role: string) {
    // Regra 1: nao editar registro com timer ativo (horaFim = null)
    if (!registro.horaFim) {
      throw new BadRequestException('Nao e possivel editar um registro com cronometro ativo. Encerre o cronometro primeiro.');
    }

    // Regra 2: apenas o dono do registro ou gestores podem editar
    if (registro.usuarioId !== userId && !isGestor(role)) {
      throw new ForbiddenException('Voce so pode editar seus proprios registros de tempo.');
    }

    // Regra 3: limite de D-2 (maximo 2 dias atras)
    const limite = new Date();
    limite.setDate(limite.getDate() - 2);
    limite.setHours(0, 0, 0, 0);
    if (new Date(registro.horaInicio) < limite && !isGestor(role)) {
      throw new BadRequestException('Nao e possivel editar registros com mais de 2 dias. Solicite ao gestor.');
    }
  }

  /**
   * Resolve a role efetiva do user NO DEPARTAMENTO do projeto. Em users
   * multi-perfil (GESTOR em depto A + USUARIO_CHAVE em depto B), a role
   * principal do JWT pode mascarar o papel real no contexto. Este helper
   * faz lookup em `user.modulos[WORKSPACE].departamentos[]` pelo depto do
   * projeto. Fallback pra role principal preserva compat com JWT pré-Onda 1.4.
   *
   * 29/05 — criado pós-incidente HOM "Tatiane GESTOR/Fiscal + USUARIO_CHAVE/T.I.
   * tinha privilégios de GESTOR em projeto T.I." (memory feedback_workspace_role_por_depto).
   */
  /**
   * ⭐ 26/08 — Quem atende NO DEPARTAMENTO DO PROJETO (ADMIN/GESTOR/SUPORTE lá).
   *
   * Substitui `hasStaffPerfilEmTI(user)` nos pontos que decidem sobre UM projeto: aquele
   * helper perguntava "é staff em algum departamento de T.I.?", herança da época em que
   * o Workspace era só do T.I. Errava dos dois lados — quem atende no Fiscal não
   * alcançava nota interna do projeto DO FISCAL, e quem atende no T.I. alcançava a de
   * qualquer departamento.
   *
   * `OVERSIGHT_PLATAFORMA` continua passando: é o alcance transversal EXPLÍCITO, no
   * lugar do implícito por nome de departamento.
   */
  async ehStaffNoProjeto(projetoId: string, user: JwtPayload | undefined, role?: string): Promise<boolean> {
    if (!user) return false;
    if (hasCapability(user, 'OVERSIGHT_PLATAFORMA')) return true;
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { departamentoId: true },
    });
    if (!projeto) return false;
    return ehStaffNoDepto(user, projeto.departamentoId, role);
  }

  async getRoleNoDeptoProjeto(projetoId: string, user: JwtPayload, fallbackRole: string): Promise<string> {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { departamentoId: true },
    });
    if (!projeto) return fallbackRole;
    const roleNoDepto = user.modulos
      ?.find((m) => m.codigo === 'WORKSPACE')
      ?.departamentos?.find((d) => d.id === projeto.departamentoId)?.role;
    return roleNoDepto ?? fallbackRole;
  }
}
