import { IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Capabilities conhecidas (whitelist — não aceitar string arbitrária).
 *
 * - `FISCAL_CONSULTA_SOCIOS` — PII de sócios (Busca por Sócio + QSA da Consulta
 *   Cadastral). Plano: docs/PLANO_FISCAL_CONSULTA_SOCIOS_LGPD_v1.md
 * - `OVERSIGHT_PLATAFORMA` — alcance em TODOS os departamentos do Workspace. Já era o
 *   bypass dos cadastros operacionais (E1) e, desde 26/08, é também o substituto do
 *   alcance implícito que "estar num departamento de T.I." dava. ⚠️ Faltava aqui: a
 *   tela nova do Configurador concedia e tomava 400 "Capability desconhecida", ou seja,
 *   depois do deploy ninguém conseguiria devolver o alcance a quem o perdeu. Achado
 *   pelo /security-review de 27/08 (falha fechada — não era brecha, era porta emperrada).
 *
 * ⚠️ Ao criar capability nova: ela precisa entrar AQUI e na tela do Configurador —
 * senão nasce inalcançável (backend) ou invisível (tela).
 */
export const CAPABILITIES = ['FISCAL_CONSULTA_SOCIOS', 'OVERSIGHT_PLATAFORMA'] as const;
export type Capability = (typeof CAPABILITIES)[number];

export class ConcederCapabilityDto {
  @IsNotEmpty()
  @IsIn(CAPABILITIES, { message: 'Capability desconhecida.' })
  capability: Capability;

  /** Justificativa obrigatória (LGPD — necessidade de conhecer). */
  @IsNotEmpty({ message: 'Motivo é obrigatório (LGPD).' })
  @IsString()
  @MinLength(5, { message: 'Motivo muito curto.' })
  motivo: string;
}
