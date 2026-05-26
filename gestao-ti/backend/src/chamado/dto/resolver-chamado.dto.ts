import { IsString, IsOptional, IsNotEmpty, IsInt, Min, Max, MaxLength, IsBoolean } from 'class-validator';

export class ResolverChamadoDto {
  @IsString()
  @IsNotEmpty({ message: 'A descricao da resolucao e obrigatoria' })
  @MaxLength(5000)
  descricao: string;

  @IsOptional()
  @IsBoolean()
  emailEnvolvidos?: boolean;
}

// FecharChamadoDto removido em 11/05/2026 (dead code via ts-prune — zero usos).
// Caso "fechar chamado" usa o fluxo regular ResolverChamadoDto + transição de status.

export class ReabrirChamadoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motivo?: string;

  @IsOptional()
  @IsBoolean()
  emailEnvolvidos?: boolean;
}

export class CsatDto {
  @IsInt()
  @Min(1)
  @Max(5)
  nota: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;
}
