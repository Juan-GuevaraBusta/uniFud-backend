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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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
     new LoggingInterceptor(),
     new TransformInterceptor(),
   );
   app.useGlobalFilters(new AllExceptionsFilter());

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

   console.log(`\n🚀 Servidor iniciado en http://localhost:${process.env.PORT ?? 3000}`);
   console.log(`📚 Documentación Swagger disponible en http://localhost:${process.env.PORT ?? 3000}/api/docs\n`);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
