import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  // PartialType hace que todos los campos de CreateUserDto sean opcionales
  // Esto permite actualizar solo los campos necesarios
}






