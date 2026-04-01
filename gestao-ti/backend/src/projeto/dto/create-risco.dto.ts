import { IsString, IsOptional, IsEnum, IsUUID, MaxLength } from 'class-validator';
import { ProbabilidadeRisco, ImpactoRisco, StatusRisco } from '@prisma/client';

export class CreateRiscoDto {
  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsEnum(ProbabilidadeRisco)
  probabilidade: ProbabilidadeRisco;

  @IsEnum(ImpactoRisco)
  impacto: ImpactoRisco;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsEnum(StatusRisco)
  status?: StatusRisco;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  planoMitigacao?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
