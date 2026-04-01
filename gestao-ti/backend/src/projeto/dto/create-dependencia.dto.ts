import { IsString, IsOptional, IsEnum, IsUUID, MaxLength } from 'class-validator';
import { TipoDependencia } from '@prisma/client';

export class CreateDependenciaDto {
  @IsUUID()
  projetoDestinoId: string;

  @IsEnum(TipoDependencia)
  tipo: TipoDependencia;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;
}
