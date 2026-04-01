import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { TipoNotificacao } from '@prisma/client';

export class CreateNotificacaoDto {
  @IsEnum(TipoNotificacao)
  tipo: TipoNotificacao;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  mensagem: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  dadosJson?: string;

  @IsUUID()
  usuarioId: string;
}
