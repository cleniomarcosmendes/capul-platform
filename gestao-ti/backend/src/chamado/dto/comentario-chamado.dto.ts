import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class ComentarioChamadoDto {
  @IsString()
  @IsNotEmpty({ message: 'Comentario e obrigatorio' })
  @MaxLength(5000)
  descricao: string;

  @IsOptional()
  @IsBoolean()
  publico?: boolean;

  /**
   * Quando true, marca o chamado como PENDENTE_USUARIO, força publico=true
   * e dispara notificação destacada pro solicitante. Usado pelo botão
   * "Solicitar info ao usuário" da UI. Default false (comentário regular).
   */
  @IsOptional()
  @IsBoolean()
  solicitarInfoUsuario?: boolean;
}
