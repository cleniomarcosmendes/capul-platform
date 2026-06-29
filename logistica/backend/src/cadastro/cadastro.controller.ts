import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { filialDoUsuario } from '../common/filial-scope.js';
import { ClienteLocalService } from './cliente-local.service.js';
import { EnderecoService } from './endereco.service.js';
import { BuscaService } from './busca.service.js';
import { CepService } from './cep.service.js';
import {
  CreateClienteLocalDto,
  CreateEnderecoDto,
  UpdateClienteLocalDto,
  UpdateEnderecoDto,
} from './dto.js';

/**
 * Cadastro do módulo Logística — clientes locais, endereços (globais) e a
 * busca unificada do operador. Exige perfil operacional do módulo LOGISTICA
 * (ADMIN passa sempre — RolesGuard).
 */
@Controller('cadastro')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class CadastroController {
  constructor(
    private readonly clientes: ClienteLocalService,
    private readonly enderecos: EnderecoService,
    private readonly busca: BuscaService,
    private readonly cepService: CepService,
  ) {}

  // ---------- Busca unificada ----------
  // Também usada no planejamento de visitas da Saída de Veículos (frota) → libera
  // os papéis de frota para a LEITURA (cadastro/escrita de cliente segue entrega).
  @Get('busca')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA')
  buscaUnificada(@Query('termo') termo: string, @CurrentUser() user: JwtPayload) {
    return this.busca.buscaUnificada(termo ?? '', filialDoUsuario(user));
  }

  // ---------- CEP (ViaCEP proxiado — CSP da plataforma é connect-src 'self') ----------
  @Get('cep/:cep')
  buscarCep(@Param('cep') cep: string) {
    return this.cepService.buscar(cep);
  }

  // ---------- Clientes locais ----------
  @Post('clientes-locais')
  criarCliente(@Body() dto: CreateClienteLocalDto, @CurrentUser() user: JwtPayload) {
    return this.clientes.create(dto, filialDoUsuario(user));
  }

  @Get('clientes-locais')
  listarClientes(@CurrentUser() user: JwtPayload, @Query('q') q?: string) {
    return this.clientes.list(q, filialDoUsuario(user));
  }

  @Get('clientes-locais/:id')
  obterCliente(@Param('id') id: string) {
    return this.clientes.findOne(id);
  }

  @Patch('clientes-locais/:id')
  atualizarCliente(@Param('id') id: string, @Body() dto: UpdateClienteLocalDto) {
    return this.clientes.update(id, dto);
  }

  @Delete('clientes-locais/:id')
  removerCliente(@Param('id') id: string) {
    return this.clientes.remove(id);
  }

  // ---------- Endereços (por filial) ----------
  @Post('enderecos')
  criarEndereco(@Body() dto: CreateEnderecoDto, @CurrentUser() user: JwtPayload) {
    return this.enderecos.create(dto, filialDoUsuario(user));
  }

  @Get('enderecos')
  listarEnderecos(
    @CurrentUser() user: JwtPayload,
    @Query('matricula') matricula?: string,
    @Query('clienteLocalId') clienteLocalId?: string,
  ) {
    return this.enderecos.list({ matricula, clienteLocalId, filialId: filialDoUsuario(user) });
  }

  @Patch('enderecos/:id')
  atualizarEndereco(@Param('id') id: string, @Body() dto: UpdateEnderecoDto) {
    return this.enderecos.update(id, dto);
  }

  @Delete('enderecos/:id')
  removerEndereco(@Param('id') id: string) {
    return this.enderecos.remove(id);
  }
}
