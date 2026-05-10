import { PartialType } from '@nestjs/mapped-types';
import { CreateEquipeDto } from './create-equipe.dto.js';

/**
 * Auditoria 10/05/2026 #DT3-M1 — refatorado para PartialType.
 * Antes: 31 linhas duplicadas de CreateEquipeDto com `?:`.
 */
export class UpdateEquipeDto extends PartialType(CreateEquipeDto) {}
