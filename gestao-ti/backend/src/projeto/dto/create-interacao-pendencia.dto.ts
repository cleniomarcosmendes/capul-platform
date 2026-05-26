import { IsString, IsOptional, IsBoolean, IsArray, IsUUID, ArrayMaxSize, MaxLength } from 'class-validator';

export class CreateInteracaoPendenciaDto {
  @IsString()
  @MaxLength(5000)
  descricao: string;

  @IsOptional()
  @IsBoolean()
  publica?: boolean;

  /**
   * IDs de anexos (AnexoPendencia) a vincular a esta interacao (chat-style
   * 13/05/2026). Anexos sao gravados antes via upload; ao criar a interacao
   * o service atualiza interacao_id desses anexos. Diferente do chamado (que
   * usa marcador no texto), aqui usamos a FK formal — schema ja tem
   * AnexoPendencia.interacao_id.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID(undefined, { each: true })
  anexosIds?: string[];

  @IsOptional()
  @IsBoolean()
  emailEnvolvidos?: boolean;
}
