import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class UpdateRoleDto {
  @ApiProperty({
    description: 'Nuevo rol a asignar al usuario',
    enum: UserRole,
    example: UserRole.RESTAURANT_OWNER,
  })
  @IsEnum(UserRole, {
    message: 'El rol debe ser uno de: student, restaurant_owner, admin',
  })
  @IsNotEmpty({ message: 'El rol es requerido' })
  role: UserRole;
}


