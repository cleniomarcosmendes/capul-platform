import { PartialType } from '@nestjs/mapped-types';
import { IsEnum } from 'class-validator';
import { StatusAtivo } from '@prisma/client';
import { CreateAtivoDto } from './create-ativo.dto.js';

/**
 * Auditoria 10/05/2026 #DT3-M1 — refatorado para PartialType.
 * Antes: 41 linhas duplicadas de CreateAtivoDto com `?:`.
 */
export class UpdateAtivoDto extends PartialType(CreateAtivoDto) {}

export class UpdateStatusAtivoDto {
  @IsEnum(StatusAtivo)
  status: StatusAtivo;
}
