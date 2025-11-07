import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';

export class OrderItemResponseDto {
  @ApiProperty({ description: 'ID del plato' })
  dishId: string;

  @ApiProperty({ description: 'Nombre del plato' })
  dishNombre: string;

  @ApiProperty({ description: 'Cantidad' })
  cantidad: number;

  @ApiProperty({ description: 'Precio unitario en centavos' })
  precioUnitario: number;

  @ApiProperty({ description: 'Precio total en centavos' })
  precioTotal: number;

  @ApiPropertyOptional({ description: 'Toppings seleccionados' })
  toppingsSeleccionados?: Array<{
    id: string;
    nombre: string;
    precio: number;
  }>;

  @ApiPropertyOptional({ description: 'Ingredientes removidos' })
  toppingsBaseRemocionados?: Array<{
    id: string;
    nombre: string;
  }>;

  @ApiPropertyOptional({ description: 'Comentarios del item' })
  comentarios?: string;
}

export class OrderResponseDto {
  @ApiProperty({ description: 'ID del pedido' })
  id: string;

  @ApiProperty({ description: 'Número de orden', example: '#ABC-123' })
  numeroOrden: string;

  @ApiProperty({ description: 'ID del usuario' })
  userId: string;

  @ApiProperty({ description: 'ID del restaurante' })
  restaurantId: string;

  @ApiProperty({ description: 'Estado del pedido', enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ description: 'Items del pedido', type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiProperty({ description: 'Subtotal en centavos' })
  subtotal: number;

  @ApiProperty({ description: 'Tarifa de servicio en centavos' })
  tarifaServicio: number;

  @ApiProperty({ description: 'Total en centavos' })
  total: number;

  @ApiPropertyOptional({ description: 'Comentarios del cliente' })
  comentariosCliente?: string;

  @ApiPropertyOptional({ description: 'Comentarios del restaurante' })
  comentariosRestaurante?: string;

  @ApiPropertyOptional({ description: 'Tiempo estimado en minutos' })
  tiempoEstimado?: number;

  @ApiProperty({ description: 'Fecha del pedido' })
  fechaPedido: Date;

  @ApiPropertyOptional({ description: 'Fecha de aceptación' })
  fechaAceptado?: Date;

  @ApiPropertyOptional({ description: 'Fecha cuando estuvo listo' })
  fechaListo?: Date;

  @ApiPropertyOptional({ description: 'Fecha de entrega' })
  fechaEntregado?: Date;

  @ApiPropertyOptional({ description: 'Motivo de cancelación' })
  motivoCancelacion?: string;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de actualización' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Información del usuario' })
  user?: {
    id: string;
    nombre: string;
    email: string;
  };

  @ApiPropertyOptional({ description: 'Información del restaurante' })
  restaurant?: {
    id: string;
    nombre: string;
    imagen?: string;
  };
}


