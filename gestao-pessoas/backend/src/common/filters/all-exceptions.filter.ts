import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErroDeDominio } from '../erro-de-dominio.js';

/**
 * Filtro global: padroniza o corpo de erro e evita vazar stack/detalhes
 * internos. HttpException preserva status/mensagem; o resto vira 500 genérico.
 *
 * ⭐⭐ E `ErroDeDominio` **vem primeiro**, desde 12/09. Erro de domínio carrega
 * o que a tela precisa — a lista do que falta para publicar, quais perguntas
 * ficaram sem resposta, quais colaboradores colidiram na matrícula — e caía no
 * ramo do 500 genérico, que apaga exatamente esse conteúdo. Ver
 * `common/erro-de-dominio.ts` para o caso que criou a ponte.
 *
 * ⚠️ A tradução ficou AQUI, e não num `@Catch(ErroDeDominio)` separado, porque
 * a ordem entre dois filtros globais é uma sutileza do framework: um `if` no
 * topo deste método é ordem explícita, que se lê.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    // reqId = correlation id do pino-http (mesmo valor do header x-request-id).
    const reqId = (http.getRequest() as { id?: string })?.id;

    if (exception instanceof ErroDeDominio) {
      this.logger.warn(`[reqId=${reqId ?? '-'}] ${exception.name}: ${exception.message}`);
      res.status(exception.status).json({
        ...exception.corpo(),
        error: exception.name,
        statusCode: exception.status,
        timestamp: new Date().toISOString(),
      });
      return;
    }

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

    this.logger.error(
      `[reqId=${reqId ?? '-'}] ${(exception as Error)?.message ?? 'Erro desconhecido'}`,
      (exception as Error)?.stack,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor.',
      reqId,
      timestamp: new Date().toISOString(),
    });
  }
}
