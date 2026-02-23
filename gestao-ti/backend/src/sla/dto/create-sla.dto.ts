import { IsString, IsNotEmpty, IsInt, Min, IsEnum } from 'class-validator';
import { Prioridade } from '@prisma/client';

export class CreateSlaDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(Prioridade)
  prioridade: Prioridade;

  @IsInt()
  @Min(1)
  horasResposta: number;

  @IsInt()
  @Min(1)
  horasResolucao: number;

  @IsString()
  @IsNotEmpty()
  equipeId: string;
}
