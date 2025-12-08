import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class AuthResponseDto {
  @ApiProperty({
    description: 'Token de acceso JWT',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token de refresco para obtener nuevos access tokens',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Información del usuario autenticado',
  })
  user: {
    id: string;
    email: string;
    nombre: string;
    role: string;
    emailVerified: boolean;
  };

  @ApiProperty({
    description: 'Timestamp de expiración del access token',
    example: 1699123456789,
  })
  expiresIn: number;
}

export class UserResponseDto {
  @ApiProperty({ description: 'ID único del usuario' })
  id: string;

  @ApiProperty({ description: 'Email del usuario' })
  email: string;

  @ApiProperty({ description: 'Nombre completo del usuario' })
  nombre: string;

  @ApiProperty({ description: 'Rol del usuario' })
  role: string;

  @ApiProperty({ description: 'Estado de verificación del email' })
  emailVerified: boolean;

  @Exclude()
  password: string;

  @Exclude()
  verificationCode: string;

  @Exclude()
  verificationCodeExpiry: Date;
}





