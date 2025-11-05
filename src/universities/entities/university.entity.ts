import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

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

  @OneToMany(() => Restaurant, (restaurant) => restaurant.university)
  restaurants: Restaurant[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}