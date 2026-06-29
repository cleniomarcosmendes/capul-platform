import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './decorators/current-user.decorator.js';
import { assertPodeOperarViagem } from './frota-perms.js';

/**
 * Token de CONDUTOR para a viagem (Fase 2 — login PADRÃO/compartilhado).
 *
 * A conta PADRÃO é genérica: qualquer pessoa loga com ela. Então, ao abrir uma
 * viagem em curso, o condutor se identifica UMA vez (matrícula+senha do RH) e o
 * backend emite este token curto, preso a {viagem, condutor}. Cada ação seguinte
 * (parada/despesa/retorno) só carrega o token — sem repetir o `loginPortal` do
 * Protheus (que é sensível a repetição) e sem guardar a senha no app.
 *
 * NUNCA usar `UnauthorizedException` (401): o interceptor do app desloga em 401
 * (ver feedback). Token ausente/expirado/divergente → 403, que o app trata como
 * "identifique-se de novo" sem derrubar a sessão.
 */
interface CondutorTokenClaims {
  viagemId: string;
  condutorMatricula: string;
  purpose: 'condutor-viagem';
}

const TTL_SEGUNDOS = 6 * 60 * 60; // 6h — cobre uma jornada; renova reabrindo a viagem.

@Injectable()
export class CondutorTokenService {
  constructor(private readonly jwt: JwtService) {}

  emitir(viagemId: string, condutorMatricula: string): { token: string; expiraEmSeg: number } {
    const token = this.jwt.sign(
      { viagemId, condutorMatricula, purpose: 'condutor-viagem' } satisfies CondutorTokenClaims,
      { expiresIn: TTL_SEGUNDOS },
    );
    return { token, expiraEmSeg: TTL_SEGUNDOS };
  }

  /** Verifica o token p/ ESTA viagem. Lança 403 se ausente/expirado/divergente. */
  verificar(token: string | undefined, viagemId: string): CondutorTokenClaims {
    if (!token) {
      throw new ForbiddenException('Identifique o condutor desta viagem (matrícula + senha) para continuar.');
    }
    let claims: CondutorTokenClaims;
    try {
      claims = this.jwt.verify<CondutorTokenClaims>(token);
    } catch {
      throw new ForbiddenException('Sessão do condutor expirou — identifique-se novamente nesta viagem.');
    }
    if (claims.purpose !== 'condutor-viagem' || claims.viagemId !== viagemId) {
      throw new ForbiddenException('Identificação de condutor inválida para esta viagem.');
    }
    return claims;
  }

  /**
   * Regra única de quem pode OPERAR uma viagem em curso:
   *  - PADRÃO (login compartilhado): exige o token de condutor desta viagem.
   *  - INDIVIDUAL (pessoa autenticada): registrante/supervisor/gestão (regra atual).
   */
  assertOpera(
    user: JwtPayload,
    viagem: { id: string; criadoPorId: string; veiculo?: { supervisorId: string | null } | null },
    condutorToken?: string,
  ): void {
    if (user.tipo === 'PADRAO') {
      this.verificar(condutorToken, viagem.id);
    } else {
      assertPodeOperarViagem(user, viagem);
    }
  }
}
