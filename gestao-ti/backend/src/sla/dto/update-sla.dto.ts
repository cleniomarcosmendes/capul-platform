import { IsString, IsOptional, IsInt, Min, IsEnum, MaxLength } from 'class-validator';
import { Prioridade } from '@prisma/client';

export class UpdateSlaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
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
