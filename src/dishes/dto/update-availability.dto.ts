import { IsBoolean, IsNotEmpty, IsUUID, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateAvailabilityDto {
  @ApiProperty({
    description: 'Estado de disponibilidad del plato',
    example: true,
  })
  @IsBoolean({ message: 'Disponible debe ser verdadero o falso' })
  @IsNotEmpty({ message: 'El estado de disponibilidad es obligatorio' })
  disponible: boolean;
}

export class BulkUpdateAvailabilityItemDto {
  @ApiProperty({
    description: 'ID del plato',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'El ID del plato debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El ID del plato es obligatorio' })
  dishId: string;

  @ApiProperty({
    description: 'Estado de disponibilidad',
    example: false,
  })
  @IsBoolean({ message: 'Disponible debe ser verdadero o falso' })
  disponible: boolean;
}

export class BulkUpdateAvailabilityDto {
  @ApiProperty({
    description: 'Lista de cambios de disponibilidad',
    type: [BulkUpdateAvailabilityItemDto],
    isArray: true,
    example: [
      { dishId: '123e4567-e89b-12d3-a456-426614174000', disponible: false },
      { dishId: '234e5678-e89b-12d3-a456-426614174001', disponible: true },
    ],
  })
  @IsArray({ message: 'Los cambios deben ser un array' })
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateAvailabilityItemDto)
  changes: BulkUpdateAvailabilityItemDto[];
}




