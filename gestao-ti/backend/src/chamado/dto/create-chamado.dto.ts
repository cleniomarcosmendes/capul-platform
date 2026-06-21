import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength, IsArray, IsUUID, ArrayMaxSize } from 'class-validator';
import { CanalOrigemSac, Prioridade, Visibilidade } from '@prisma/client';

export class CreateChamadoDto {
  @IsString()
  @IsNotEmpty({ message: 'Titulo e obrigatorio' })
  @MaxLength(200)
  titulo: string;

  @IsString()
  @IsNotEmpty({ message: 'Descricao e obrigatoria' })
  @MaxLength(5000)
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
  @MaxLength(500)
  softwareNome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
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
  @MaxLength(45)
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

  /**
   * Senha do colaborador no portal RH — usada SÓ para revalidar a matrícula no
   * loginPortal (defesa em profundidade: a tela já valida, mas o backend não
   * confia no cliente). TRANSIENTE: nunca é persistida nem logada.
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  senhaColaborador?: string;

  // SAC (Fase 1) — dados do cliente externo (o colaborador registra em nome dele).
  // Só fazem sentido no workspace SAC; o frontend exibe condicionalmente (1c).
  @IsOptional()
  @IsString()
  @MaxLength(150)
  clienteNome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  clienteEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  clienteTelefone?: string;

  @IsOptional()
  @IsEnum(CanalOrigemSac)
  canalOrigem?: CanalOrigemSac;

  /**
   * IDs dos usuarios a adicionar em copia no chamado.
   * Validacao no service: nao pode incluir membro ativo de equipe
   * (impede contornar designacao de tecnico via "em copia").
   * Limite de 20 por chamado evita abuso/erro.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  copiasUsuariosIds?: string[];
}

/** Payload para adicionar copias em um chamado existente. */
export class AddChamadoCopiasDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  usuariosIds: string[];
}
