import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import TransformResponseInterceptor from '../src/common/interceptors/transform-response.interceptor';
import { HttpErrorFilter } from '../src/common/filters/http-error.filters';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';

let cachedApp: any;
let cachedExpressApp: express.Express;

async function bootstrap() {
  if (!cachedApp || !cachedExpressApp) {
    try {
      cachedExpressApp = express();
      const adapter = new ExpressAdapter(cachedExpressApp);
      
      cachedApp = await NestFactory.create(AppModule, adapter, { cors: true });

      // CORS configuration
      const allowedOrigins = process.env.NODE_ENV === 'production'
        ? [
            process.env.FRONTEND_URL || 'https://bangsoal.co.id',
          ]
        : [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'https://francis.nafhan.space', // Explicitly add dev domain
            process.env.FRONTEND_URL || 'http://localhost:3000',
          ];

      cachedApp.enableCors({
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
          'X-Requested-With',
          'Accept',
          'Origin',
        ],
        preflightContinue: false,
        optionsSuccessStatus: 204,
      });

      cachedApp.setGlobalPrefix('api');
      cachedApp.useGlobalInterceptors(new TransformResponseInterceptor());
      cachedApp.useGlobalFilters(new HttpErrorFilter());
      cachedApp.useGlobalPipes(new ValidationPipe());

      const swaggerConfig = new DocumentBuilder()
        .setTitle('Bangsoal API')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(cachedApp, swaggerConfig, {});

      if (process.env.NODE_ENV !== 'production') {
        SwaggerModule.setup('docs', cachedApp, document);
      }

      await cachedApp.init();
    } catch (error) {
      console.error('Failed to bootstrap NestJS application:', error);
      throw error;
    }
  }
  return cachedExpressApp;
}

export default async function handler(req: any, res: any) {
  try {
    const expressApp = await bootstrap();
    return expressApp(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message || String(error),
    });
  }
}
