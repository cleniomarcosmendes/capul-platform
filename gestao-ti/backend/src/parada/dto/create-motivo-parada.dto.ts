import { IsString, IsOptional } from 'class-validator';

export class CreateMotivoParadaDto {
  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
