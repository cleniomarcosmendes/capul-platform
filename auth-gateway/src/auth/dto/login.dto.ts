import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Informe o username ou email' })
  @IsString()
  login: string;

  @IsNotEmpty({ message: 'Informe a senha' })
  @IsString()
  @MinLength(6)
  senha: string;
}
