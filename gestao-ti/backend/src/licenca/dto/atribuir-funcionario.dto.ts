import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AtribuirFuncionarioDto {
  // Matrícula do funcionário (cadastro de funcionários da empresa).
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  matricula: string;

  // Nome do funcionário. Desde 04/06/2026 o frontend faz autofill via Protheus
  // (operação infoFuncionario / portal RH, por matrícula); permanece obrigatório
  // e editável (fallback manual quando a matrícula não é encontrada).
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome: string;
}
