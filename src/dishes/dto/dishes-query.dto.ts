import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class DishesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por restaurante', format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'El restaurante debe ser un UUID válido' })
  restaurantId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoria?: string;

  @ApiPropertyOptional({ description: 'Texto de búsqueda por nombre' })
  @IsOptional()
  @IsString()
  search?: string;
}

