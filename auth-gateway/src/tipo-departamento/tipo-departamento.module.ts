import { Module } from '@nestjs/common';
import { TipoDepartamentoController } from './tipo-departamento.controller';
import { TipoDepartamentoService } from './tipo-departamento.service';

@Module({
  controllers: [TipoDepartamentoController],
  providers: [TipoDepartamentoService],
})
export class TipoDepartamentoModule {}
