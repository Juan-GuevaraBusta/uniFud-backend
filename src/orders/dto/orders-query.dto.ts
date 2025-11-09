import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderStatus } from '../entities/order.entity';

export class OrdersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OrderStatus, description: 'Filtrar por estado del pedido' })
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Estado inválido' })
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Filtrar por restaurante', format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'El restaurante debe ser un UUID válido' })
  restaurantId?: string;

  @ApiPropertyOptional({ description: 'Fecha inicial del rango', type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'startDate debe ser una fecha válida' })
  startDate?: Date;

  @ApiPropertyOptional({ description: 'Fecha final del rango', type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'endDate debe ser una fecha válida' })
  endDate?: Date;
}
