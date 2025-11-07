import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { DishesModule } from '../dishes/dishes.module';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    RestaurantsModule, // Para verificar restaurante
    DishesModule,      // Para validar disponibilidad de platos
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService], // Para que otros módulos puedan usarlo
})
export class OrdersModule {}


