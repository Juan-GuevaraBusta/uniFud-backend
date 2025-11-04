import { PartialType } from '@nestjs/swagger';
import { CreateRestaurantDto } from './create-restaurant.dto';
import { IsBoolean, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto) {
  @ApiPropertyOptional({
    description: 'Estado del restaurante (activo/inactivo)',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso' })
  activo?: boolean;

  @ApiPropertyOptional({
    description: 'Calificación del restaurante',
    example: 4.5,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber({}, { message: 'La calificación debe ser un número' })
  @Type(() => Number)
  @Min(0, { message: 'La calificación mínima es 0' })
  @Max(5, { message: 'La calificación máxima es 5' })
  calificacion?: number;
}

