import { IsOptional, IsString } from 'class-validator';

export class CreateAnexoChamadoDto {
  @IsOptional()
  @IsString()
  descricao?: string;
}
