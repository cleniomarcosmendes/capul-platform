import { PartialType } from '@nestjs/mapped-types';
import { CreateLicencaDto } from './create-licenca.dto.js';

/**
 * Auditoria 10/05/2026 #DT3-M1 — refatorado para PartialType.
 * Antes: 51 linhas duplicadas de CreateLicencaDto com `?:`.
 */
export class UpdateLicencaDto extends PartialType(CreateLicencaDto) {}
