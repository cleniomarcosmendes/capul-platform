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
 * Espelha o enum `core.FuncionalidadeWorkspace` (23 valores — 12 originais
 * + 2 do Painel de Gestão (24/05) + 9 dos Cadastros (S16.4 — 27/05)).
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
  // S16.4 — Cadastros operacionais
  CADASTRO_DEPARTAMENTO = 'CADASTRO_DEPARTAMENTO',
  CADASTRO_CENTRO_CUSTO = 'CADASTRO_CENTRO_CUSTO',
  CADASTRO_NATUREZA_FINANCEIRA = 'CADASTRO_NATUREZA_FINANCEIRA',
  CADASTRO_TIPO_CONTRATO = 'CADASTRO_TIPO_CONTRATO',
  CADASTRO_FORNECEDOR = 'CADASTRO_FORNECEDOR',
  CADASTRO_PRODUTO = 'CADASTRO_PRODUTO',
  CADASTRO_TIPO_PRODUTO = 'CADASTRO_TIPO_PRODUTO',
  CADASTRO_TIPO_PROJETO = 'CADASTRO_TIPO_PROJETO',
  CADASTRO_CATEGORIA_LICENCA = 'CADASTRO_CATEGORIA_LICENCA',
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
