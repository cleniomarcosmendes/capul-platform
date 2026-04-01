import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { isGestor, isTI } from '../../common/constants/roles.constant.js';

@Injectable()
export class ProjetoHelpersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
  ) {}

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
  async processarMencoes(texto: string, projetoId: string, autorId: string, contexto: string, dadosExtras?: Record<string, unknown>): Promise<string[]> {
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

    const idsParaNotificar = usuarios.map((u) => u.id).filter((id) => id !== autorId);
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
   */
  async assertMembroOuGestor(projetoId: string, userId: string, role: string) {
    // ADMIN, GESTOR_TI e SUPORTE_TI podem editar qualquer projeto
    if (isTI(role)) return;

    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { responsavelId: true },
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    // Responsavel pelo projeto
    if (projeto.responsavelId === userId) return;

    // Membro do projeto
    const membro = await this.prisma.membroProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: userId } },
    });
    if (membro) return;

    throw new ForbiddenException('Voce nao e membro deste projeto');
  }

  /**
   * Verifica se usuario tem acesso ao projeto (USUARIO_CHAVE ou TERCEIRIZADO)
   */
  async checkProjetoAccessChave(projetoId: string, userId: string, role: string) {
    if (isTI(role)) return;

    if (role === 'USUARIO_CHAVE') {
      const uc = await this.prisma.usuarioChaveProjeto.findUnique({
        where: { projetoId_usuarioId: { projetoId, usuarioId: userId } },
      });
      if (uc && uc.ativo) return;
    }

    if (role === 'TERCEIRIZADO') {
      const terc = await this.prisma.terceirizadoProjeto.findUnique({
        where: { projetoId_usuarioId: { projetoId, usuarioId: userId } },
      });
      if (terc && terc.ativo) return;
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
}
