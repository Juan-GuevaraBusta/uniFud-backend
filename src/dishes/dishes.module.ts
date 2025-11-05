import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DishesService } from './dishes.service';
import { DishesController } from './dishes.controller';
import { Dish } from './entities/dish.entity';
import { Topping } from './entities/topping.entity';
import { DishAvailability } from './entities/dish-availability.entity';
import { RestaurantsModule } from '../restaurants/restaurants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dish, Topping, DishAvailability]),
    RestaurantsModule, // Para verificar permisos del restaurante
  ],
  controllers: [DishesController],
  providers: [DishesService],
  exports: [DishesService], // Para que otros módulos puedan usarlo
})
export class DishesModule {}

