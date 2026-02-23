import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateEquipeDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome da equipe é obrigatório' })
  @MaxLength(100)
  nome: string;

  @IsString()
  @IsNotEmpty({ message: 'Sigla da equipe é obrigatória' })
  @MaxLength(10)
  sigla: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  cor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icone?: string;

  @IsOptional()
  @IsBoolean()
  aceitaChamadoExterno?: boolean;

  @IsOptional()
  @IsString()
  emailEquipe?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}
