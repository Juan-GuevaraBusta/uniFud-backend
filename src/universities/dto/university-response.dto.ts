import { ApiProperty } from '@nestjs/swagger';

export class UniversityResponseDto {
  @ApiProperty({
    description: 'ID único de la universidad',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre de la universidad',
    example: 'Universidad EAN',
  })
  nombre: string;

  @ApiProperty({
    description: 'Ciudad donde se ubica',
    example: 'Bogotá',
  })
  ciudad: string;

  @ApiProperty({
    description: 'URL de la imagen',
    example: 'https://example.com/universidad-ean.jpg',
    required: false,
  })
  imagen?: string;

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
}