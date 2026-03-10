import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateInteracaoPendenciaDto {
  @IsString()
  descricao: string;

  @IsOptional()
  @IsBoolean()
  publica?: boolean;
}
