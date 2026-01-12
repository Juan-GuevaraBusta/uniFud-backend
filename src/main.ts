import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, ValidationError, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { getCorsConfig } from './config/cors.config';
import { getHelmetConfig } from './config/helmet.config';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SanitizePipe } from './common/pipes/sanitize.pipe';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './config/logger.config';
import * as fs from 'fs';
import { join } from 'path';

async function bootstrap() {
  // Crear directorio de logs si no existe
  const logsDir = join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Crear logger de Winston
  const winstonLogger = WinstonModule.createLogger(loggerConfig);

  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });
  
  // Configurar WebSocket adapter para Socket.IO
  app.useWebSocketAdapter(new IoAdapter(app));
  
   // Seguridad: Headers HTTP con Helmet
   app.use(helmet(getHelmetConfig()));

   // CORS con configuración por entorno
   const corsConfig = {
     ...getCorsConfig(),
     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
     allowedHeaders: [
       'Content-Type',
       'Authorization',
       'X-Requested-With',
       'Accept',
       'Origin',
     ],
     exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
     maxAge: 3600,
   };
   
   app.enableCors(corsConfig);
 
   // Función factory para excepciones personalizadas de validación
   const exceptionFactory = (errors: ValidationError[]) => {
     const messages = errors.map((error) => {
       const constraints = error.constraints
         ? Object.values(error.constraints)
         : ['Error de validación'];
       return constraints.join(', ');
     });
     
     // En producción, no exponer detalles técnicos
     const isProduction = process.env.NODE_ENV === 'production';
     
     if (isProduction) {
       // Mensaje genérico en producción
       throw new BadRequestException('Los datos proporcionados no son válidos');
     }
     
     // En desarrollo/staging, mostrar detalles
     throw new BadRequestException({
       message: 'Error de validación',
       errors: messages,
     });
   };

   // Pipes globales: Sanitización primero, luego validación
   app.useGlobalPipes(
     new SanitizePipe(), // Sanitizar inputs antes de validar
     new ValidationPipe({
       whitelist: true,
       forbidNonWhitelisted: true,
       transform: true,
       transformOptions: {
         enableImplicitConversion: true,
       },
       disableErrorMessages: process.env.NODE_ENV === 'production',
       exceptionFactory,
     }),
   );

   app.useGlobalInterceptors(
     new ClassSerializerInterceptor(app.get(Reflector)),
     new TransformInterceptor(),
   );

   // Configuración de Swagger
   const config = new DocumentBuilder()
     .setTitle('UniFoodApp API')
     .setDescription('API REST para la plataforma UniFoodApp - Sistema de pedidos universitarios')
     .setVersion('1.0.0')
     .addTag('Autenticación', 'Endpoints de registro, login y gestión de sesiones')
     .addTag('Usuarios', 'Gestión de usuarios')
     .addTag('Universidades', 'Gestión de universidades')
     .addTag('Restaurantes', 'Gestión de restaurantes')
     .addTag('Platos', 'Gestión de platos y menús')
     .addTag('Pedidos', 'Gestión de pedidos')
     .addTag('Notificaciones', 'Gestión de tokens y envío de notificaciones push')
     .addBearerAuth()
     .build();
   
   const document = SwaggerModule.createDocument(app, config);
   SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  
  winstonLogger.log(`Servidor iniciado en http://localhost:${port}`, 'Bootstrap');
  winstonLogger.log(`Documentación Swagger disponible en http://localhost:${port}/api/docs`, 'Bootstrap');

  await app.listen(port);
}
bootstrap();
