import { IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Capabilities conhecidas (whitelist — não aceitar string arbitrária).
 * v1: só acesso a PII de sócios (Busca por Sócio + QSA da Consulta
 * Cadastral). Plano: docs/PLANO_FISCAL_CONSULTA_SOCIOS_LGPD_v1.md
 */
export const CAPABILITIES = ['FISCAL_CONSULTA_SOCIOS'] as const;
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
