import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsUrl,
  MinLength,
  Min,
  Max,
  validateSync,
  IsBoolean,
} from 'class-validator';

/**
 * Entornos válidos de la aplicación
 */
enum Environment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

/**
 * Clase para validar variables de entorno
 * Usa decoradores de class-validator para validar tipos y formatos
 */
class EnvironmentVariables {
  // Application
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT?: number;

  // Database - Requeridas excepto en desarrollo con defaults
  @IsString()
  @IsOptional()
  DB_HOST?: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  DB_PORT?: number;

  @IsString()
  @IsOptional()
  DB_USERNAME?: string;

  @IsString()
  @IsOptional()
  DB_PASSWORD?: string;

  @IsString()
  @IsOptional()
  DB_NAME?: string;

  // JWT - Requeridas
  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET debe tener al menos 32 caracteres por seguridad',
  })
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRATION: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres por seguridad',
  })
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_REFRESH_EXPIRATION: string;

  // Wompi - Requeridas para producción
  @IsString()
  @IsOptional()
  WOMPI_PUBLIC_KEY?: string;

  @IsString()
  @IsOptional()
  WOMPI_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  WOMPI_INTEGRITY_SECRET?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  WOMPI_API_URL?: string;

  // Siigo - Opcionales (solo si se usa facturación)
  @IsUrl({ require_tld: false })
  @IsOptional()
  SIIGO_API_URL?: string;

  @IsString()
  @IsOptional()
  SIIGO_USERNAME?: string;

  @IsString()
  @IsOptional()
  SIIGO_ACCESS_KEY?: string;

  @IsNumber()
  @IsOptional()
  SIIGO_DOCUMENT_ID?: number;

  @IsNumber()
  @IsOptional()
  SIIGO_COST_CENTER?: number;

  @IsNumber()
  @IsOptional()
  SIIGO_SELLER?: number;

  @IsNumber()
  @IsOptional()
  SIIGO_TAX_ID?: number;

  @IsNumber()
  @IsOptional()
  SIIGO_PAYMENT_CASH_ID?: number;

  @IsNumber()
  @IsOptional()
  SIIGO_PAYMENT_CARD_ID?: number;

  // Redis/Cache - Opcionales
  @IsBoolean()
  @IsOptional()
  REDIS_ENABLED?: boolean;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  REDIS_PORT?: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  CACHE_TTL?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  CACHE_MAX_ITEMS?: number;

  // CORS - Opcionales
  @IsString()
  @IsOptional()
  STAGING_BACKEND_URL?: string;

  @IsString()
  @IsOptional()
  STAGING_WEB_URL?: string;

  @IsString()
  @IsOptional()
  PRODUCTION_BACKEND_URL?: string;

  @IsString()
  @IsOptional()
  PRODUCTION_WEB_URL?: string;

  // Logging
  @IsString()
  @IsOptional()
  LOG_LEVEL?: string;

  // Expo - Opcional
  @IsString()
  @IsOptional()
  EXPO_ACCESS_TOKEN?: string;
}

/**
 * Convertir valores de process.env a tipos correctos
 */
function transformEnvValues(config: Record<string, unknown>): Record<string, unknown> {
  const transformed = { ...config };

  // Convertir números
  const numberFields = [
    'PORT',
    'DB_PORT',
    'REDIS_PORT',
    'CACHE_TTL',
    'CACHE_MAX_ITEMS',
    'SIIGO_DOCUMENT_ID',
    'SIIGO_COST_CENTER',
    'SIIGO_SELLER',
    'SIIGO_TAX_ID',
    'SIIGO_PAYMENT_CASH_ID',
    'SIIGO_PAYMENT_CARD_ID',
  ];

  numberFields.forEach((field) => {
    if (transformed[field] !== undefined && transformed[field] !== null) {
      const value = transformed[field];
      if (typeof value === 'string' && value.trim() !== '') {
        const num = parseInt(value, 10);
        if (!isNaN(num)) {
          transformed[field] = num;
        }
      }
    }
  });

  // Convertir booleanos
  if (transformed.REDIS_ENABLED !== undefined && transformed.REDIS_ENABLED !== null) {
    const value = transformed.REDIS_ENABLED;
    if (typeof value === 'string') {
      transformed.REDIS_ENABLED = value.toLowerCase() === 'true' || value === '1';
    }
  }

  return transformed;
}

/**
 * Validar variables de entorno
 * Se ejecuta antes de inicializar la aplicación
 * 
 * @param config - Objeto con las variables de entorno
 * @returns Configuración validada
 * @throws Error si hay variables faltantes o inválidas
 */
export function validate(config: Record<string, unknown>) {
  // Transformar valores de string a tipos correctos
  const transformedConfig = transformEnvValues(config);

  // Determinar entorno
  const nodeEnv = (config.NODE_ENV as string) || process.env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';

  // En desarrollo, saltar validación estricta - solo validaciones básicas opcionales
  if (isDevelopment) {
    // Validaciones mínimas en desarrollo (solo formatos básicos si existen)
    const devWarnings: string[] = [];

    // Solo validar NODE_ENV
    if (transformedConfig.NODE_ENV) {
      if (!['development', 'staging', 'production'].includes(transformedConfig.NODE_ENV as string)) {
        devWarnings.push(`NODE_ENV debe ser 'development', 'staging' o 'production'`);
      }
    }

    // Validar formato de PORT si existe
    if (transformedConfig.PORT !== undefined) {
      const port = Number(transformedConfig.PORT);
      if (isNaN(port) || port < 1 || port > 65535) {
        devWarnings.push(`PORT debe ser un número entre 1 y 65535`);
      }
    }

    // Advertir sobre JWT_SECRET corto, pero no fallar
    if (transformedConfig.JWT_SECRET) {
      const jwtSecret = String(transformedConfig.JWT_SECRET);
      if (jwtSecret.length < 32) {
        devWarnings.push(`⚠️  JWT_SECRET tiene menos de 32 caracteres. Considera usar: openssl rand -base64 32`);
      }
    }

    // Mostrar advertencias pero no fallar
    if (devWarnings.length > 0) {
      console.warn('⚠️  Advertencias de configuración (desarrollo):\n' + devWarnings.map(w => `  - ${w}`).join('\n'));
    }

    // Retornar configuración transformada sin validación estricta
    return transformedConfig;
  }

  // En producción y staging, validación estricta completa
  const validatedConfig = plainToInstance(EnvironmentVariables, transformedConfig, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map((error) => {
      const constraints = error.constraints
        ? Object.values(error.constraints).join(', ')
        : 'Error de validación';
      return `  - ${error.property}: ${constraints}`;
    });

    throw new Error(
      `❌ Validación de variables de entorno falló:\n${errorMessages.join('\n')}\n\n` +
        'Por favor, revisa tu archivo .env y asegúrate de que todas las variables requeridas estén configuradas.\n' +
        'Consulta .env.example para ver un ejemplo de configuración.',
    );
  }

  // Validaciones adicionales por entorno

  // En producción, validar variables críticas
  if (nodeEnv === Environment.Production) {
    const missingVars: string[] = [];

    if (!validatedConfig.JWT_SECRET || validatedConfig.JWT_SECRET.length < 32) {
      missingVars.push('JWT_SECRET (debe tener al menos 32 caracteres)');
    }

    if (!validatedConfig.JWT_REFRESH_SECRET || validatedConfig.JWT_REFRESH_SECRET.length < 32) {
      missingVars.push('JWT_REFRESH_SECRET (debe tener al menos 32 caracteres)');
    }

    if (!validatedConfig.DB_HOST || !validatedConfig.DB_PASSWORD) {
      missingVars.push('DB_HOST y DB_PASSWORD (requeridos en producción)');
    }

    if (!validatedConfig.WOMPI_PUBLIC_KEY || !validatedConfig.WOMPI_PRIVATE_KEY) {
      missingVars.push('WOMPI_PUBLIC_KEY y WOMPI_PRIVATE_KEY (requeridos en producción)');
    }

    if (missingVars.length > 0) {
      throw new Error(
        `❌ Variables de entorno faltantes o inválidas en producción:\n${missingVars.map((v) => `  - ${v}`).join('\n')}\n\n` +
          'Por favor, configura todas las variables requeridas antes de desplegar a producción.',
      );
    }
  }

  // En desarrollo, usar valores por defecto si no están configurados
  if (nodeEnv === Environment.Development) {
    if (!validatedConfig.PORT) {
      validatedConfig.PORT = 3000;
    }
    if (!validatedConfig.DB_HOST) {
      validatedConfig.DB_HOST = 'localhost';
    }
    if (!validatedConfig.DB_PORT) {
      validatedConfig.DB_PORT = 5432;
    }
    if (!validatedConfig.DB_NAME) {
      validatedConfig.DB_NAME = 'unifood_db';
    }
    if (!validatedConfig.LOG_LEVEL) {
      validatedConfig.LOG_LEVEL = 'debug';
    }
  }

  return validatedConfig;
}

