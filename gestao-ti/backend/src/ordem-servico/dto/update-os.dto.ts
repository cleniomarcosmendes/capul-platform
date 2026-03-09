import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class UpdateOsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  dataAgendamento?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
