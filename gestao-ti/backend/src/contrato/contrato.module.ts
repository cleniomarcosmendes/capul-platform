import { BadRequestException, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { isAnexoPermitido } from '../common/constants/anexo-mime.constant';
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
      // Whitelist canônica (padronização 19/06) — defesa caso algum upload use
      // este default do módulo em vez do config inline do controller.
      fileFilter: (_req, file, cb) => {
        if (isAnexoPermitido(file)) return cb(null, true);
        cb(new BadRequestException('Tipo de arquivo nao permitido'), false);
      },
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
