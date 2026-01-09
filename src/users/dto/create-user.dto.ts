import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'juan.perez@universidadean.edu.co',
    maxLength: 255,
  })
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  @MaxLength(255, { message: 'El email no puede exceder 255 caracteres' })
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: 'El formato del email no es válido',
  })
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'Password123!',
    minLength: 6,
    maxLength: 50,
  })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(50, { message: 'La contraseña no puede exceder 50 caracteres' })
  password: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre: string;

  @ApiProperty({
    description: 'Rol del usuario',
    enum: UserRole,
    default: UserRole.STUDENT,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Rol inválido' })
  role?: UserRole;
}
