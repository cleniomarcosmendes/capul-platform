import { IsEnum } from 'class-validator';
import { StatusGeral } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(StatusGeral, { message: 'Status deve ser ATIVO ou INATIVO' })
  status: StatusGeral;
}
