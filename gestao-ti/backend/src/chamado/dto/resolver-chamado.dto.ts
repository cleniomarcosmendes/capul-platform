import { IsString, IsOptional } from 'class-validator';

export class ResolverChamadoDto {
  @IsOptional()
  @IsString()
  descricao?: string;
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
  nota: number;

  @IsOptional()
  @IsString()
  comentario?: string;
}
