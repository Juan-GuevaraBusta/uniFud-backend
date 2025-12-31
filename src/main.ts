import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { AppModule } from './app.module';
import { getCorsConfig } from './config/cors.config';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
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

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(loggerConfig),
  });
  
  // Configurar WebSocket adapter para Socket.IO
  app.useWebSocketAdapter(new IoAdapter(app));
  
   // Seguridad: Headers HTTP con Helmet
   app.use(helmet());

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
     exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
     maxAge: 3600,
   };
   
   app.enableCors(corsConfig);
 
   // ValidationPipe global
   app.useGlobalPipes(
     new ValidationPipe({
       whitelist: true,
       forbidNonWhitelisted: true,
       transform: true,
       transformOptions: {
         enableImplicitConversion: true,
       },
     }),
   );

   app.useGlobalInterceptors(
     new ClassSerializerInterceptor(app.get(Reflector)),
     app.get(LoggingInterceptor),
     new TransformInterceptor(),
   );
   app.useGlobalFilters(app.get(AllExceptionsFilter));

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
   const logger = app.get('NestWinstonLogger') || console;
   
   logger.log(`Servidor iniciado en http://localhost:${port}`, 'Bootstrap');
   logger.log(`Documentación Swagger disponible en http://localhost:${port}/api/docs`, 'Bootstrap');

  await app.listen(port);
}
bootstrap();
