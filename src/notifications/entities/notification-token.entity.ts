import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationPlatform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

@Entity('notification_tokens')
@Index(['userId', 'deviceId'], { unique: true })
@Index(['userDevice'], { unique: true })
@Index(['expoPushToken'])
@Index(['userId', 'activo']) // Para queries de tokens activos por usuario
export class NotificationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'user_email', length: 255 })
  userEmail: string;

  @Column({ name: 'expo_push_token', length: 255 })
  expoPushToken: string;

  @Column({ name: 'device_id', length: 150 })
  deviceId: string;

  @Column({
    type: 'enum',
    enum: NotificationPlatform,
  })
  platform: NotificationPlatform;

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo?: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  configuraciones: Record<string, any>;

  @Column({ default: true })
  activo: boolean;

  @Column({ name: 'user_device', length: 300, unique: true })
  userDevice: string;

  @CreateDateColumn({ name: 'registered_at' })
  registeredAt: Date;

  @UpdateDateColumn({ name: 'last_used_at' })
  lastUsedAt: Date;

  @ManyToOne(() => User, (user) => user.notificationTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
