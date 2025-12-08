import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderStatus } from '../entities/order.entity';

export class OrdersRestaurantQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OrderStatus, description: 'Filtrar por estado del pedido' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

