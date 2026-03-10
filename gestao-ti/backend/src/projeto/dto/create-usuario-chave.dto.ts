import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateUsuarioChaveDto {
  @IsUUID()
  usuarioId: string;

  @IsString()
  @MaxLength(100)
  funcao: string;
}
