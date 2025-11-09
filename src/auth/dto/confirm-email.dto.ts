import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmEmailDto {
  @ApiProperty({
    description: 'Código de verificación de 6 dígitos enviado al email',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'El código debe tener exactamente 6 caracteres' })
  code: string;

  @ApiProperty({
    description: 'Email del usuario a confirmar',
    example: 'juan.perez@universidadean.edu.co',
  })
  @IsString()
  email: string;
}




