import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModalidadeRateio } from '@prisma/client';

export class RateioItemDto {
  @IsString()
  centroCustoId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  percentual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorFixo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  parametro?: number;

  @IsOptional()
  @IsString()
  naturezaId?: string;
}

export class ConfigurarRateioDto {
  @IsEnum(ModalidadeRateio, { message: 'Modalidade de rateio invalida' })
  modalidade: ModalidadeRateio;

  @IsOptional()
  @IsString()
  criterio?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RateioItemDto)
  itens: RateioItemDto[];
}

export class SimularRateioDto {
  @IsEnum(ModalidadeRateio, { message: 'Modalidade de rateio invalida' })
  modalidade: ModalidadeRateio;

  @IsOptional()
  @IsString()
  criterio?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RateioItemDto)
  itens: RateioItemDto[];
}

export class ConfigurarRateioTemplateDto {
  @IsEnum(ModalidadeRateio, { message: 'Modalidade de rateio invalida' })
  modalidade: ModalidadeRateio;

  @IsOptional()
  @IsString()
  criterio?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RateioItemDto)
  itens: RateioItemDto[];
}

export class GerarRateioParcelaDto {
  @IsOptional()
  @IsBoolean()
  usarTemplate?: boolean;
}
