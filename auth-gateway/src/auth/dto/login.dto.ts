import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Informe o username ou email' })
  @IsString()
  login: string;

  @IsNotEmpty({ message: 'Informe a senha' })
  @IsString()
  @MinLength(6)
  senha: string;

  // Login mobile (app): a presença de deviceId ativa a sessão de dispositivo +
  // access curto (15m). Web não envia → fluxo inalterado (60m).
  @IsOptional() @IsString() @MaxLength(128)
  deviceId?: string;

  @IsOptional() @IsString() @MaxLength(200)
  deviceInfo?: string;

  @IsOptional() @IsString() @MaxLength(20)
  plataforma?: string;
}
