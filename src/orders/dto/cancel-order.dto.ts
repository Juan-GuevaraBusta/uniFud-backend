import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CancelOrderDto {
  @ApiProperty({
    description: 'Motivo de la cancelación',
    example: 'Tu pedido no puede ser preparado porque faltan ingredientes',
  })
  @IsString({ message: 'El motivo debe ser un texto' })
  @IsNotEmpty({ message: 'El motivo de cancelación es obligatorio' })
  motivo: string;

  @ApiPropertyOptional({
    description: 'Comentarios adicionales del restaurante (solo para restaurante o admin)',
    example: 'Te contactaremos para ofrecerte alternativas',
  })
  @IsOptional()
  @IsString({ message: 'Los comentarios deben ser un texto' })
  comentariosRestaurante?: string;
}



