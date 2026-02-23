import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { StatusGeral } from '@prisma/client';

export class UpdateMembroDto {
  @IsOptional()
  @IsBoolean()
  isLider?: boolean;

  @IsOptional()
  @IsEnum(StatusGeral, { message: 'Status deve ser ATIVO ou INATIVO' })
  status?: StatusGeral;
}
