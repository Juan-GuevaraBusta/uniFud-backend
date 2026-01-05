import { ApiProperty } from '@nestjs/swagger';

export class UserCardResponseDto {
  @ApiProperty({ description: 'ID de la tarjeta' })
  id: string;

  @ApiProperty({ description: 'ID del usuario propietario' })
  userId: string;

  @ApiProperty({ description: 'ID de Payment Source en Wompi' })
  wompiPaymentSourceId: string;

  @ApiProperty({ description: 'Últimos 4 dígitos de la tarjeta' })
  cardLastFour: string;

  @ApiProperty({ description: 'Marca de la tarjeta (VISA, MASTERCARD, AMEX)' })
  cardBrand: string;

  @ApiProperty({ description: 'Nombre del titular de la tarjeta', required: false })
  cardHolderName?: string;

  @ApiProperty({ description: 'Mes de expiración' })
  expMonth: number;

  @ApiProperty({ description: 'Año de expiración' })
  expYear: number;

  @ApiProperty({ description: 'Indica si es la tarjeta por defecto' })
  isDefault: boolean;

  @ApiProperty({ description: 'Indica si la tarjeta está activa' })
  isActive: boolean;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  updatedAt: Date;
}




