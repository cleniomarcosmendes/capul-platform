import {
  Body, Controller, Delete, Get, Header, Headers, Param, Patch, Post, Query,
  StreamableFile, UploadedFile, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { rolesLogistica } from '../common/roles-logistica.js';
import { DespesaService, type FiltroAnalise, type ReciboBinario } from './despesa.service.js';
import {
  CriarTipoDespesaDto, AtualizarTipoDespesaDto, LancarDespesaDto,
  LancarDespesaViagemDto, ContestarDespesaDto, ListarDespesasQuery,
  CriarFornecedorDespesaDto, AtualizarFornecedorDespesaDto, AtualizarDespesaDto,
  MarcarAnormalidadeDto, RatearDespesaDto,
} from './dto.js';

/** Converte o arquivo do multer no binário do recibo (ou undefined). */
const reciboDe = (f?: Express.Multer.File): ReciboBinario | undefined =>
  f ? { buffer: f.buffer, mimetype: f.mimetype, size: f.size } : undefined;
/** Vários arquivos → binários (AnyFiles pega 'comprovante' legado OU 'comprovantes[]'). */
const recibosDe = (fs?: Express.Multer.File[]): ReciboBinario[] =>
  (fs ?? []).map((f) => ({ buffer: f.buffer, mimetype: f.mimetype, size: f.size }));


/** Extrai os filtros opcionais da Análise da Frota dos query params (ignora vazios). */
function filtroDe(q: Record<string, string>): FiltroAnalise {
  const f: FiltroAnalise = {};
  if (q.veiculoId) f.veiculoId = q.veiculoId;
  if (q.tipoDespesaId) f.tipoDespesaId = q.tipoDespesaId;
  if (q.departamentoId) f.departamentoId = q.departamentoId;
  if (q.finalidade) f.finalidade = q.finalidade;
  if (q.porte) f.porte = q.porte;
  if (q.propriedade) f.propriedade = q.propriedade;
  if (q.normalidade === 'normal' || q.normalidade === 'anormal') f.normalidade = q.normalidade;
  return f;
}

// Controle de acesso real (gestor x supervisor) é enforced no service; o @Roles
// aqui só barra quem não opera frota. ADMIN sempre passa (RolesGuard).
@Controller('despesas')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA')
export class DespesaController {
  constructor(private readonly despesas: DespesaService) {}

  // ---- Tipos de despesa ----
  // Leitura liberada ao REGISTRADOR_FROTA — precisa apontar o tipo ao lançar
  // despesa na viagem (o cadastro de tipos, abaixo, segue só GESTOR_FROTA).
  // (O fluxo Supervisores/RDV tem endpoint PRÓPRIO: GET /supervisor/tipos-despesa.)
  @Get('tipos')
  @Roles('REGISTRADOR_FROTA', 'ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
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
  // Leitura liberada ao REGISTRADOR_FROTA — escolhe o fornecedor ao lançar despesa.
  @Get('fornecedores')
  @Roles('REGISTRADOR_FROTA', 'ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA')
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
    return this.despesas.listar(user, rolesLogistica(user), q);
  }

  @Get('indicadores')
  indicadores(@CurrentUser() user: JwtPayload, @Query('mes') mes: string, @Query('ano') ano: string) {
    const now = new Date();
    return this.despesas.indicadores(user, rolesLogistica(user), Number(mes) || now.getUTCMonth() + 1, Number(ano) || now.getUTCFullYear());
  }

  /** Análise — total agrupado por veículo/tipo/fornecedor/departamento (manchete + grupos). */
  @Get('indicadores/analitico')
  indicadoresAnalitico(@CurrentUser() user: JwtPayload, @Query('mes') mes: string, @Query('ano') ano: string, @Query() q: Record<string, string>) {
    const now = new Date();
    return this.despesas.indicadoresAnalitico(user, rolesLogistica(user), Number(mes) || now.getUTCMonth() + 1, Number(ano) || now.getUTCFullYear(), filtroDe(q));
  }

  /** Análise — despesas que compõem um grupo (drill-down). */
  @Get('indicadores/documentos')
  indicadoresDocumentos(
    @CurrentUser() user: JwtPayload,
    @Query('mes') mes: string, @Query('ano') ano: string,
    @Query('dimensao') dimensao: string, @Query('chave') chave: string,
    @Query() q: Record<string, string>,
  ) {
    const now = new Date();
    return this.despesas.indicadoresDocumentos(user, rolesLogistica(user), Number(mes) || now.getUTCMonth() + 1, Number(ano) || now.getUTCFullYear(), dimensao, chave, filtroDe(q));
  }

  /** Lançamento direto (supervisor/gestor) → APROVADA. Recibo (foto/PDF) opcional. */
  @Post()
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 15 * 1024 * 1024, files: 5 } }))
  lancarDireto(
    @Body() dto: LancarDespesaDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() comprovantes?: Express.Multer.File[],
  ) {
    return this.despesas.lancarDireto(dto, user, rolesLogistica(user), recibosDe(comprovantes));
  }

  /** Rateio de uma nota: 1 documento → vários tipos no mesmo veículo (cada um vira despesa APROVADA). Recibos opcionais. */
  @Post('ratear')
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 15 * 1024 * 1024, files: 5 } }))
  ratear(
    @Body() dto: RatearDespesaDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() comprovantes?: Express.Multer.File[],
  ) {
    return this.despesas.ratear(dto, user, rolesLogistica(user), recibosDe(comprovantes));
  }

  /** Lançamento na viagem em curso → PENDENTE (herda o condutor da viagem). Recibos opcionais. */
  @Post('viagem')
  // Operacional: o REGISTRADOR_FROTA pode lançar na viagem (vira PENDENTE → supervisor aprova).
  @Roles('REGISTRADOR_FROTA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA')
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 15 * 1024 * 1024, files: 5 } }))
  lancarNaViagem(
    @Body() dto: LancarDespesaViagemDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() comprovantes?: Express.Multer.File[],
    @Headers('x-condutor-token') condutorToken?: string,
  ) {
    return this.despesas.lancarNaViagem(dto, user, recibosDe(comprovantes), condutorToken);
  }

  /** Lançamento de despesa na ROTA DE ENTREGA (app do entregador) → custo do
   *  veículo. Sem token de condutor: o entregador é o dono da rota. Recibos opcionais. */
  @Post('viagem-entrega')
  @Roles('ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 15 * 1024 * 1024, files: 5 } }))
  lancarNaViagemEntrega(
    @Body() dto: LancarDespesaViagemDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() comprovantes?: Express.Multer.File[],
  ) {
    return this.despesas.lancarNaViagemEntrega(dto, user, rolesLogistica(user), recibosDe(comprovantes));
  }

  /** Download do recibo LEGADO (1 anexo, campo antigo) — escopo gestor/supervisor do veículo. */
  @Get(':id/comprovante')
  @Header('Cache-Control', 'private, no-store')
  async comprovante(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<StreamableFile> {
    const { buffer, mimeType } = await this.despesas.obterRecibo(id, user, rolesLogistica(user));
    return new StreamableFile(buffer, { type: mimeType, disposition: `inline; filename="recibo-${id}"` });
  }
  /** Download de um anexo (novo — vários por despesa). */
  @Get(':id/anexos/:anexoId')
  @Header('Cache-Control', 'private, no-store')
  async anexo(@Param('id') id: string, @Param('anexoId') anexoId: string, @CurrentUser() user: JwtPayload): Promise<StreamableFile> {
    const { buffer, mimeType } = await this.despesas.obterAnexo(id, anexoId, user, rolesLogistica(user));
    return new StreamableFile(buffer, { type: mimeType, disposition: `inline; filename="anexo-${anexoId}"` });
  }
  @Delete(':id/anexos/:anexoId')
  removerAnexo(@Param('id') id: string, @Param('anexoId') anexoId: string, @CurrentUser() user: JwtPayload) {
    return this.despesas.removerAnexo(id, anexoId, user, rolesLogistica(user));
  }

  /** Editar despesa: gestor de frota / supervisor do veículo / supervisor do
   *  departamento — ou o CONDUTOR que se identificou nesta viagem (login PADRÃO). */
  @Patch(':id')
  @Roles('REGISTRADOR_FROTA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA')
  atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarDespesaDto,
    @CurrentUser() user: JwtPayload,
    @Headers('x-condutor-token') condutorToken?: string,
  ) {
    return this.despesas.atualizar(id, dto, user, rolesLogistica(user), condutorToken);
  }

  /** Excluir despesa — mesma regra do editar. */
  @Delete(':id')
  @Roles('REGISTRADOR_FROTA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA')
  excluir(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Headers('x-condutor-token') condutorToken?: string,
  ) {
    return this.despesas.excluir(id, user, rolesLogistica(user), condutorToken);
  }

  @Patch(':id/aprovar')
  aprovar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.despesas.aprovar(id, user, rolesLogistica(user));
  }

  @Patch(':id/contestar')
  contestar(@Param('id') id: string, @Body() dto: ContestarDespesaDto, @CurrentUser() user: JwtPayload) {
    return this.despesas.contestar(id, dto, user, rolesLogistica(user));
  }

  /** Sinaliza/remove anormalidade (mau uso) — só gestor de frota (enforced no service). */
  @Patch(':id/anormalidade')
  @Roles('GESTOR_FROTA')
  marcarAnormalidade(@Param('id') id: string, @Body() dto: MarcarAnormalidadeDto, @CurrentUser() user: JwtPayload) {
    return this.despesas.marcarAnormalidade(id, dto, user, rolesLogistica(user));
  }

  // :id genérico por último — não captura tipos/fornecedores/indicadores (literais
  // registrados antes). Usado pela tela de edição.
  @Get(':id')
  obter(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.despesas.obter(id, user, rolesLogistica(user));
  }
}
