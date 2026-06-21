import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { globalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  // bufferLogs garante que toda saida (incluindo bootstrap) passe pelo Pino logger
  // configurado no AppModule. Auditoria observabilidade 26/04/2026 #1.
  // bodyParser:false — controlamos os limites manualmente abaixo (SAC anexos).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  app.useLogger(app.get(Logger));

  // Limite de corpo JSON: só a rota interna de e-mail aceita anexos grandes
  // (base64 de até ~15MB). Login e demais endpoints ficam no limite modesto —
  // sem ampliar a superfície de payload do resto da API.
  app.use('/api/v1/internal/email/send', json({ limit: '16mb' }));
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Helmet — headers de seguranca (defesa em profundidade alem do Nginx)
  app.use(
    helmet({
      contentSecurityPolicy: false, // API nao serve HTML — CSP no Nginx
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(globalValidationPipe);
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Auditoria 10/05/2026 #B3 — CORS_ORIGINS obrigatório (sem fallback).
  // Mesma regra do fiscal-backend. Aborta se vazio para evitar configuração
  // silenciosa em PROD com fallback `localhost` que não bloqueia ataques reais.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS não configurado. Defina a variável de ambiente com a lista ' +
        'de origens permitidas separadas por vírgula (ex.: https://platform.capul.com.br,https://localhost).',
    );
  }
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  app.get(Logger).log(`Auth Gateway rodando na porta ${port}`, 'Bootstrap');
}
bootstrap();
