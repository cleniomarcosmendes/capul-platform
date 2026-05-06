import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro global de excecoes do Auth Gateway.
 *
 * IMPORTANTE: para erros 500 (e qualquer exception nao-HttpException), loga
 * o stack trace antes de responder. Sem isso o erro real e silenciosamente
 * consumido pelo filter, e o pino-http (que executa depois) so consegue
 * registrar "failed with status code 500" — sem causa raiz, debugging cego.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erro interno do servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || message;
    }

    if (status >= 500 || !(exception instanceof HttpException)) {
      const userId = (request as Request & { user?: { sub?: string } }).user?.sub;
      const tag = `[${request.method} ${request.url}]${userId ? ` user=${userId}` : ''}`;
      const err = exception as Error & { code?: string; meta?: unknown };
      const ctxExtra = err.code ? ` code=${err.code}` : '';
      this.logger.error(
        `${tag} ${err.message ?? 'unknown error'}${ctxExtra}`,
        err.stack,
      );
      if (err.meta) {
        this.logger.error(`${tag} prisma meta: ${JSON.stringify(err.meta)}`);
      }
    }

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
    });
  }
}
