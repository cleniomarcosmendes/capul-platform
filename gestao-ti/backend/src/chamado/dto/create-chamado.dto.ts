import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { Prioridade, Visibilidade } from '@prisma/client';

export class CreateChamadoDto {
  @IsString()
  @IsNotEmpty({ message: 'Titulo e obrigatorio' })
  @MaxLength(200)
  titulo: string;

  @IsString()
  @IsNotEmpty({ message: 'Descricao e obrigatoria' })
  descricao: string;

  @IsString()
  @IsNotEmpty({ message: 'Equipe destino e obrigatoria' })
  equipeAtualId: string;

  @IsOptional()
  @IsEnum(Visibilidade)
  visibilidade?: Visibilidade;

  @IsOptional()
  @IsEnum(Prioridade)
  prioridade?: Prioridade;

  @IsOptional()
  @IsString()
  softwareNome?: string;

  @IsOptional()
  @IsString()
  moduloNome?: string;

  @IsOptional()
  @IsString()
  softwareId?: string;

  @IsOptional()
  @IsString()
  softwareModuloId?: string;

  @IsOptional()
  @IsString()
  catalogoServicoId?: string;

  @IsOptional()
  @IsString()
  projetoId?: string;

  @IsOptional()
  @IsString()
  filialId?: string;

  @IsOptional()
  @IsString()
  departamentoId?: string;

  @IsOptional()
  @IsString()
  ipMaquina?: string;

  @IsOptional()
  @IsString()
  ativoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  matriculaColaborador?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nomeColaborador?: string;
}
