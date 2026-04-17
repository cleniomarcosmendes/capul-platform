import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateChamadoHeaderDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;
}
