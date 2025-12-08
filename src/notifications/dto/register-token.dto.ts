import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotificationPlatform } from '../entities/notification-token.entity';

class NotificationPreferencesDto {
  @ApiProperty({ description: 'Recibir notificaciones de nuevos pedidos', default: true })
  @IsBoolean()
  pedidosNuevos = true;

  @ApiProperty({ description: 'Recibir notificaciones de cambios de estado del pedido', default: true })
  @IsBoolean()
  cambiosEstado = true;

  @ApiProperty({ description: 'Recibir notificaciones de promociones', default: true })
  @IsBoolean()
  promociones = true;
}

export class RegisterTokenDto {
  @ApiProperty({
    description: 'Token Expo Push Notifications obtenido desde el dispositivo',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsString()
  @IsNotEmpty({ message: 'El token de Expo es obligatorio' })
  @MaxLength(255)
  expoPushToken: string;

  @ApiProperty({
    description: 'Identificador del dispositivo (Device.modelName u otro ID estable)',
    example: 'iPhone 15 Pro',
  })
  @IsString()
  @IsNotEmpty({ message: 'El identificador del dispositivo es obligatorio' })
  @MaxLength(150)
  deviceId: string;

  @ApiProperty({
    description: 'Plataforma del dispositivo',
    enum: NotificationPlatform,
    example: NotificationPlatform.IOS,
  })
  @IsEnum(NotificationPlatform, { message: 'Plataforma inválida' })
  platform: NotificationPlatform;

  @ApiPropertyOptional({
    description: 'Información adicional del dispositivo',
    example: {
      deviceName: 'Juan iPhone',
      modelName: 'iPhone 15 Pro',
      osName: 'iOS',
      osVersion: '18.0'
    },
  })
  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Configuraciones de notificación del usuario',
    type: NotificationPreferencesDto,
  })
  @IsOptional()
  @IsObject()
  configuraciones?: NotificationPreferencesDto;
}

export class UpdateTokenDto {
  @ApiPropertyOptional({ description: 'Activar o desactivar el token', example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    description: 'Actualizar configuraciones de notificación',
    type: NotificationPreferencesDto,
  })
  @IsOptional()
  @IsObject()
  configuraciones?: NotificationPreferencesDto;
}

export type NotificationPreferences = NotificationPreferencesDto;


