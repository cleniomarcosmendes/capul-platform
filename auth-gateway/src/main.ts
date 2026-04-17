import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { globalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  console.log(`Auth Gateway rodando na porta ${port}`);
}
bootstrap();
