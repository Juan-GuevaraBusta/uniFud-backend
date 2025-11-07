import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RestaurantResponseDto {
  @ApiProperty({
    description: 'ID único del restaurante',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre del restaurante',
    example: 'La Parrilla del Chef',
  })
  nombre: string;

  @ApiProperty({
    description: 'ID de la universidad',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  universityId: string;

  @ApiProperty({
    description: 'ID del dueño del restaurante',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  ownerId: string;

  @ApiPropertyOptional({
    description: 'URL de la imagen del restaurante',
    example: 'https://example.com/restaurante.jpg',
  })
  imagen?: string;

  @ApiProperty({
    description: 'Categorías de comida',
    example: ['Pizza', 'Italiana', 'Rápida'],
    type: [String],
  })
  categorias: string[];

  @ApiProperty({
    description: 'Calificación promedio del restaurante',
    example: 4.5,
  })
  calificacion: number;

  @ApiProperty({
    description: 'Tiempo estimado de entrega en minutos',
    example: 25,
  })
  tiempoEntrega: number;

  @ApiProperty({
    description: 'Estado del restaurante',
    example: true,
  })
  activo: boolean;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Información de la universidad (si se incluye)',
    type: 'object',
  })
  university?: {
    id: string;
    nombre: string;
    ciudad: string;
  };

  @ApiPropertyOptional({
    description: 'Información del dueño (si se incluye)',
    type: 'object',
  })
  owner?: {
    id: string;
    nombre: string;
    email: string;
  };
}


