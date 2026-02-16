import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import TransformResponseInterceptor from './common/interceptors/transform-response.interceptor';
import { HttpErrorFilter } from './common/filters/http-error.filters';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // CORS configuration - allow all origins in development for easier debugging
  const allowedOrigins =
    process.env.NODE_ENV === 'production'
      ? [
          process.env.FRONTEND_URL || 'https://bangsoal.co.id',
          'https://francis.nafhan.space', // Add Francis frontend domain
          process.env.ALLOWED_ORIGINS || '', // Additional allowed origins (comma-separated)
        ]
          .filter(Boolean)
          .join(',')
          .split(',')
          .map((origin) => origin.trim())
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'https://francis.nafhan.space', // Explicitly add dev domain
          'https://galton.nafhan.space', // Allow backend domain as well,
          'https://api.bangsoal.co.id',
          process.env.FRONTEND_URL || 'http://localhost:3000',
          process.env.ALLOWED_ORIGINS || '', // Additional allowed origins (comma-separated)
        ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // In development, allow all origins for easier debugging
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Turing',
      'baggage',
      'sentry-trace',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  console.log('🚀 Backend server starting on port 8080');
  console.log('📡 CORS enabled for origins:', allowedOrigins);

  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new TransformResponseInterceptor());
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalPipes(new ValidationPipe());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bangsoal API Dev')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {});

  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(8080);
  console.log('✅ Backend server is running on http://localhost:8080');
  console.log('📚 API Documentation available at http://localhost:8080/docs');
  console.log('🏥 Health check available at http://localhost:8080/api/health');
}
bootstrap();
