import { NestFactory } from '@nestjs/core';
import{ ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getCorsConfig } from './config/cors.config';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
   // Seguridad: Headers HTTP con Helmet
   app.use(helmet());

   // CORS con configuración por entorno
   app.enableCors({
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
   });
 
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
     .addBearerAuth()
     .build();
   
   const document = SwaggerModule.createDocument(app, config);
   SwaggerModule.setup('api/docs', app, document);

   console.log(`\n🚀 Servidor iniciado en http://localhost:${process.env.PORT ?? 3000}`);
   console.log(`📚 Documentación Swagger disponible en http://localhost:${process.env.PORT ?? 3000}/api/docs\n`);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
