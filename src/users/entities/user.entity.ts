import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate, OneToMany } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {Exclude} from 'class-transformer';
import { Order } from '../../orders/entities/order.entity';
import { NotificationToken } from '../../notifications/entities/notification-token.entity';

export enum UserRole {
    STUDENT = 'student',
    RESTAURANT_OWNER = 'restaurant_owner',
    ADMIN = 'admin',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column()
    @Exclude()
    password: string;

    @Column({length: 255})
    nombre?: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.STUDENT,
    })
    role: UserRole;

    @Column({ default: false })
    emailVerified: boolean;

    @Column({ length: 6 })
    verificationCode?: string;

    @Column({ type: 'timestamp' })
    verificationCodeExpiry?: Date;

    @OneToMany(() => Order, (order) => order.user)
    orders: Order[];

    @OneToMany(() => NotificationToken, (token) => token.user)
    notificationTokens: NotificationToken[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

  
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
}