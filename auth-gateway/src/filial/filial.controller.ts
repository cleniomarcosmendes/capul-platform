import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { FilialService } from './filial.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateFilialDto, UpdateFilialDto } from './dto/create-filial.dto';

@Controller('api/v1/core/filiais')
@UseGuards(JwtAuthGuard)
export class FilialController {
  constructor(private readonly filialService: FilialService) {}

  @Get()
  findAll(@Query('empresaId') empresaId?: string) {
    return this.filialService.findAll(empresaId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.filialService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateFilialDto) {
    return this.filialService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFilialDto) {
    return this.filialService.update(id, dto);
  }
}
