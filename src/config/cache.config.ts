import { registerAs } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';

export interface CacheConfig {
  store: any;
  host: string;
  port: number;
  password?: string;
  ttl: number;
  max?: number;
}

export default registerAs('cache', (): CacheConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useRedis = process.env.REDIS_ENABLED !== 'false'; // Por defecto habilitado si no se especifica

  // Si Redis no está habilitado o estamos en desarrollo sin Redis, usar memoria
  if (!useRedis || (isDevelopment && !process.env.REDIS_HOST)) {
    return {
      store: 'memory',
      host: 'localhost',
      port: 6379,
      ttl: 300, // 5 minutos por defecto
      max: 100, // Máximo 100 items en memoria
    } as any;
  }

  // Configuración de Redis
  return {
    store: redisStore,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    ttl: parseInt(process.env.CACHE_TTL || '300', 10), // 5 minutos por defecto
    max: parseInt(process.env.CACHE_MAX_ITEMS || '1000', 10), // Máximo 1000 items
  };
});







