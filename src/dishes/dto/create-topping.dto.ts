import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateToppingDto {
  @ApiProperty({
    description: 'Nombre del topping/ingrediente',
    example: 'Queso extra',
    maxLength: 255,
  })
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre: string;

  @ApiPropertyOptional({
    description: 'Precio adicional del topping en centavos (0 si es gratis)',
    example: 2000,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Type(() => Number)
  @Min(0, { message: 'El precio no puede ser negativo' })
  precio?: number;

  @ApiPropertyOptional({
    description: 'Si el topping es removible (parte de los ingredientes base)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Removible debe ser verdadero o falso' })
  removible?: boolean;

  @ApiPropertyOptional({
    description: 'Categoría del topping',
    example: 'Proteína',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'La categoría debe ser un texto' })
  @MaxLength(100, { message: 'La categoría no puede exceder 100 caracteres' })
  categoria?: string;
}





