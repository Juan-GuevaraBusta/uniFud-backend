import { HelmetOptions } from 'helmet';

/**
 * Configuración de Helmet para headers de seguridad
 * 
 * Configura headers HTTP de seguridad según el entorno:
 * - Content-Security-Policy: Previene XSS y otros ataques de inyección
 * - HSTS: Strict Transport Security solo en producción (HTTPS)
 * - X-Content-Type-Options: Previene MIME sniffing
 * - X-Frame-Options: Previene clickjacking
 * - X-XSS-Protection: Protección adicional contra XSS
 */
export function getHelmetConfig(): HelmetOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Para Swagger UI
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: isProduction
      ? {
          maxAge: 31536000, // 1 año
          includeSubDomains: true,
          preload: true,
        }
      : false,
    crossOriginEmbedderPolicy: false, // Permitir embeds si es necesario
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Para CORS
    permittedCrossDomainPolicies: false,
    xContentTypeOptions: true, // nosniff
    xFrameOptions: { action: 'deny' }, // DENY
    xXssProtection: true, // 1; mode=block
  };
}

