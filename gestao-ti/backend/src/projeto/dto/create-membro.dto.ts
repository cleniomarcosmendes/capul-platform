import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PapelRaci } from '@prisma/client';

export class CreateMembroDto {
  @IsUUID()
  usuarioId: string;

  @IsEnum(PapelRaci)
  papel: PapelRaci;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
