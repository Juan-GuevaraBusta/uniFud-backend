import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Dish } from './dish.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

@Entity('dish_availability')
@Index(['restaurantId', 'dishId'], { unique: true }) // Un plato solo puede tener una disponibilidad por restaurante
@Index(['updatedAt']) // Para queries de cambios recientes
export class DishAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'dish_id', type: 'uuid', nullable: false })
  dishId: string;

  @Column({ name: 'restaurant_id', type: 'uuid', nullable: false })
  restaurantId: string;

  @Column({ type: 'boolean', default: true })
  disponible: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => Dish, { eager: false })
  @JoinColumn({ name: 'dish_id' })
  dish: Dish;

  @ManyToOne(() => Restaurant, { eager: false })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;
}





