import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';
import { Restaurant } from './entities/restaurant.entity';
import { UniversitiesModule } from '../universities/universities.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant]),
    UniversitiesModule, // Para poder usar UniversitiesService
  ],
  controllers: [RestaurantsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService], // Para que otros módulos puedan usarlo
})
export class RestaurantsModule {}


