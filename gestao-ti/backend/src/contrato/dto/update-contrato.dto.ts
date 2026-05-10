import { PartialType } from '@nestjs/mapped-types';
import { IsEnum } from 'class-validator';
import { StatusContrato } from '@prisma/client';
import { CreateContratoDto } from './create-contrato.dto.js';

/**
 * Auditoria 10/05/2026 #DT3-M1 — refatorado para PartialType.
 * Antes: 76 linhas duplicadas de CreateContratoDto com `?:`.
 */
export class UpdateContratoDto extends PartialType(CreateContratoDto) {}

export class UpdateStatusContratoDto {
  @IsEnum(StatusContrato, { message: 'Status invalido' })
  status: StatusContrato;
}
