import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Guard que verifica que el usuario sea administrador
 * 
 * Uso:
 * @UseGuards(AdminGuard)
 * @Get('admin-only')
 * adminOnly() { ... }
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Debes estar autenticado para acceder a este recurso');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo los administradores pueden acceder a este recurso');
    }

    return true;
  }
}







