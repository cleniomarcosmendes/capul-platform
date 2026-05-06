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
 * Filtro global de excecoes.
 *
 * Captura tudo (`@Catch()` sem args) e converte para JSON `{statusCode, message,
 * timestamp}`. HttpException preserva status original; tudo mais vira 500.
 *
 * IMPORTANTE: para erros 500 (e qualquer exception nao-HttpException), loga
 * o stack trace antes de responder. Sem isso o erro real e silenciosamente
 * consumido pelo filter, e o pino-http (que executa depois) so consegue
 * registrar "failed with status code 500" — sem causa raiz, debugging cego.
 *
 * Bug observado em prod (06/05/2026): erros 500 em /projetos e /compras/
 * notas-fiscais nao tinham stack porque o filter engolia o trace.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno do servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        message =
          (exResponse as Record<string, unknown>).message as string | string[];
      }
    }

    // Log com stack pra qualquer erro 500 ou exception nao-HttpException.
    // Inclui method+url+user (se disponivel) pra rastrear contexto do request.
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
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
