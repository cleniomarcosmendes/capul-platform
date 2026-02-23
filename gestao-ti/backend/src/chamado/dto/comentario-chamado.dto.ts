import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class ComentarioChamadoDto {
  @IsString()
  @IsNotEmpty({ message: 'Comentario e obrigatorio' })
  descricao: string;

  @IsOptional()
  @IsBoolean()
  publico?: boolean;
}
