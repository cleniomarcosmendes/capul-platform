import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateChamadoExternoDto {
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  ano: number;

  @IsUUID()
  softwareId: string;

  @IsInt()
  @Min(0)
  qtdChamados: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;

  // Workspace Onda 2 C2.7 refino — depto-dono opcional. Se omitido,
  // resolveDepartamento cascata pega do JWT do user → fallback T.I.
  @IsOptional()
  @IsUUID()
  departamentoId?: string;
}

export class UpdateChamadoExternoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano?: number;

  @IsOptional()
  @IsUUID()
  softwareId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtdChamados?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}
