import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ---------- ClienteLocal (recorrente sem matrícula) ----------
export class CreateClienteLocalDto {
  @IsString() @MinLength(2) @MaxLength(120)
  nome!: string;

  @IsOptional() @IsString() @MaxLength(20)
  telefone?: string;

  @IsOptional() @IsString() @MaxLength(255)
  observacao?: string;
}

export class UpdateClienteLocalDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  nome?: string;

  @IsOptional() @IsString() @MaxLength(20)
  telefone?: string;

  @IsOptional() @IsString() @MaxLength(255)
  observacao?: string;

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

// ---------- EnderecoEntrega (escopo por filial; filialId vem do token) ----------
export class CreateEnderecoDto {
  // Dono do endereço: matrícula (ERP) OU clienteLocalId. Ambos opcionais
  // (eventual ad-hoc não cadastra aqui, mas o endpoint aceita avulso se preciso).
  @IsOptional() @IsString() @MaxLength(30)
  matricula?: string;

  @IsOptional() @IsString()
  clienteLocalId?: string;

  @IsOptional() @IsString() @MaxLength(40)
  apelido?: string;

  @IsString() @MinLength(2) @MaxLength(150)
  logradouro!: string;

  @IsOptional() @IsString() @MaxLength(20)
  numero?: string;

  @IsOptional() @IsString() @MaxLength(80)
  complemento?: string;

  @IsOptional() @IsString() @MaxLength(80)
  bairro?: string;

  @IsOptional() @IsString() @MaxLength(80)
  cidade?: string;

  @IsOptional() @IsString() @MaxLength(2)
  uf?: string;

  @IsOptional() @IsString() @MaxLength(9)
  cep?: string;

  @IsOptional() @IsString() @MaxLength(150)
  pontoReferencia?: string;
}

export class UpdateEnderecoDto {
  @IsOptional() @IsString() @MaxLength(40) apelido?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) logradouro?: string;
  @IsOptional() @IsString() @MaxLength(20) numero?: string;
  @IsOptional() @IsString() @MaxLength(80) complemento?: string;
  @IsOptional() @IsString() @MaxLength(80) bairro?: string;
  @IsOptional() @IsString() @MaxLength(80) cidade?: string;
  @IsOptional() @IsString() @MaxLength(2) uf?: string;
  @IsOptional() @IsString() @MaxLength(9) cep?: string;
  @IsOptional() @IsString() @MaxLength(150) pontoReferencia?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}
