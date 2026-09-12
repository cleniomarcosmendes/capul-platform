import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CriterioDto {
  /**
   * ⚠️ Só na criação — depois o código é imutável (é a solda com o seed e com
   * qualquer script que já o referencie). O service ignora este campo no update.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'O código aceita apenas letras, números e "_" — é identificador, não texto livre.',
  })
  codigo!: string;

  @IsString() @MinLength(2) @MaxLength(120) nome!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;

  @IsEnum(['CALCULADO', 'INFORMADO'] as const)
  origem!: 'CALCULADO' | 'INFORMADO';

  @IsEnum(['NUMERICO', 'DOMINIO'] as const)
  tipoValor!: 'NUMERICO' | 'DOMINIO';

  /**
   * ⭐ Vem do `<select>` alimentado por `GET /criterios/resolvers`, nunca
   * digitado. A validação (`assertCriterioSalvavel`) confere contra o registry
   * de qualquer jeito — o `<select>` é para o erro não chegar a acontecer, e a
   * validação é para ele não passar se acontecer.
   */
  @IsOptional() @IsString() @MaxLength(40) codigoCalculo?: string | null;

  @IsOptional() @IsString() @MaxLength(20) unidade?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class FaixaDto {
  @IsOptional() @IsNumber() limiteInferior?: number | null;
  @IsOptional() @IsNumber() limiteSuperior?: number | null;
  @IsOptional() @IsBoolean() inclusivoInf?: boolean;
  @IsOptional() @IsBoolean() inclusivoSup?: boolean;
  @IsOptional() @IsString() @MaxLength(20) valorDominio?: string | null;

  @IsNumber() @Min(0) @Max(100) pontuacao!: number;

  @IsOptional() @IsString() @MaxLength(200) rotulo?: string | null;
  @IsOptional() @IsInt() ordem?: number;
}

/**
 * O conjunto INTEIRO de faixas. Ver `CriterioService.salvarFaixas`: a validade
 * (buraco, sobreposição, fronteira) é propriedade do conjunto, não da faixa.
 */
export class FaixasDto {
  @ValidateNested({ each: true })
  @Type(() => FaixaDto)
  faixas!: FaixaDto[];
}
