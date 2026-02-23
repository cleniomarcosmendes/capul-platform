import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateModuloDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome do modulo e obrigatorio' })
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  versao?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
