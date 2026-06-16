import {
  Body, Controller, Get, Header, Param, Patch, Post, Query,
  StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { DespesaService, type ReciboBinario } from './despesa.service.js';
import {
  CriarTipoDespesaDto, AtualizarTipoDespesaDto, LancarDespesaDto,
  LancarDespesaViagemDto, ContestarDespesaDto, ListarDespesasQuery,
  CriarFornecedorDespesaDto, AtualizarFornecedorDespesaDto,
} from './dto.js';

/** Converte o arquivo do multer no binário do recibo (ou undefined). */
const reciboDe = (f?: Express.Multer.File): ReciboBinario | undefined =>
  f ? { buffer: f.buffer, mimetype: f.mimetype, size: f.size } : undefined;

const roleLogistica = (user: JwtPayload) => user.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role;

// Controle de acesso real (gestor x supervisor) é enforced no service; o @Roles
// aqui só barra quem não opera frota. ADMIN sempre passa (RolesGuard).
@Controller('despesas')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
export class DespesaController {
  constructor(private readonly despesas: DespesaService) {}

  // ---- Tipos de despesa ----
  @Get('tipos')
  listarTipos(@Query('ativos') ativos?: string) {
    return this.despesas.listarTipos(ativos === 'true' || ativos === '1');
  }

  @Post('tipos')
  @Roles('GESTOR_FROTA')
  criarTipo(@Body() dto: CriarTipoDespesaDto) {
    return this.despesas.criarTipo(dto);
  }

  @Patch('tipos/:id')
  @Roles('GESTOR_FROTA')
  atualizarTipo(@Param('id') id: string, @Body() dto: AtualizarTipoDespesaDto) {
    return this.despesas.atualizarTipo(id, dto);
  }

  // ---- Fornecedores (cadastro próprio da logística) ----
  @Get('fornecedores')
  listarFornecedores(@Query('ativos') ativos?: string) {
    return this.despesas.listarFornecedores(ativos === 'true' || ativos === '1');
  }

  @Post('fornecedores')
  @Roles('GESTOR_FROTA')
  criarFornecedor(@Body() dto: CriarFornecedorDespesaDto) {
    return this.despesas.criarFornecedor(dto);
  }

  @Patch('fornecedores/:id')
  @Roles('GESTOR_FROTA')
  atualizarFornecedor(@Param('id') id: string, @Body() dto: AtualizarFornecedorDespesaDto) {
    return this.despesas.atualizarFornecedor(id, dto);
  }

  // ---- Despesas ----
  @Get()
  listar(@CurrentUser() user: JwtPayload, @Query() q: ListarDespesasQuery) {
    return this.despesas.listar(user, roleLogistica(user), q);
  }

  @Get('indicadores')
  indicadores(@CurrentUser() user: JwtPayload, @Query('mes') mes: string, @Query('ano') ano: string) {
    const now = new Date();
    return this.despesas.indicadores(user, roleLogistica(user), Number(mes) || now.getUTCMonth() + 1, Number(ano) || now.getUTCFullYear());
  }

  /** Lançamento direto (supervisor/gestor) → APROVADA. Recibo (foto/PDF) opcional. */
  @Post()
  @UseInterceptors(FileInterceptor('comprovante', { limits: { fileSize: 15 * 1024 * 1024 } }))
  lancarDireto(
    @Body() dto: LancarDespesaDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() comprovante?: Express.Multer.File,
  ) {
    return this.despesas.lancarDireto(dto, user, roleLogistica(user), reciboDe(comprovante));
  }

  /** Lançamento na viagem em curso → PENDENTE (herda o condutor da viagem). Recibo opcional. */
  @Post('viagem')
  @UseInterceptors(FileInterceptor('comprovante', { limits: { fileSize: 15 * 1024 * 1024 } }))
  lancarNaViagem(
    @Body() dto: LancarDespesaViagemDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() comprovante?: Express.Multer.File,
  ) {
    return this.despesas.lancarNaViagem(dto, user, reciboDe(comprovante));
  }

  /** Download do recibo (foto/PDF do cupom) — escopo gestor/supervisor do veículo. */
  @Get(':id/comprovante')
  @Header('Cache-Control', 'private, no-store')
  async comprovante(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<StreamableFile> {
    const { buffer, mimeType } = await this.despesas.obterRecibo(id, user, roleLogistica(user));
    return new StreamableFile(buffer, { type: mimeType, disposition: `inline; filename="recibo-${id}"` });
  }

  @Patch(':id/aprovar')
  aprovar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.despesas.aprovar(id, user, roleLogistica(user));
  }

  @Patch(':id/contestar')
  contestar(@Param('id') id: string, @Body() dto: ContestarDespesaDto, @CurrentUser() user: JwtPayload) {
    return this.despesas.contestar(id, dto, user, roleLogistica(user));
  }
}
