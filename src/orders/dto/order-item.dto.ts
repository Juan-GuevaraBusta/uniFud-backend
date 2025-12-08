import { IsString, IsNotEmpty, IsNumber, IsUUID, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ToppingSelectionDto {
  @ApiProperty({
    description: 'ID del topping',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'El ID del topping debe ser un UUID válido' })
  id: string;

  @ApiProperty({
    description: 'Nombre del topping',
    example: 'Queso extra',
  })
  @IsString()
  nombre: string;

  @ApiProperty({
    description: 'Precio del topping en centavos',
    example: 2000,
  })
  @IsNumber()
  @Type(() => Number)
  precio: number;
}

export class OrderItemDto {
  @ApiProperty({
    description: 'ID del plato',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'El ID del plato debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El ID del plato es obligatorio' })
  dishId: string;

  @ApiProperty({
    description: 'Nombre del plato',
    example: 'Pizza Margarita',
  })
  @IsString()
  @IsNotEmpty()
  dishNombre: string;

  @ApiProperty({
    description: 'Cantidad de platos',
    example: 2,
    minimum: 1,
  })
  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @Type(() => Number)
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidad: number;

  @ApiProperty({
    description: 'Precio unitario del plato en centavos',
    example: 15000,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  precioUnitario: number;

  @ApiProperty({
    description: 'Precio total del item (unitario x cantidad) en centavos',
    example: 30000,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  precioTotal: number;

  @ApiPropertyOptional({
    description: 'Toppings adicionales seleccionados',
    type: [ToppingSelectionDto],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToppingSelectionDto)
  toppingsSeleccionados?: ToppingSelectionDto[];

  @ApiPropertyOptional({
    description: 'Ingredientes base que el cliente pidió remover',
    type: [Object],
    isArray: true,
    example: [{ id: 'uuid', nombre: 'Cebolla' }],
  })
  @IsOptional()
  @IsArray()
  toppingsBaseRemocionados?: Array<{ id: string; nombre: string }>;

  @ApiPropertyOptional({
    description: 'Comentarios especiales para este item',
    example: 'Sin sal por favor',
  })
  @IsOptional()
  @IsString()
  comentarios?: string;
}





