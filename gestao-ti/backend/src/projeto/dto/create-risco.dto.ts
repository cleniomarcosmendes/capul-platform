import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ProbabilidadeRisco, ImpactoRisco, StatusRisco } from '@prisma/client';

export class CreateRiscoDto {
  @IsString()
  titulo: string;

  @IsEnum(ProbabilidadeRisco)
  probabilidade: ProbabilidadeRisco;

  @IsEnum(ImpactoRisco)
  impacto: ImpactoRisco;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(StatusRisco)
  status?: StatusRisco;

  @IsOptional()
  @IsString()
  planoMitigacao?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
