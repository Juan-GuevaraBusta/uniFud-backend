import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty({
    description: 'ID único del usuario',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Email del usuario',
    example: 'juan.perez@universidadean.edu.co',
  })
  email: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
  })
  nombre?: string;

  @Expose()
  @ApiProperty({
    description: 'Rol del usuario en el sistema',
    enum: UserRole,
    example: UserRole.STUDENT,
  })
  role: UserRole;

  @Expose()
  @ApiProperty({
    description: 'Indica si el email del usuario ha sido verificado',
    example: true,
  })
  emailVerified: boolean;

  @Expose()
  @ApiProperty({
    description: 'Fecha de creación del usuario',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Fecha de última actualización del usuario',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}









