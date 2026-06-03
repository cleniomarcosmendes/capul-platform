import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class AtribuirFuncionarioDto {
  // Matrícula do funcionário no Protheus (cadastro de funcionários, sem senha).
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  matricula: string;

  // Nome resolvido pelo frontend (lookup INFOCLIENTES). O backend revalida no
  // Protheus e prefere o nome autoritativo; este é fallback se o ERP estiver fora.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nome?: string;
}
