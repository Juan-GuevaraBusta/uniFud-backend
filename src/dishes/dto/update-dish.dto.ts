import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateDishDto } from './create-dish.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDishDto extends PartialType(
  OmitType(CreateDishDto, ['restaurantId', 'toppings'] as const)
) {
  @ApiPropertyOptional({
    description: 'Estado del plato (activo/inactivo)',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso' })
  activo?: boolean;
}


