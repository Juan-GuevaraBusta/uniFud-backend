import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserCardDto {
  @ApiProperty({
    description: 'Token de la tarjeta generado por Wompi.js en el frontend',
    example: 'tok_prod_123_abc',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'El token de la tarjeta es obligatorio' })
  token: string;

  @ApiProperty({
    description: 'Token de aceptación de política de privacidad',
    example: 'acceptance_token_xxx',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'El token de aceptación es obligatorio' })
  acceptanceToken: string;

  @ApiProperty({
    description: 'Token de aceptación de tratamiento de datos personales',
    example: 'accept_personal_auth_xxx',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'El token de aceptación de datos personales es obligatorio' })
  acceptPersonalAuth: string;

  @ApiPropertyOptional({
    description: 'Indica si esta tarjeta será la tarjeta por defecto',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

