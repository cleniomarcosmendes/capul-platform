import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { StatusGeral } from '@prisma/client';

export class UpdateMembroDto {
  @IsOptional()
  @IsBoolean()
  isLider?: boolean;

  @IsOptional()
  @IsBoolean()
  podeGerirContratos?: boolean;

  @IsOptional()
  @IsBoolean()
  podeGerirCompras?: boolean;

  @IsOptional()
  @IsEnum(StatusGeral, { message: 'Status deve ser ATIVO ou INATIVO' })
  status?: StatusGeral;
}
