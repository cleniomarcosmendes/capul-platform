import { IsString, IsOptional, IsNumber, IsDateString, IsUUID, Min, Max } from 'class-validator';

export class CreateApontamentoDto {
  @IsDateString()
  data: string;

  @IsNumber()
  @Min(0.25)
  @Max(24)
  horas: number;

  @IsString()
  descricao: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsUUID()
  faseId?: string;
}
