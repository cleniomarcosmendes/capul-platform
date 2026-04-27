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

  // CORS restritivo — apenas origens da intranet
  const allowedOrigins = (process.env.CORS_ORIGINS || 'https://localhost')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  app.get(Logger).log(`Auth Gateway rodando na porta ${port}`, 'Bootstrap');
}
bootstrap();
