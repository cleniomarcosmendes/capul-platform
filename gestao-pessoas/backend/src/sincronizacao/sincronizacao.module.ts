import { Module } from '@nestjs/common';
import { FonteCsvService } from './fonte-csv.service.js';
import { FONTE_COLABORADORES } from './fonte.port.js';
import { SincronizacaoController } from './sincronizacao.controller.js';
import { SincronizacaoService } from './sincronizacao.service.js';

/**
 * A fonte é injetada por token: trocar CSV por REST, quando o endpoint do
 * Protheus existir, é acrescentar a classe e mudar esta linha — a regra do sync
 * não sabe de onde os dados vieram.
 */
@Module({
  controllers: [SincronizacaoController],
  providers: [
    SincronizacaoService,
    FonteCsvService,
    { provide: FONTE_COLABORADORES, useExisting: FonteCsvService },
  ],
  exports: [SincronizacaoService],
})
export class SincronizacaoModule {}
