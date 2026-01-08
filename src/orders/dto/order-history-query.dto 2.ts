import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsIn, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderStatus } from '../entities/order.entity';

export enum OrderHistoryOrderBy {
  FECHA_PEDIDO = 'fechaPedido',
  TOTAL = 'total',
  STATUS = 'status',
}

export enum OrderDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class OrderHistoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Fecha inicial del rango para filtrar pedidos',
    type: String,
    format: 'date-time',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'startDate debe ser una fecha válida' })
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Fecha final del rango para filtrar pedidos',
    type: String,
    format: 'date-time',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'endDate debe ser una fecha válida' })
  endDate?: Date;

  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Filtrar por estado del pedido',
    example: OrderStatus.ENTREGADO,
  })
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Estado inválido' })
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: OrderHistoryOrderBy,
    description: 'Campo por el cual ordenar los resultados',
    default: OrderHistoryOrderBy.FECHA_PEDIDO,
    example: OrderHistoryOrderBy.FECHA_PEDIDO,
  })
  @IsOptional()
  @IsEnum(OrderHistoryOrderBy, { message: 'orderBy debe ser uno de: fechaPedido, total, status' })
  orderBy?: OrderHistoryOrderBy = OrderHistoryOrderBy.FECHA_PEDIDO;

  @ApiPropertyOptional({
    enum: OrderDirection,
    description: 'Dirección del ordenamiento (ASC o DESC)',
    default: OrderDirection.DESC,
    example: OrderDirection.DESC,
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'], { message: 'orderDirection debe ser ASC o DESC' })
  orderDirection?: OrderDirection = OrderDirection.DESC;

  @ApiPropertyOptional({
    description: 'ID del restaurante (requerido para RESTAURANT_OWNER, opcional para ADMIN)',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El restaurante debe ser un UUID válido' })
  restaurantId?: string;

  @ApiPropertyOptional({
    description: 'ID del usuario (solo para ADMIN)',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El usuario debe ser un UUID válido' })
  userId?: string;
}

