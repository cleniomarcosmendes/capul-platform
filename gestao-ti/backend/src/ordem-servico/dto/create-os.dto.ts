import { IsString, IsNotEmpty, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateOsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsString()
  @IsNotEmpty()
  filialId: string;

  @IsOptional()
  @IsString()
  tecnicoId?: string;

  @IsOptional()
  @IsDateString()
  dataAgendamento?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
