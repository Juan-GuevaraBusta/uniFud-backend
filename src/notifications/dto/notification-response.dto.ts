import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationPlatform } from '../entities/notification-token.entity';

export class NotificationTokenResponseDto {
  @ApiProperty({ description: 'ID del token' })
  id: string;

  @ApiProperty({ description: 'ID del usuario asociado' })
  userId: string;

  @ApiProperty({ description: 'Correo electrónico del usuario' })
  userEmail: string;

  @ApiProperty({ description: 'Token Expo Push Notifications' })
  expoPushToken: string;

  @ApiProperty({ description: 'ID del dispositivo' })
  deviceId: string;

  @ApiProperty({ description: 'Plataforma del dispositivo', enum: NotificationPlatform })
  platform: NotificationPlatform;

  @ApiPropertyOptional({ description: 'Información adicional del dispositivo' })
  deviceInfo?: Record<string, any>;

  @ApiProperty({ description: 'Configuraciones de notificación del usuario' })
  configuraciones: Record<string, any>;

  @ApiProperty({ description: 'Indica si el token está activo' })
  activo: boolean;

  @ApiProperty({ description: 'Identificador único compuesto usuario+dispositivo' })
  userDevice: string;

  @ApiProperty({ description: 'Fecha en la que se registró el token' })
  registeredAt: Date;

  @ApiProperty({ description: 'Fecha de la última actualización/uso del token' })
  lastUsedAt: Date;
}

