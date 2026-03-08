import { IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';

export class UpdateRegistroTempoChamadoDto {
  @IsOptional()
  @IsDateString()
  horaInicio?: string;

  @IsOptional()
  @IsDateString()
  horaFim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}
