import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ContratoController } from './contrato.controller';
import { ContratoService } from './contrato.service';
import { ContratoCoreService } from './services/contrato-core.service';
import { ContratoParcelaService } from './services/contrato-parcela.service';
import { ContratoRateioService } from './services/contrato-rateio.service';
import { ContratoConfigService } from './services/contrato-config.service';
import { ContratoAnexoService } from './services/contrato-anexo.service';

const UPLOADS_DIR = './uploads/contratos';
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [ContratoController],
  providers: [
    ContratoCoreService,
    ContratoParcelaService,
    ContratoRateioService,
    ContratoConfigService,
    ContratoAnexoService,
    ContratoService,
  ],
  exports: [ContratoService],
})
export class ContratoModule {}
