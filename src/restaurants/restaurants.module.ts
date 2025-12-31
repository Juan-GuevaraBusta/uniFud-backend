import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantsService } from './restaurants.service';
import { StatisticsService } from './statistics.service';
import { RestaurantsController } from './restaurants.controller';
import { Restaurant } from './entities/restaurant.entity';
import { Order } from '../orders/entities/order.entity';
import { UniversitiesModule } from '../universities/universities.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant, Order]),
    UniversitiesModule, // Para poder usar UniversitiesService
  ],
  controllers: [RestaurantsController],
  providers: [RestaurantsService, StatisticsService],
  exports: [RestaurantsService], // Para que otros módulos puedan usarlo
})
export class RestaurantsModule {}





