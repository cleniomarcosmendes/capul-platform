import {
  Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile, Query, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service.js';
import { ExecutarImportDto } from './dto/executar-import.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@Controller('import')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ImportController {
  constructor(private readonly service: ImportService) {}

  @Post('preview')
  @Roles('ADMIN', 'GESTOR_TI')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.originalname.match(/\.xlsx$/i)) {
        return cb(new BadRequestException('Apenas arquivos .xlsx sao aceitos'), false);
      }
      cb(null, true);
    },
  }))
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @Query('entidade') entidade: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');
    return this.service.preview(entidade, file);
  }

  @Post('executar')
  @Roles('ADMIN', 'GESTOR_TI')
  async executar(@Body() dto: ExecutarImportDto) {
    return this.service.executar(dto.entidade, dto.dados);
  }
}
