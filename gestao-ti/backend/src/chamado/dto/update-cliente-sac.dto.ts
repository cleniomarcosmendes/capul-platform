import { IsEmail, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * Edição dos dados do cliente externo em um chamado de SAC já aberto (staff).
 * Resolve o caso do chamado aberto sem e-mail (a busca por matrícula traz
 * nome/telefone, mas a SA1 do Protheus não devolve e-mail) — sem isso não havia
 * como responder o cliente por e-mail nem corrigir depois.
 * Todos opcionais; e-mail só é validado como formato quando não-vazio
 * (string vazia = limpar o campo).
 */
export class UpdateClienteSacDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clienteNome?: string;

  @IsOptional()
  @ValidateIf((o) => o.clienteEmail !== undefined && o.clienteEmail !== '')
  @IsEmail({}, { message: 'E-mail do cliente inválido.' })
  @MaxLength(150)
  clienteEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  clienteTelefone?: string;
}
