import { IsOptional, IsDateString, IsString, MaxLength } from 'class-validator';

export class FinalizarParadaDto {
  @IsOptional()
  @IsDateString()
  fim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
