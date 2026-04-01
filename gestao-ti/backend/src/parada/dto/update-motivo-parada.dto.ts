import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateMotivoParadaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
