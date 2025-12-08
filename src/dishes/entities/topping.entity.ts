import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Dish } from './dish.entity';

@Entity('toppings')
export class Topping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: false })
  nombre: string;

  @Column({ type: 'integer', default: 0 })
  precio: number; // Precio adicional en centavos (puede ser 0)

  @Column({ type: 'boolean', default: false })
  removible: boolean; // Si es parte de los ingredientes base y se puede remover

  @Column({ length: 100, nullable: true })
  categoria?: string; // Ej: "Proteína", "Vegetales", "Salsas"

  @Column({ name: 'dish_id', type: 'uuid', nullable: false })
  dishId: string;

  // Relación
  @ManyToOne(() => Dish, (dish) => dish.toppings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dish_id' })
  dish: Dish;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}





