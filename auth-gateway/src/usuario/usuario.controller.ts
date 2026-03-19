import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuarioService } from './usuario.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  UpdateStatusDto,
  AtribuirPermissaoDto,
} from './dto/create-usuario.dto';

@Controller('api/v1/core/usuarios')
@UseGuards(JwtAuthGuard)
export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  @Get()
  findAll(@Query('filialId') filialId?: string) {
    return this.usuarioService.findAll(filialId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usuarioService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuarioService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUsuarioDto) {
    return this.usuarioService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.usuarioService.updateStatus(id, dto.status);
  }

  @Patch(':id/reset-senha')
  resetSenha(@Param('id') id: string, @Body() body: { novaSenha: string }) {
    return this.usuarioService.resetSenha(id, body.novaSenha);
  }

  @Post(':id/permissoes')
  atribuirPermissao(
    @Param('id') id: string,
    @Body() dto: AtribuirPermissaoDto,
  ) {
    return this.usuarioService.atribuirPermissao(id, dto);
  }

  @Delete(':id/permissoes/:moduloId')
  revogarPermissao(
    @Param('id') id: string,
    @Param('moduloId') moduloId: string,
  ) {
    return this.usuarioService.revogarPermissao(id, moduloId);
  }
}
