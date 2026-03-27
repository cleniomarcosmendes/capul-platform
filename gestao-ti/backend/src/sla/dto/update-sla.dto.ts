import { IsString, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Prioridade } from '@prisma/client';

export class UpdateSlaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  equipeId?: string;

  @IsOptional()
  @IsEnum(Prioridade)
  prioridade?: Prioridade;

  @IsOptional()
  @IsInt()
  @Min(1)
  horasResposta?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  horasResolucao?: number;
}
