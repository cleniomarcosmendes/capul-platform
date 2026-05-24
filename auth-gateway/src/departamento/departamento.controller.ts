import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { DepartamentoService } from './departamento.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDepartamentoDto, UpdateDepartamentoDto } from './dto/create-departamento.dto';

@Controller('api/v1/core/departamentos')
@UseGuards(JwtAuthGuard)
export class DepartamentoController {
  constructor(private readonly departamentoService: DepartamentoService) {}

  @Get()
  findAll(
    @Query('filialId') filialId?: string,
    @Query('workspaceOnly') workspaceOnly?: string,
    @Query('funcionalidade') funcionalidade?: string,
  ) {
    // Workspace Onda 2 C2.8 — quando `workspaceOnly=true`, retorna apenas
    // deptos que têm pelo menos 1 funcionalidade ativa em
    // `core.departamento_funcionalidades`. Quando `funcionalidade=X` é
    // especificado, retorna apenas deptos com aquela funcionalidade ativa.
    // `filialId` continua respeitado pra casos de depto organizacional.
    return this.departamentoService.findAll({
      filialId,
      workspaceOnly: workspaceOnly === 'true',
      funcionalidade,
    });
  }

  @Post()
  create(@Body() dto: CreateDepartamentoDto) {
    return this.departamentoService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartamentoDto) {
    return this.departamentoService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departamentoService.remove(id);
  }
}
