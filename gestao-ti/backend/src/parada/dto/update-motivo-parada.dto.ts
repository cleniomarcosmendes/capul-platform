import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateMotivoParadaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
