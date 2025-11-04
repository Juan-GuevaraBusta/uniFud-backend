import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DishType } from '../entities/dish.entity';

export class ToppingResponseDto {
  @ApiProperty({
    description: 'ID del topping',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre del topping',
    example: 'Queso extra',
  })
  nombre: string;

  @ApiProperty({
    description: 'Precio adicional en centavos',
    example: 2000,
  })
  precio: number;

  @ApiProperty({
    description: 'Si es removible',
    example: false,
  })
  removible: boolean;

  @ApiPropertyOptional({
    description: 'Categoría del topping',
    example: 'Quesos',
  })
  categoria?: string;
}

export class DishResponseDto {
  @ApiProperty({
    description: 'ID único del plato',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre del plato',
    example: 'Pizza Margarita',
  })
  nombre: string;

  @ApiPropertyOptional({
    description: 'Descripción del plato',
    example: 'Deliciosa pizza con tomate y mozzarella',
  })
  descripcion?: string;

  @ApiProperty({
    description: 'Precio en centavos',
    example: 15000,
  })
  precio: number;

  @ApiProperty({
    description: 'Categoría del plato',
    example: 'Pizza',
  })
  categoria: string;

  @ApiPropertyOptional({
    description: 'URL de la imagen',
    example: 'https://example.com/pizza.jpg',
  })
  imagen?: string;

  @ApiProperty({
    description: 'Tipo de plato',
    enum: DishType,
    example: DishType.PERSONALIZABLE,
  })
  tipoPlato: DishType;

  @ApiProperty({
    description: 'ID del restaurante',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  restaurantId: string;

  @ApiProperty({
    description: 'Estado del plato',
    example: true,
  })
  activo: boolean;

  @ApiProperty({
    description: 'Lista de toppings/ingredientes',
    type: [ToppingResponseDto],
  })
  toppings: ToppingResponseDto[];

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Información del restaurante (si se incluye)',
    type: 'object',
  })
  restaurant?: {
    id: string;
    nombre: string;
    imagen?: string;
  };

  @ApiPropertyOptional({
    description: 'Disponibilidad del plato (si se incluye)',
    example: true,
  })
  disponible?: boolean;
}

