import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { Topping } from './topping.entity';
import { DishAvailability } from './dish-availability.entity';

export enum DishType {
  SIMPLE = 'simple',               // Plato básico sin opciones
  FIJO = 'fijo',                   // Plato con ingredientes fijos
  MIXTO = 'mixto',                 // Plato con opciones de ingredientes
  PERSONALIZABLE = 'personalizable' // Plato completamente personalizable
}

@Entity('dishes')
export class Dish {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: false })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ type: 'integer', nullable: false })
  precio: number; // Precio en centavos (ej: 15000 = $150.00)

  @Column({ length: 100, nullable: false })
  categoria: string;

  @Column({ length: 500, nullable: true })
  imagen?: string;

  @Column({
    type: 'enum',
    enum: DishType,
    default: DishType.SIMPLE,
  })
  tipoPlato: DishType;

  @Column({ name: 'restaurant_id', type: 'uuid', nullable: false })
  restaurantId: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  // Relaciones
  @ManyToOne(() => Restaurant, { eager: false })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;

  @OneToMany(() => Topping, (topping) => topping.dish, { cascade: true })
  toppings: Topping[];

  @OneToMany(() => DishAvailability, (availability) => availability.dish)
  availability: DishAvailability[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

