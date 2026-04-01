import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateMotivoParadaDto {
  @IsString()
  @MaxLength(200)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;
}
