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
import { ClienteLocalService } from './cliente-local.service.js';
import { EnderecoService } from './endereco.service.js';
import { BuscaService } from './busca.service.js';
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
  ) {}

  // ---------- Busca unificada ----------
  @Get('busca')
  buscaUnificada(@Query('termo') termo: string) {
    return this.busca.buscaUnificada(termo ?? '');
  }

  // ---------- Clientes locais ----------
  @Post('clientes-locais')
  criarCliente(@Body() dto: CreateClienteLocalDto) {
    return this.clientes.create(dto);
  }

  @Get('clientes-locais')
  listarClientes(@Query('q') q?: string) {
    return this.clientes.list(q);
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

  // ---------- Endereços (globais) ----------
  @Post('enderecos')
  criarEndereco(@Body() dto: CreateEnderecoDto) {
    return this.enderecos.create(dto);
  }

  @Get('enderecos')
  listarEnderecos(
    @Query('matricula') matricula?: string,
    @Query('clienteLocalId') clienteLocalId?: string,
  ) {
    return this.enderecos.list({ matricula, clienteLocalId });
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
