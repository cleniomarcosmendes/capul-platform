import { IsString, IsUUID, IsOptional, MaxLength, IsDateString, IsBoolean } from 'class-validator';

export class CreateTerceirizadoDto {
  @IsUUID()
  usuarioId: string;

  @IsString()
  @MaxLength(100)
  funcao: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  empresa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  especialidade?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}

export class UpdateTerceirizadoDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  funcao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  empresa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  especialidade?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
