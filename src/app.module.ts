import { Module } from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {TypeOrmModule} from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import cacheConfig from './config/cache.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {ThrottlerModule} from '@nestjs/throttler';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { UniversitiesModule } from './universities/universities.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { DishesModule } from './dishes/dishes.module';
import { OrdersModule } from './orders/orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { PaymentsModule } from './payments/payments.module';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './config/logger.config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, cacheConfig],
      envFilePath: '.env',
    }),
    WinstonModule.forRoot(loggerConfig),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => configService.get('cache'),
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 5000,
          limit: 15,
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => configService.get('database'),
    }),
    UsersModule,
    AuthModule,
    UniversitiesModule,
    RestaurantsModule,
    DishesModule,
    OrdersModule,
    NotificationsModule,
    HealthModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}