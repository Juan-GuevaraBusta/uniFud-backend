import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsArray, IsUUID, ValidateNested, Min, Max, MaxLength, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DishType } from '../entities/dish.entity';
import { CreateToppingDto } from './create-topping.dto';

export class CreateDishDto {
  @ApiProperty({
    description: 'Nombre del plato',
    example: 'Pizza Margarita',
    maxLength: 255,
  })
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre: string;

  @ApiPropertyOptional({
    description: 'Descripción del plato',
    example: 'Deliciosa pizza con tomate, mozzarella y albahaca fresca',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  descripcion?: string;

  @ApiProperty({
    description: 'Precio del plato en centavos',
    example: 15000,
    minimum: 1,
  })
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Type(() => Number)
  @Min(1, { message: 'El precio debe ser mayor a 0' })
  precio: number;

  @ApiProperty({
    description: 'Categoría del plato',
    example: 'Pizza',
    maxLength: 100,
  })
  @IsString({ message: 'La categoría debe ser un texto' })
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  @MaxLength(100, { message: 'La categoría no puede exceder 100 caracteres' })
  categoria: string;

  @ApiPropertyOptional({
    description: 'URL de la imagen del plato',
    example: 'https://example.com/pizza-margarita.jpg',
    maxLength: 500,
  })
  @IsOptional()
  @IsUrl({}, { message: 'La imagen debe ser una URL válida' })
  @MaxLength(500, { message: 'La URL no puede exceder 500 caracteres' })
  imagen?: string;

  @ApiProperty({
    description: 'Tipo de plato',
    enum: DishType,
    example: DishType.PERSONALIZABLE,
  })
  @IsEnum(DishType, { message: 'Tipo de plato inválido' })
  tipoPlato: DishType;

  @ApiProperty({
    description: 'ID del restaurante al que pertenece el plato',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'El ID de restaurante debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El ID de restaurante es obligatorio' })
  restaurantId: string;

  @ApiPropertyOptional({
    description: 'Lista de toppings/ingredientes del plato',
    type: [CreateToppingDto],
    isArray: true,
  })
  @IsOptional()
  @IsArray({ message: 'Los toppings deben ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateToppingDto)
  toppings?: CreateToppingDto[];
}

