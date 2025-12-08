import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';
import { Type } from 'class-transformer';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Nuevo estado del pedido',
    enum: OrderStatus,
    example: OrderStatus.ACEPTADO,
  })
  @IsEnum(OrderStatus, { message: 'Estado inválido' })
  status: OrderStatus;

  @ApiPropertyOptional({
    description: 'Tiempo estimado de preparación en minutos (solo para estado ACEPTADO)',
    example: 20,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El tiempo estimado debe ser un número' })
  @Type(() => Number)
  @Min(1, { message: 'El tiempo estimado mínimo es 1 minuto' })
  tiempoEstimado?: number;

  @ApiPropertyOptional({
    description: 'Comentarios del restaurante sobre el cambio de estado',
    example: 'Tu pedido estará listo pronto',
  })
  @IsOptional()
  @IsString()
  comentarios?: string;

  @ApiPropertyOptional({
    description: 'Motivo de cancelación (obligatorio si status = CANCELADO)',
    example: 'No hay ingredientes disponibles',
  })
  @IsOptional()
  @IsString()
  motivoCancelacion?: string;
}





