import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { JwtPayload } from '../decorators/current-user.decorator.js';
import { IdentidadeService } from '../../identidade/identidade.service.js';

/**
 * Resolve o COLABORADOR de quem está logado e pendura em `req.colaborador`,
 * uma vez por requisição. É o "resolva uma vez" possível numa plataforma de JWT
 * stateless — e resolver do BANCO, e não do token, é o que evita o 403
 * intermitente de quem teve a matrícula corrigida no Configurador e teria de
 * esperar o token de 60 minutos expirar.
 *
 * ⭐ FALHA FECHADA. Usuário sem matrícula, ou com matrícula que não bate com
 * nenhum colaborador ativo, **não entra no módulo** — o `IdentidadeService`
 * lança 403. Sem `colaboradorId` não há como saber se a avaliação que ele está
 * abrindo é a dele, e liberar por omissão deixaria passar exatamente o caso que
 * a separação de funções existe para cobrir.
 *
 * Roda DEPOIS do JwtAuthGuard (precisa de `req.user`) e ignora rotas @Public().
 *
 * ⚠️ Consequência conhecida: contas de SISTEMA sem matrícula (o `admin` da
 * plataforma, por exemplo) não acessam o módulo. É deliberado — mas significa
 * que o segundo RH_ADMIN precisa ser uma PESSOA com matrícula, não uma conta
 * genérica de suporte.
 */
@Injectable()
export class IdentidadeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly identidade: IdentidadeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as JwtPayload | undefined;
    if (!user?.sub) return false; // sem JWT válido o guard anterior já teria barrado

    req.colaborador = await this.identidade.colaboradorDoUsuario(user.sub);
    return true;
  }
}
