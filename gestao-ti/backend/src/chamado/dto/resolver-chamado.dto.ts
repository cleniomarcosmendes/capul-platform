import { IsString, IsOptional, IsNotEmpty, IsInt, Min, Max, MaxLength } from 'class-validator';

export class ResolverChamadoDto {
  @IsString()
  @IsNotEmpty({ message: 'A descricao da resolucao e obrigatoria' })
  @MaxLength(5000)
  descricao: string;
}

export class FecharChamadoDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;
}

export class ReabrirChamadoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motivo?: string;
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
