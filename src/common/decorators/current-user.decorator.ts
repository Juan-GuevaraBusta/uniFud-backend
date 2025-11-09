import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorador para obtener el usuario autenticado del request
 * El usuario es inyectado por el JwtStrategy después de validar el token
 * 
 * Ejemplo:
 * @Get('profile')
 * async getProfile(@CurrentUser() user: any) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);




