import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { University } from '../../universities/entities/university.entity';
import { User } from '../../users/entities/user.entity';

@Entity('restaurants')
@Index(['nombre', 'university'], { unique: true }) // Un restaurante único por universidad
export class Restaurant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: false })
  nombre: string;

  @Column({ name: 'university_id', type: 'uuid', nullable: false })
  universityId: string;

  @Column({ name: 'owner_id', type: 'uuid', nullable: false })
  ownerId: string;

  @Column({ length: 500, nullable: true })
  imagen?: string;

  @Column({ type: 'text', array: true, default: '{}' })
  categorias: string[];

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  calificacion: number;

  @Column({ name: 'tiempo_entrega', type: 'integer', default: 20 })
  tiempoEntrega: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  // Relaciones
  @ManyToOne(() => University, { eager: false })
  @JoinColumn({ name: 'university_id' })
  university: University;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  // Relaciones con Dishes y Orders se agregarán después
  // @OneToMany(() => Dish, (dish) => dish.restaurant)
  // dishes: Dish[];
  
  // @OneToMany(() => Order, (order) => order.restaurant)
  // orders: Order[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}