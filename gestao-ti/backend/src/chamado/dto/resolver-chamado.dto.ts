import { IsString, IsOptional, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

export class ResolverChamadoDto {
  @IsString()
  @IsNotEmpty({ message: 'A descricao da resolucao e obrigatoria' })
  descricao: string;
}

export class FecharChamadoDto {
  @IsOptional()
  @IsString()
  descricao?: string;
}

export class ReabrirChamadoDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}

export class CsatDto {
  @IsInt()
  @Min(1)
  @Max(5)
  nota: number;

  @IsOptional()
  @IsString()
  comentario?: string;
}
