import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { TipoSoftware, Criticidade, AmbienteSoftware, StatusSoftware } from '@prisma/client';

export class UpdateSoftwareDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fabricante?: string;

  @IsOptional()
  @IsEnum(TipoSoftware)
  tipo?: TipoSoftware;

  @IsOptional()
  @IsEnum(Criticidade)
  criticidade?: Criticidade;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  versaoAtual?: string;

  @IsOptional()
  @IsEnum(AmbienteSoftware)
  ambiente?: AmbienteSoftware;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  urlAcesso?: string;

  @IsOptional()
  @IsString()
  equipeResponsavelId?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class UpdateStatusSoftwareDto {
  @IsEnum(StatusSoftware)
  status: StatusSoftware;
}
