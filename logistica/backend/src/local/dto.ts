import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CriarLocalClienteHttpDto {
  @IsString() @IsNotEmpty() @MaxLength(40) clienteMatricula!: string;
  @IsOptional() @IsString() @MaxLength(120) clienteNome?: string;
  @IsOptional() @IsIn(['PROPRIEDADE', 'ENTREGA', 'OUTRO']) tipo?: 'PROPRIEDADE' | 'ENTREGA' | 'OUTRO';
  @IsString() @IsNotEmpty() @MaxLength(120) nome!: string;
  @IsOptional() @IsString() @MaxLength(120) municipio?: string;
}
