import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Informe a senha atual' })
  @IsString()
  senhaAtual: string;

  @IsNotEmpty({ message: 'Informe a nova senha' })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  @Matches(/(?=.*[a-z])/, { message: 'Senha deve conter pelo menos uma letra minuscula' })
  @Matches(/(?=.*[A-Z])/, { message: 'Senha deve conter pelo menos uma letra maiuscula' })
  @Matches(/(?=.*\d)/, { message: 'Senha deve conter pelo menos um numero' })
  novaSenha: string;
}
