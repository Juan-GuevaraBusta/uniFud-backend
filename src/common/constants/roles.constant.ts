import { UserRole } from '../../users/entities/user.entity';

/**
 * Constantes de roles del sistema
 */
export const ROLES = {
  STUDENT: UserRole.STUDENT,
  RESTAURANT_OWNER: UserRole.RESTAURANT_OWNER,
  ADMIN: UserRole.ADMIN,
} as const;

/**
 * Lista de todos los roles disponibles
 */
export const ALL_ROLES = Object.values(UserRole);

/**
 * Roles que pueden ser asignados por un administrador
 */
export const ASSIGNABLE_ROLES = [
  UserRole.STUDENT,
  UserRole.RESTAURANT_OWNER,
  UserRole.ADMIN,
];

/**
 * Obtener el nombre legible de un rol
 * @param role - Rol del usuario
 * @returns Nombre legible del rol en español
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    [UserRole.STUDENT]: 'Estudiante',
    [UserRole.RESTAURANT_OWNER]: 'Dueño de Restaurante',
    [UserRole.ADMIN]: 'Administrador',
  };

  return roleNames[role] || 'Usuario';
}

/**
 * Verificar si un rol es válido
 * @param role - Rol a verificar
 * @returns true si el rol es válido
 */
export function isValidRole(role: string): role is UserRole {
  return ALL_ROLES.includes(role as UserRole);
}

/**
 * Verificar si un rol puede ser asignado
 * @param role - Rol a verificar
 * @returns true si el rol puede ser asignado
 */
export function isAssignableRole(role: UserRole): boolean {
  return ASSIGNABLE_ROLES.includes(role);
}


