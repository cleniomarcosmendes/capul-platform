import { PartialType } from '@nestjs/mapped-types';
import { IsEnum } from 'class-validator';
import { StatusSoftware } from '@prisma/client';
import { CreateSoftwareDto } from './create-software.dto.js';

/**
 * Auditoria 10/05/2026 #DT3-M1 — refatorado para PartialType.
 * Antes: 38 linhas duplicadas de CreateSoftwareDto com `?:`.
 * PartialType cria automaticamente todas as props opcionais com os mesmos validators.
 */
export class UpdateSoftwareDto extends PartialType(CreateSoftwareDto) {}

export class UpdateStatusSoftwareDto {
  @IsEnum(StatusSoftware)
  status: StatusSoftware;
}
