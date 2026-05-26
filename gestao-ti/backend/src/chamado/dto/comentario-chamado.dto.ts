import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsUUID, ArrayMaxSize, MaxLength } from 'class-validator';

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

  /**
   * IDs de anexos a vincular ao comentario (decisao 13/05/2026 — chat-style).
   * Anexos sao gravados normalmente em AnexoChamado (vinculados ao chamado).
   * Service insere marcadores `[anexo:<uuid>]` na descricao para o front
   * renderizar chip clicavel inline. Abordagem leve sem FK comentarioId.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID(undefined, { each: true })
  anexosIds?: string[];

  /**
   * Quando true (default false), além da notificação in-app, dispara também
   * e-mail aos envolvidos. Filtros: comentário interno (publico=false) nunca
   * envia; chamado PRIVADO suprime e-mail para cópias (não-TI); preferência
   * `email.chamados` do destinatário pode opt-out.
   */
  @IsOptional()
  @IsBoolean()
  emailEnvolvidos?: boolean;
}
