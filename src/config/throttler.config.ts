import { registerAs } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

export interface ThrottlerConfig {
  ttl: number;
  limit: number;
}

/**
 * Configuración de Rate Limiting (Throttling)
 * Límites configurables por variables de entorno con defaults sensatos
 */
export default registerAs('throttler', (): ThrottlerModuleOptions => {
  // Límites generales (default: 100 req/min)
  const generalTTL = parseInt(process.env.THROTTLE_TTL_GENERAL || '60', 10);
  const generalLimit = parseInt(process.env.THROTTLE_LIMIT_GENERAL || '100', 10);

  // Límites para autenticación (default: 5 req/15min)
  const authTTL = parseInt(process.env.THROTTLE_TTL_AUTH || '900', 10); // 15 minutos
  const authLimit = parseInt(process.env.THROTTLE_LIMIT_AUTH || '5', 10);

  // Límites para registro (default: 3 req/hora)
  const registerTTL = parseInt(process.env.THROTTLE_TTL_REGISTER || '3600', 10); // 1 hora
  const registerLimit = parseInt(process.env.THROTTLE_LIMIT_REGISTER || '3', 10);

  // Límites para creación (default: 20 req/min)
  const createTTL = parseInt(process.env.THROTTLE_TTL_CREATE || '60', 10);
  const createLimit = parseInt(process.env.THROTTLE_LIMIT_CREATE || '20', 10);

  // Límites para webhooks (default: 100 req/min)
  const webhookTTL = parseInt(process.env.THROTTLE_TTL_WEBHOOK || '60', 10);
  const webhookLimit = parseInt(process.env.THROTTLE_LIMIT_WEBHOOK || '100', 10);

  // Límite por defecto (usado cuando no se especifica @Throttle())
  return {
    throttlers: [
      {
        ttl: generalTTL * 1000, // Convertir segundos a milisegundos
        limit: generalLimit,
      },
    ],
  };
});

/**
 * Configuraciones específicas para diferentes tipos de endpoints
 * Estas se usan con el decorador @Throttle(limit, ttl)
 */
export const ThrottlerConfigs = {
  /**
   * Configuración para endpoints de autenticación (login, confirm-email)
   * Default: 5 requests cada 15 minutos
   */
  AUTH: {
    limit: parseInt(process.env.THROTTLE_LIMIT_AUTH || '5', 10),
    ttl: parseInt(process.env.THROTTLE_TTL_AUTH || '900', 10),
  },

  /**
   * Configuración para registro de usuarios
   * Default: 3 requests por hora
   */
  REGISTER: {
    limit: parseInt(process.env.THROTTLE_LIMIT_REGISTER || '3', 10),
    ttl: parseInt(process.env.THROTTLE_TTL_REGISTER || '3600', 10),
  },

  /**
   * Configuración para refresh token
   * Default: 10 requests por minuto
   */
  REFRESH: {
    limit: parseInt(process.env.THROTTLE_LIMIT_REFRESH || '10', 10),
    ttl: parseInt(process.env.THROTTLE_TTL_REFRESH || '60', 10),
  },

  /**
   * Configuración para creación de recursos (POST endpoints)
   * Default: 20 requests por minuto
   */
  CREATE: {
    limit: parseInt(process.env.THROTTLE_LIMIT_CREATE || '20', 10),
    ttl: parseInt(process.env.THROTTLE_TTL_CREATE || '60', 10),
  },

  /**
   * Configuración para webhooks
   * Default: 100 requests por minuto
   */
  WEBHOOK: {
    limit: parseInt(process.env.THROTTLE_LIMIT_WEBHOOK || '100', 10),
    ttl: parseInt(process.env.THROTTLE_TTL_WEBHOOK || '60', 10),
  },
};

