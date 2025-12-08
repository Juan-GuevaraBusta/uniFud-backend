import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Guard que verifica que el usuario sea propietario de un restaurante
 * Este guard debe usarse después de JwtAuthGuard
 */
@Injectable()
export class RestaurantOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (user.role !== UserRole.RESTAURANT_OWNER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo los propietarios de restaurantes pueden acceder a este recurso'
      );
    }

    return true;
  }
}





