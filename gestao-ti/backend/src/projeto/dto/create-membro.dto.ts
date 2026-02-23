import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PapelRaci } from '@prisma/client';

export class CreateMembroDto {
  @IsUUID()
  usuarioId: string;

  @IsEnum(PapelRaci)
  papel: PapelRaci;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
