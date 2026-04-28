import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import { CertificadoService } from './certificado.service.js';
import { UploadCertificadoDto } from './dto/upload-certificado.dto.js';
import { AtualizarObservacoesDto } from './dto/atualizar-observacoes.dto.js';

@Controller('certificado')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class CertificadoController {
  constructor(private readonly service: CertificadoService) {}

  /**
   * Lista todos os certificados cadastrados. GESTOR_FISCAL e ADMIN_TI.
   */
  @Get()
  @RoleMinima('GESTOR_FISCAL')
  async listar() {
    return this.service.listar();
  }

  /**
   * Retorna o certificado ativo (ou 200 com null se nenhum). Usado pela UI
   * para mostrar status do certificado e alerta de renovação.
   */
  @Get('ativo')
  @RoleMinima('GESTOR_FISCAL')
  async ativo() {
    return this.service.getAtivo();
  }

  /**
   * Upload de novo certificado A1 (.pfx). Apenas ADMIN_TI.
   *
   * Content-Type: multipart/form-data
   * Campos:
   *   - file: arquivo .pfx (required)
   *   - senha: senha do .pfx (required)
   *   - observacoes: texto livre (opcional)
   */
  @Post('upload')
  @RoleMinima('ADMIN_TI')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 }, // 100 KB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadCertificadoDto,
    @CurrentUser() _user: FiscalAuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Campo `file` obrigatório (envie o arquivo .pfx).');
    }
    if (!file.originalname.toLowerCase().endsWith('.pfx') && !file.originalname.toLowerCase().endsWith('.p12')) {
      throw new BadRequestException('Arquivo deve ter extensão .pfx ou .p12.');
    }
    return this.service.upload(file.originalname, file.buffer, body.senha, body.observacoes);
  }

  /**
   * Ativa um certificado existente. Desativa automaticamente o anterior.
   * Apenas ADMIN_TI.
   */
  @Post(':id/ativar')
  @HttpCode(200)
  @RoleMinima('ADMIN_TI')
  async ativar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.ativar(id);
  }

  /**
   * Atualiza apenas o campo `observacoes` (texto livre — uso comum:
   * documentar histórico de renovação, contexto, próximas datas).
   * Não muda binário, senha ou status ativo. Apenas ADMIN_TI.
   */
  @Patch(':id')
  @RoleMinima('ADMIN_TI')
  async atualizarObservacoes(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AtualizarObservacoesDto,
  ) {
    return this.service.atualizarObservacoes(id, body.observacoes ?? null);
  }

  /**
   * Remove um certificado. Não pode ser o ativo. Apenas ADMIN_TI.
   */
  @Delete(':id')
  @HttpCode(204)
  @RoleMinima('ADMIN_TI')
  async remover(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.service.remover(id);
  }
}
