import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateEquipeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  sigla?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  cor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icone?: string;

  @IsOptional()
  @IsBoolean()
  aceitaChamadoExterno?: boolean;

  @IsOptional()
  @IsString()
  emailEquipe?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}
