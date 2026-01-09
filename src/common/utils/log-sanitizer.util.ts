/**
 * Utilidades para sanitizar datos sensibles antes de loguear
 * 
 * Previene la exposición de información sensible como passwords, API keys,
 * tokens, etc. en los logs del sistema.
 */

/**
 * Lista de campos considerados sensibles que deben ser sanitizados
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'apiKey',
  'api_key',
  'apikey',
  'secret',
  'secretKey',
  'secret_key',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'verificationCode',
  'verification_code',
  'wompiPrivateKey',
  'wompi_private_key',
  'wompiPublicKey',
  'wompi_public_key',
  'wompiIntegritySecret',
  'wompi_integrity_secret',
  'siigoAccessKey',
  'siigo_access_key',
  'siigoUsername',
  'siigo_username',
  'jwtSecret',
  'jwt_secret',
  'jwtRefreshSecret',
  'jwt_refresh_secret',
  'dbPassword',
  'db_password',
  'authorization',
  'auth',
  'bearer',
] as const;

/**
 * Sanitiza un valor sensible mostrando solo los últimos caracteres
 * @param value Valor a sanitizar
 * @param visibleChars Número de caracteres visibles al final (default: 4)
 * @returns Valor sanitizado
 */
function maskValue(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars) {
    return '[REDACTED]';
  }
  const masked = '*'.repeat(value.length - visibleChars);
  const visible = value.slice(-visibleChars);
  return `${masked}${visible}`;
}

/**
 * Verifica si un campo es sensible
 * @param fieldName Nombre del campo a verificar
 * @returns true si el campo es sensible
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some((field) => lowerFieldName.includes(field.toLowerCase()));
}

/**
 * Sanitiza un objeto recursivamente, reemplazando valores sensibles
 * @param data Datos a sanitizar
 * @param maskLastChars Número de caracteres visibles al final para valores sensibles (default: 0 = [REDACTED])
 * @returns Objeto sanitizado
 */
export function sanitizeForLogging(data: any, maskLastChars: number = 0): any {
  // Casos base
  if (data === null || data === undefined) {
    return data;
  }

  // Si es un string primitivo, retornarlo sin cambios (no debería estar aquí directamente)
  if (typeof data === 'string' && !data.startsWith('{') && !data.startsWith('[')) {
    return data;
  }

  // Si es un array, sanitizar cada elemento
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLogging(item, maskLastChars));
  }

  // Si es un objeto, sanitizar recursivamente
  if (typeof data === 'object' && data.constructor === Object) {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Si el campo es sensible, sanitizar el valor
      if (isSensitiveField(key)) {
        if (typeof value === 'string') {
          sanitized[key] = maskLastChars > 0 ? maskValue(value, maskLastChars) : '[REDACTED]';
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else {
        // Si no es sensible, sanitizar recursivamente
        sanitized[key] = sanitizeForLogging(value, maskLastChars);
      }
    }
    
    return sanitized;
  }

  // Para otros tipos (números, booleanos, etc.), retornar sin cambios
  return data;
}

/**
 * Sanitiza un string o objeto para logging, removiendo completamente información sensible
 * @param data Datos a sanitizar
 * @returns Datos sanitizados
 */
export function sanitizeForLoggingStrict(data: any): any {
  return sanitizeForLogging(data, 0);
}

/**
 * Sanitiza un string o objeto para logging, mostrando últimos 4 caracteres de valores sensibles
 * @param data Datos a sanitizar
 * @returns Datos sanitizados
 */
export function sanitizeForLoggingWithMask(data: any): any {
  return sanitizeForLogging(data, 4);
}

