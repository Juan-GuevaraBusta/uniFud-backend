import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max, IsString, MaxLength, Matches } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ description: 'Número de página (comienza en 1)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de página debe ser un entero' })
  @Min(1, { message: 'La página mínima es 1' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de elementos por página', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un entero' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(100, { message: 'El límite máximo es 100' })
  limit?: number = 20;

  @ApiPropertyOptional({ 
    description: 'Campo para ordenar resultados (formato: campo:ASC|DESC)',
    example: 'createdAt:DESC',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El campo de ordenamiento no puede exceder 100 caracteres' })
  @Matches(/^[a-zA-Z0-9_]+:(ASC|DESC)$/i, {
    message: 'El formato de ordenamiento debe ser: campo:ASC o campo:DESC',
  })
  sort?: string;

  @ApiPropertyOptional({
    description: 'Texto de búsqueda',
    example: 'pizza',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'El texto de búsqueda no puede exceder 255 caracteres' })
  search?: string;

  get skip(): number {
    const limit = this.limit ?? 20;
    const page = this.page ?? 1;
    return (page - 1) * limit;
  }

  get take(): number {
    return this.limit ?? 20;
  }

  /**
   * Obtener el campo de ordenamiento validado
   * @returns El nombre del campo sin la dirección
   */
  getSortField(): string | undefined {
    if (!this.sort) {
      return undefined;
    }
    return this.sort.split(':')[0];
  }

  /**
   * Obtener la dirección de ordenamiento (ASC o DESC)
   * @returns 'ASC' o 'DESC', por defecto 'ASC'
   */
  getSortDirection(): 'ASC' | 'DESC' {
    if (!this.sort) {
      return 'ASC';
    }
    const direction = this.sort.split(':')[1]?.toUpperCase();
    return direction === 'DESC' ? 'DESC' : 'ASC';
  }
}

