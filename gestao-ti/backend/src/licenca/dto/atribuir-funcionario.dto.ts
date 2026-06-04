import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class AtribuirFuncionarioDto {
  // Matrícula do funcionário (cadastro de funcionários da empresa).
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  matricula: string;

  // Nome — IGNORADO pelo backend desde 04/06/2026: a fonte da verdade é o
  // Protheus (operação infoFuncionario, resolvido server-side pela matrícula).
  // Aceito como opcional só por compat com o frontend, que o envia preenchido.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nome?: string;
}
