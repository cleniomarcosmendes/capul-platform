import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { TipoDependencia } from '@prisma/client';

export class CreateDependenciaDto {
  @IsUUID()
  projetoDestinoId: string;

  @IsEnum(TipoDependencia)
  tipo: TipoDependencia;

  @IsOptional()
  @IsString()
  descricao?: string;
}
