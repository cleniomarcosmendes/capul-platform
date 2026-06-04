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

  // Visibilidade da equipe na abertura de chamado. true => privada (só staff
  // do próprio departamento pode abrir direto). Default público.
  @IsOptional()
  @IsBoolean()
  privada?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailEquipe?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;

  // Workspace Sub-fase 1.6.1 — UI multi-perfil envia depto explícito
  @IsOptional()
  @IsString()
  departamentoId?: string;
}
