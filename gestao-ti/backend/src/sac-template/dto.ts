import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSacTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  titulo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  corpo!: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsInt()
  ordem?: number;
}

export class UpdateSacTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  corpo?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsInt()
  ordem?: number;
}
