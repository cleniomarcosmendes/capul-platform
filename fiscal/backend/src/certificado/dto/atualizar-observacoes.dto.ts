import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO para PATCH /certificado/:id — atualiza apenas observações (texto livre).
 * Não permite alterar binário, senha, CNPJ, validade ou status ativo.
 */
export class AtualizarObservacoesDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string | null;
}
