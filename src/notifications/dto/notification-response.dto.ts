import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { NotificationPlatform } from '../entities/notification-token.entity';

@Exclude()
export class NotificationTokenResponseDto {
  @Expose()
  @ApiProperty({ description: 'ID del token' })
  id: string;

  @Expose()
  @ApiProperty({ description: 'ID del usuario asociado' })
  userId: string;

  @Expose()
  @ApiProperty({ description: 'Correo electrónico del usuario' })
  userEmail: string;

  @Expose()
  @ApiProperty({ description: 'Token Expo Push Notifications (parcialmente oculto por seguridad)' })
  expoPushToken: string;

  @Expose()
  @ApiProperty({ description: 'ID del dispositivo' })
  deviceId: string;

  @Expose()
  @ApiProperty({ description: 'Plataforma del dispositivo', enum: NotificationPlatform })
  platform: NotificationPlatform;

  @Expose()
  @ApiPropertyOptional({ description: 'Información adicional del dispositivo' })
  deviceInfo?: Record<string, any>;

  @Expose()
  @ApiProperty({ description: 'Configuraciones de notificación del usuario' })
  configuraciones: Record<string, any>;

  @Expose()
  @ApiProperty({ description: 'Indica si el token está activo' })
  activo: boolean;

  @Expose()
  @ApiProperty({ description: 'Identificador único compuesto usuario+dispositivo' })
  userDevice: string;

  @Expose()
  @ApiProperty({ description: 'Fecha en la que se registró el token' })
  registeredAt: Date;

  @Expose()
  @ApiProperty({ description: 'Fecha de la última actualización/uso del token' })
  lastUsedAt: Date;
}


