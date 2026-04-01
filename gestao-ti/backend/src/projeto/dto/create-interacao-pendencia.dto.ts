import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateInteracaoPendenciaDto {
  @IsString()
  @MaxLength(5000)
  descricao: string;

  @IsOptional()
  @IsBoolean()
  publica?: boolean;
}
