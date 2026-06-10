import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/** Payload de validação de matrícula+senha do colaborador no portal RH. */
export class ValidarColaboradorDto {
  @IsString()
  @IsNotEmpty({ message: 'Matricula e obrigatoria' })
  @MaxLength(20)
  matricula: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha e obrigatoria' })
  @MaxLength(60)
  senha: string;
}
