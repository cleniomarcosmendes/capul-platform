import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class AddMembroDto {
  @IsString()
  @IsNotEmpty({ message: 'ID do usuário é obrigatório' })
  usuarioId: string;

  @IsOptional()
  @IsBoolean()
  isLider?: boolean;

  @IsOptional()
  @IsBoolean()
  podeGerirContratos?: boolean;

  @IsOptional()
  @IsBoolean()
  podeGerirCompras?: boolean;
}
