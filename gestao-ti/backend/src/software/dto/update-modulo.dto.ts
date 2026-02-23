import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { StatusModulo } from '@prisma/client';

export class UpdateModuloDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  versao?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class UpdateStatusModuloDto {
  @IsEnum(StatusModulo)
  status: StatusModulo;
}
