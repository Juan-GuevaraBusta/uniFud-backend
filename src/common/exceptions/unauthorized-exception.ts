import { ForbiddenException, HttpStatus, UnauthorizedException } from '@nestjs/common';

export class UnauthorizedAccessException extends UnauthorizedException {
  constructor(message = 'Autenticación requerida o inválida', errorCode = 'UNAUTHORIZED') {
    super({ message, errorCode, statusCode: HttpStatus.UNAUTHORIZED });
  }
}

export class ForbiddenAccessException extends ForbiddenException {
  constructor(message = 'No tienes permisos para realizar esta acción', errorCode = 'FORBIDDEN') {
    super({ message, errorCode, statusCode: HttpStatus.FORBIDDEN });
  }
}
