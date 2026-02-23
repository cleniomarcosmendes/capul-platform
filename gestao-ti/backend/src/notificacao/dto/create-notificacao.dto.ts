import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TipoNotificacao } from '@prisma/client';

export class CreateNotificacaoDto {
  @IsEnum(TipoNotificacao)
  tipo: TipoNotificacao;

  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  mensagem: string;

  @IsOptional()
  @IsString()
  dadosJson?: string;

  @IsUUID()
  usuarioId: string;
}
