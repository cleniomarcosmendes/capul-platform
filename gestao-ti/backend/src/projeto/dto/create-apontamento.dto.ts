import { IsString, IsOptional, IsNumber, IsDateString, IsUUID, Min, Max, MaxLength } from 'class-validator';

export class CreateApontamentoDto {
  @IsDateString()
  data: string;

  @IsNumber()
  @Min(0.25)
  @Max(24)
  horas: number;

  @IsString()
  @MaxLength(5000)
  descricao: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  @IsOptional()
  @IsUUID()
  faseId?: string;
}
