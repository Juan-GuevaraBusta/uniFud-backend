import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
// import { Restaurant } from 'src/restaurants/entities/restaurant.entity';

@Entity('universities')
export class University {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: false })
  nombre: string;

  @Column({ length: 255, nullable: false })
  ciudad: string;

  @Column({ length: 500, nullable: true })
  imagen?: string;

  // Relación con Restaurant - se activará en Fase 2
  // @OneToMany(() => Restaurant, (restaurant) => restaurant.university)
  // restaurants: Restaurant[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}