import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { isAnexoPermitido } from '../constants/anexo-mime.constant.js';

/**
 * Auditoria 10/05/2026 #DT3-M2 — fábrica de MulterOptions reutilizável.
 *
 * Antes deste helper, 4 controllers (chamado, projeto, compra, conhecimento)
 * tinham config Multer copiada com variações sutis:
 *   - chamado: versão robusta com verificação fs.existsSync + W_OK
 *   - projeto, compra, conhecimento: versão simples (destination string)
 *
 * A inconsistência era um problema operacional: chamado ganhou tratamento
 * de erro claro (mensagem com comando admin pra corrigir permissão) depois
 * que o bug Fiscal/certs foi descoberto (bind mounts com owner errado pós
 * recriação de container). Os outros não — falhavam com 500 silencioso.
 *
 * Esta fábrica aplica a versão ROBUSTA em todos. Outros benefícios:
 *   - filename randomUUID consistente (já era padrão)
 *   - fileFilter usa whitelist isAnexoPermitido (decisão 06/05/2026)
 *   - limit 10MB padrão (overridable)
 *
 * Uso:
 *   @UseInterceptors(FileInterceptor('file', createUploadConfig({
 *     uploadsDir: path.join(process.cwd(), 'uploads', 'chamados'),
 *     loggerName: 'ChamadoUploads',
 *   })))
 */
export interface UploadConfigOptions {
  /** Diretório onde os uploads serão salvos. Será criado se não existir. */
  uploadsDir: string;
  /** Nome do Logger (aparece em "[NestApplication] [LOGGER_NAME] ...") */
  loggerName: string;
  /** Override do limite de tamanho em bytes. Default 10MB. */
  maxSizeBytes?: number;
}

export function createUploadConfig(options: UploadConfigOptions): MulterOptions {
  const { uploadsDir, loggerName, maxSizeBytes = 10 * 1024 * 1024 } = options;
  const logger = new Logger(loggerName);

  return {
    storage: diskStorage({
      // Destination como função (não string) — permite re-checar permissão/existência
      // a cada upload e devolver mensagem clara em vez de erro 500 silencioso.
      // Lição do bug Fiscal/certs: bind mounts em produção podem ter owner errado
      // após recriação de container — usuário precisa ver o comando exato pra corrigir.
      destination: (_req, _file, cb) => {
        // 1) Garantir que o diretório existe
        try {
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException;
          logger.error(`Falha ao criar ${uploadsDir}: ${e.code} ${e.message}`);
          return cb(
            new InternalServerErrorException(
              `Diretório de upload não pôde ser criado (${e.code || 'erro'}). ` +
                `Admin: docker compose exec -u root gestao-ti-backend sh -c ` +
                `'mkdir -p ${uploadsDir} && chown -R appuser:appgroup ${uploadsDir}'`,
            ),
            '',
          );
        }

        // 2) Checar permissão de escrita
        fs.access(uploadsDir, fs.constants.W_OK, (err) => {
          if (err) {
            const e = err as NodeJS.ErrnoException;
            logger.error(`Sem permissão de escrita em ${uploadsDir}: ${e.code}`);
            return cb(
              new InternalServerErrorException(
                `Sem permissão de escrita no diretório de uploads (${e.code}). ` +
                  `Admin: docker compose exec -u root gestao-ti-backend sh -c ` +
                  `'chown -R appuser:appgroup ${uploadsDir}'`,
              ),
              '',
            );
          }
          cb(null, uploadsDir);
        });
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: maxSizeBytes },
    fileFilter: (_req, file, cb) => {
      if (isAnexoPermitido(file)) return cb(null, true);
      return cb(new BadRequestException('Tipo de arquivo nao permitido'), false);
    },
  };
}
