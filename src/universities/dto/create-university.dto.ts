import { IsString, IsNotEmpty, IsOptional, MaxLength, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUniversityDto {
  @ApiProperty({
    description: 'Nombre de la universidad',
    example: 'Universidad EAN',
    maxLength: 255,
  })
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre: string;

  @ApiProperty({
    description: 'Ciudad donde se ubica la universidad',
    example: 'Bogotá',
    maxLength: 255,
  })
  @IsString({ message: 'La ciudad debe ser un texto' })
  @IsNotEmpty({ message: 'La ciudad es obligatoria' })
  @MaxLength(255, { message: 'La ciudad no puede exceder 255 caracteres' })
  ciudad: string;

  @ApiPropertyOptional({
    description: 'URL de la imagen de la universidad',
    example: 'https://example.com/universidad-ean.jpg',
    maxLength: 500,
  })
  @IsOptional()
  @IsUrl({}, { message: 'La imagen debe ser una URL válida' })
  @MaxLength(1000, { message: 'La URL no puede exceder 500 caracteres' })
  imagen?: string;
}