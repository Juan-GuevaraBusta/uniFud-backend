import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_cards')
export class UserCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.cards)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'wompi_payment_source_id', unique: true })
  wompiPaymentSourceId: string; // ID de Payment Source de Wompi

  @Column({ name: 'card_last_four' })
  cardLastFour: string; // Últimos 4 dígitos

  @Column({ name: 'card_brand' })
  cardBrand: string; // VISA, MASTERCARD, AMEX

  @Column({ name: 'card_holder_name', nullable: true })
  cardHolderName?: string;

  @Column({ name: 'exp_month' })
  expMonth: number;

  @Column({ name: 'exp_year' })
  expYear: number;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean; // Tarjeta por defecto

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

