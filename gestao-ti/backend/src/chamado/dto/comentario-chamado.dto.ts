import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class ComentarioChamadoDto {
  @IsString()
  @IsNotEmpty({ message: 'Comentario e obrigatorio' })
  @MaxLength(5000)
  descricao: string;

  @IsOptional()
  @IsBoolean()
  publico?: boolean;
}
