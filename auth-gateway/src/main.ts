import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { globalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  // bufferLogs garante que toda saida (incluindo bootstrap) passe pelo Pino logger
  // configurado no AppModule. Auditoria observabilidade 26/04/2026 #1.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

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
