import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, IsInt, Min, IsEnum, IsIn, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum DishSearchOrderBy {
  PRECIO = 'precio',
  NOMBRE = 'nombre',
  POPULARIDAD = 'popularidad',
}

export enum DishSearchOrderDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class DishSearchQueryDto extends PaginationDto {
  @ApiProperty({
    description: 'Texto de búsqueda por nombre del plato',
    example: 'pizza',
    minLength: 1,
  })
  @IsNotEmpty({ message: 'El texto de búsqueda es requerido' })
  @IsString({ message: 'El texto de búsqueda debe ser una cadena de texto' })
  q: string;

  @ApiPropertyOptional({
    description: 'Filtrar por restaurante',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El restaurante debe ser un UUID válido' })
  restaurantId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por categoría',
    maxLength: 50,
    example: 'Pizza',
  })
  @IsOptional()
  @IsString({ message: 'La categoría debe ser una cadena de texto' })
  @MaxLength(50, { message: 'La categoría no puede exceder 50 caracteres' })
  categoria?: string;

  @ApiPropertyOptional({
    description: 'Precio mínimo en centavos',
    example: 10000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El precio mínimo debe ser un número entero' })
  @Min(0, { message: 'El precio mínimo no puede ser negativo' })
  precioMin?: number;

  @ApiPropertyOptional({
    description: 'Precio máximo en centavos',
    example: 50000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El precio máximo debe ser un número entero' })
  @Min(0, { message: 'El precio máximo no puede ser negativo' })
  precioMax?: number;

  @ApiPropertyOptional({
    enum: DishSearchOrderBy,
    description: 'Campo por el cual ordenar los resultados',
    default: DishSearchOrderBy.NOMBRE,
    example: DishSearchOrderBy.NOMBRE,
  })
  @IsOptional()
  @IsEnum(DishSearchOrderBy, { message: 'orderBy debe ser uno de: precio, nombre, popularidad' })
  orderBy?: DishSearchOrderBy = DishSearchOrderBy.NOMBRE;

  @ApiPropertyOptional({
    enum: DishSearchOrderDirection,
    description: 'Dirección del ordenamiento (ASC o DESC)',
    default: DishSearchOrderDirection.ASC,
    example: DishSearchOrderDirection.ASC,
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'], { message: 'orderDirection debe ser ASC o DESC' })
  orderDirection?: DishSearchOrderDirection = DishSearchOrderDirection.ASC;
}

