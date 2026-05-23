import { Module } from '@nestjs/common';
import { DepartamentoFuncionalidadeController } from './departamento-funcionalidade.controller';
import { DepartamentoFuncionalidadeService } from './departamento-funcionalidade.service';

@Module({
  controllers: [DepartamentoFuncionalidadeController],
  providers: [DepartamentoFuncionalidadeService],
  exports: [DepartamentoFuncionalidadeService],
})
export class DepartamentoFuncionalidadeModule {}
