import { IsString, IsNotEmpty, IsOptional, IsArray, IsUUID, IsNumber, Min, Max, MaxLength, IsUrl, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRestaurantDto {
  @ApiProperty({
    description: 'Nombre del restaurante',
    example: 'La Parrilla del Chef',
    maxLength: 255,
  })
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre: string;

  @ApiProperty({
    description: 'ID de la universidad donde se ubica el restaurante',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'El ID de universidad debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El ID de universidad es obligatorio' })
  universityId: string;

  @ApiPropertyOptional({
    description: 'URL de la imagen del restaurante',
    example: 'https://example.com/restaurante.jpg',
    maxLength: 500,
  })
  @IsOptional()
  @IsUrl({}, { message: 'La imagen debe ser una URL válida' })
  @MaxLength(500, { message: 'La URL no puede exceder 500 caracteres' })
  imagen?: string;

  @ApiProperty({
    description: 'Categorías de comida del restaurante',
    example: ['Pizza', 'Italiana', 'Rápida'],
    type: [String],
    isArray: true,
  })
  @IsArray({ message: 'Las categorías deben ser un array' })
  @ArrayMinSize(1, { message: 'Debe tener al menos una categoría' })
  @IsString({ each: true, message: 'Cada categoría debe ser un texto' })
  categorias: string[];

  @ApiPropertyOptional({
    description: 'Tiempo estimado de entrega en minutos',
    example: 25,
    minimum: 5,
    maximum: 120,
    default: 20,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El tiempo de entrega debe ser un número' })
  @Type(() => Number)
  @Min(5, { message: 'El tiempo de entrega mínimo es 5 minutos' })
  @Max(120, { message: 'El tiempo de entrega máximo es 120 minutos' })
  tiempoEntrega?: number;
}