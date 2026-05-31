import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Filtro global: padroniza o corpo de erro e evita vazar stack/detalhes
 * internos. HttpException preserva status/mensagem; o resto vira 500 genérico.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      res.status(status).json(
        typeof payload === 'string'
          ? { statusCode: status, message: payload, timestamp: new Date().toISOString() }
          : { ...(payload as object), timestamp: new Date().toISOString() },
      );
      return;
    }

    this.logger.error((exception as Error)?.message ?? 'Erro desconhecido', (exception as Error)?.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor.',
      timestamp: new Date().toISOString(),
    });
  }
}
