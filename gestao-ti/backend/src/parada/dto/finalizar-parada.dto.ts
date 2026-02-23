import { IsOptional, IsDateString, IsString } from 'class-validator';

export class FinalizarParadaDto {
  @IsOptional()
  @IsDateString()
  fim?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
