import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';

@Module({
  imports: [
    TerminusModule,
    TypeOrmModule.forFeature([Order, User, Restaurant]),
    UsersModule,
    OrdersModule,
    RestaurantsModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}

