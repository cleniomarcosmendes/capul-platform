import { Module } from '@nestjs/common';
import { CatalogoServicoController } from './catalogo-servico.controller.js';
import { CatalogoServicoService } from './catalogo-servico.service.js';

@Module({
  controllers: [CatalogoServicoController],
  providers: [CatalogoServicoService],
  exports: [CatalogoServicoService],
})
export class CatalogoServicoModule {}
