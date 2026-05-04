import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Captura erros do multer com errno EACCES/EPERM ao tentar gravar arquivo
 * de upload e devolve mensagem amigável com o comando exato pro admin
 * corrigir. Sem este filter, EACCES vira 500 genérico ("Internal Server
 * Error") e o usuário só vê "Erro ao enviar anexo".
 *
 * Cenário: o named volume `capul-platform_uploads_data` foi criado em
 * deploy anterior com container rodando como root (ownership root:root no
 * host). Após o deploy de hardening (USER non-root no Dockerfile), o
 * container vira appuser uid=100 e perde permissão de escrita no volume.
 *
 * Aplicado via @UseFilters() no método addAnexo do ParadaController.
 */
@Catch()
export class UploadEaccesFilter implements ExceptionFilter {
  private readonly logger = new Logger(UploadEaccesFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const errAny = exception as {
      code?: string;
      errno?: number;
      message?: string;
      path?: string;
    } | null;
    const code = errAny?.code;
    const errno = errAny?.errno;
    const isEaccesLike =
      code === 'EACCES' ||
      code === 'EPERM' ||
      errno === -13 || // EACCES em Linux
      errno === -1 || // EPERM em Linux
      /EACCES|EPERM|permission denied/i.test(errAny?.message ?? '');

    if (isEaccesLike) {
      const detalhe = errAny?.message ?? 'sem detalhe';
      this.logger.error(
        `[UPLOAD_EACCES] Falha ao gravar anexo em ${errAny?.path ?? 'UPLOADS_DIR'}: ${detalhe}`,
      );
      return response.status(400).json({
        statusCode: 400,
        erro: 'UPLOADS_DIR_NAO_GRAVAVEL',
        message:
          'Não foi possível gravar o anexo no servidor — o volume de uploads ' +
          'não é gravável pelo usuário do container. Solução no host (uma vez): ' +
          'rode `docker volume inspect capul-platform_uploads_data --format "{{.Mountpoint}}"` ' +
          'para obter o caminho, depois `sudo chown -R 100:101 <caminho>` ' +
          'e por fim `docker compose restart gestao-ti-backend`. ' +
          `Detalhe técnico: ${detalhe}`,
      });
    }

    // Re-encaminha qualquer outra exception ao tratamento padrão do Nest
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return response.status(status).json(body);
    }
    // Erro inesperado — 500 genérico mas com log
    this.logger.error(
      `Erro inesperado em upload de anexo: ${(exception as Error)?.message ?? exception}`,
      (exception as Error)?.stack,
    );
    return response.status(500).json({
      statusCode: 500,
      message: 'Erro interno ao processar o upload do anexo.',
    });
  }
}
