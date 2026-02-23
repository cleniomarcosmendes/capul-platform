import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Informe a senha atual' })
  @IsString()
  senhaAtual: string;

  @IsNotEmpty({ message: 'Informe a nova senha' })
  @IsString()
  @MinLength(6, { message: 'A nova senha deve ter no minimo 6 caracteres' })
  novaSenha: string;
}
