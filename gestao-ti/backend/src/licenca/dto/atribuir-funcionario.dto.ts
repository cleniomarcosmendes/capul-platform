import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AtribuirFuncionarioDto {
  // Matrícula do funcionário (cadastro de funcionários da empresa).
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  matricula: string;

  // Nome do funcionário (digitado). NÃO há endpoint Protheus que resolva o nome
  // de funcionário por matrícula sem senha — o INFOCLIENTES é cadastro de CLIENTES,
  // não funcionários (ver pendência Protheus / memory). Por isso é informado aqui.
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome: string;
}
