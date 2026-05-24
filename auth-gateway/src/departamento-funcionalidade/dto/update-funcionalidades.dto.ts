import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Workspace Multi-Departamento (Onda 1 Sub-fase 1.6.2 — D32).
 * Bulk update das funcionalidades habilitadas de um departamento.
 *
 * Espelha o enum `core.FuncionalidadeWorkspace` (14 valores — 12 originais
 * + PAINEL_GESTAO_CHAMADO/PROJETO adicionadas em 24/05).
 */
export enum FuncionalidadeWorkspaceDto {
  CHAMADO = 'CHAMADO',
  PROJETO = 'PROJETO',
  OS = 'OS',
  EQUIPE = 'EQUIPE',
  CONTRATO = 'CONTRATO',
  NOTA_FISCAL = 'NOTA_FISCAL',
  SOFTWARE = 'SOFTWARE',
  LICENCA = 'LICENCA',
  ATIVO = 'ATIVO',
  PARADA = 'PARADA',
  INDICADOR_OPERACIONAL = 'INDICADOR_OPERACIONAL',
  INDICADOR_ESTRATEGICO = 'INDICADOR_ESTRATEGICO',
  PAINEL_GESTAO_CHAMADO = 'PAINEL_GESTAO_CHAMADO',
  PAINEL_GESTAO_PROJETO = 'PAINEL_GESTAO_PROJETO',
}

export class FuncionalidadeStatusDto {
  @IsEnum(FuncionalidadeWorkspaceDto)
  @IsNotEmpty()
  funcionalidade: FuncionalidadeWorkspaceDto;

  @IsBoolean()
  ativo: boolean;
}

export class UpdateFuncionalidadesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FuncionalidadeStatusDto)
  funcionalidades: FuncionalidadeStatusDto[];
}
