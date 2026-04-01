import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { TipoSoftware, Criticidade, AmbienteSoftware } from '@prisma/client';

export class CreateSoftwareDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome e obrigatorio' })
  @MaxLength(150)
  nome: string;

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
  @MaxLength(2000)
  observacoes?: string;
}
