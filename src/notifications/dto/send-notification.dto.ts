import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ArrayNotEmpty } from 'class-validator';

export enum NotificationType {
  NUEVO_PEDIDO = 'nuevo_pedido',
  PEDIDO_ACEPTADO = 'pedido_aceptado',
  PEDIDO_RECHAZADO = 'pedido_rechazado',
  PEDIDO_LISTO = 'pedido_listo',
  PEDIDO_ENTREGADO = 'pedido_entregado',
  PERSONALIZADA = 'personalizada',
}

export class SendNotificationDto {
  @ApiProperty({ description: 'Lista de emails destino', type: [String], example: ['usuario@universidad.edu.co'] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Debe indicar al menos un destinatario' })
  @IsString({ each: true })
  recipients: string[];

  @ApiProperty({ description: 'Tipo de notificación', enum: NotificationType, example: NotificationType.NUEVO_PEDIDO })
  @IsEnum(NotificationType, { message: 'Tipo de notificación inválido' })
  type: NotificationType;

  @ApiProperty({ description: 'Título de la notificación', example: 'Nuevo pedido recibido' })
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  title: string;

  @ApiProperty({ description: 'Mensaje a mostrar en la notificación', example: 'Pedido #ABC-123 por $25.000' })
  @IsString()
  @IsNotEmpty({ message: 'El cuerpo del mensaje es obligatorio' })
  body: string;

  @ApiPropertyOptional({ description: 'Datos adicionales que se adjuntarán a la notificación', example: { pedidoId: 'uuid', numeroOrden: '#ABC-123' } })
  @IsOptional()
  data?: Record<string, any>;
}


