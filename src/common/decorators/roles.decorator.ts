import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Decorador para especificar qué roles tienen acceso a un endpoint
 * Debe usarse junto con RolesGuard
 * 
 * Ejemplo:
 * @Roles(UserRole.ADMIN, UserRole.RESTAURANT_OWNER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);





