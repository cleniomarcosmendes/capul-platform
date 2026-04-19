import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: {
      statusCode: number;
      mensagem: string;
      erro?: string;
      detalhe?: unknown;
      path: string;
      timestamp: string;
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();

      // Resp pode ser:
      //   - string ("Bad Request")
      //   - { statusCode, message: string, error: string }                   (NestJS padrão)
      //   - { statusCode, message: { erro, mensagem, ... }, error: string }  (objeto custom)
      //   - { erro, mensagem, ... }                                          (objeto direto custom)
      const respObj = resp as Record<string, unknown>;

      // Primeiro tenta extrair `mensagem` (custom) ou `message` (padrão NestJS)
      let mensagem: string;
      let erro: string | undefined;
      let detalhe: unknown;

      if (typeof resp === 'string') {
        mensagem = resp;
      } else {
        // Se vem um message-objeto (NotFoundException({ erro, mensagem, ... }))
        const innerMessage = respObj.message;
        if (typeof innerMessage === 'object' && innerMessage !== null) {
          const inner = innerMessage as Record<string, unknown>;
          mensagem =
            (inner.mensagem as string) ??
            (inner.message as string) ??
            JSON.stringify(inner);
          erro = (inner.erro as string) ?? (respObj.error as string);
          detalhe = inner;
        } else if (typeof innerMessage === 'string') {
          mensagem = innerMessage;
          erro = respObj.error as string;
        } else if (Array.isArray(innerMessage)) {
          mensagem = innerMessage.join('; ');
          erro = respObj.error as string;
        } else {
          // Objeto direto sem .message
          mensagem =
            (respObj.mensagem as string) ??
            (respObj.message as string) ??
            exception.message;
          erro = (respObj.erro as string) ?? (respObj.error as string);
        }
      }

      // Em producao, nao vazar o campo `detalhe` — pode expor estrutura
      // interna (nome de services, stacks, queries). Em dev, manter para
      // facilitar debug local.
      const isProd = process.env.NODE_ENV === 'production';
      body = {
        statusCode: status,
        mensagem,
        erro,
        detalhe: isProd ? undefined : detalhe,
        path: req.url,
        timestamp: new Date().toISOString(),
      };
    } else {
      const err = exception as Error;
      this.logger.error(
        `Erro não tratado em ${req.method} ${req.url}: ${err?.message}`,
        err?.stack,
      );
      body = {
        statusCode: status,
        mensagem: 'Erro interno do servidor.',
        path: req.url,
        timestamp: new Date().toISOString(),
      };
    }

    res.status(status).json(body);
  }
}
