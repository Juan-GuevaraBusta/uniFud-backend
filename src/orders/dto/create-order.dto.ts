import { IsString, IsNotEmpty, IsOptional, IsUUID, IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderItemDto } from './order-item.dto';

export class CreateOrderDto {
  @ApiProperty({
    description: 'ID del restaurante donde se realiza el pedido',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'El ID del restaurante debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El ID del restaurante es obligatorio' })
  restaurantId: string;

  @ApiProperty({
    description: 'Lista de items del pedido',
    type: [OrderItemDto],
    isArray: true,
    maxItems: 50,
  })
  @IsArray({ message: 'Los items deben ser un array' })
  @ArrayMinSize(1, { message: 'Debe tener al menos un item en el pedido' })
  @ArrayMaxSize(50, { message: 'No puede tener más de 50 items en el pedido' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({
    description: 'Comentarios adicionales del cliente para el restaurante',
    example: 'Por favor que esté bien caliente',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Los comentarios no pueden exceder 500 caracteres' })
  comentariosCliente?: string;

  @ApiPropertyOptional({
    description: 'ID del Payment Source (tarjeta) a usar para el pago. Si no se proporciona, se usa la tarjeta por defecto',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El ID del Payment Source debe ser un UUID válido' })
  paymentSourceId?: string;
}





