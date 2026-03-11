import { IsString, IsNotEmpty } from 'class-validator';

export class AtribuirUsuarioDto {
  @IsString()
  @IsNotEmpty()
  usuarioId: string;
}
