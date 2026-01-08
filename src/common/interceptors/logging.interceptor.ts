import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor, Inject, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  // Endpoints sensibles que requieren logging adicional de seguridad
  private readonly sensitiveEndpoints = [
    '/auth/login',
    '/auth/register',
    '/auth/confirm-email',
    '/auth/resend-code',
    '/auth/refresh',
    '/payments/webhooks',
  ];

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: WinstonLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    if (!request) {
      return next.handle();
    }

    const { method, originalUrl, ip, headers } = request;
    const user = request.user as any;
    const userLabel = user
      ? user.email ?? user.nombre ?? user.id
      : 'anonymous';
    const startedAt = Date.now();
    const isSensitiveEndpoint = this.sensitiveEndpoints.some(endpoint => originalUrl.includes(endpoint));

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - startedAt;
        const statusCode = response.statusCode;
        
        // Logging normal
        this.logger.log(`${method} ${originalUrl} ${statusCode} (${elapsed}ms) - user: ${userLabel}`);
        
        const logData: Record<string, any> = {
          context: LoggingInterceptor.name,
          method,
          url: originalUrl,
          statusCode,
          responseTime: elapsed,
          userId: user?.id,
          userEmail: user?.email,
          ip,
          userAgent: headers['user-agent'],
        };

        // Detectar eventos de seguridad y agregar contexto adicional
        if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
          // Rate limit excedido - evento de seguridad crítico
          logData.securityEvent = 'rate_limit_exceeded';
          logData.rateLimitLimit = response.getHeader('X-RateLimit-Limit');
          logData.rateLimitRemaining = response.getHeader('X-RateLimit-Remaining');
          logData.rateLimitReset = response.getHeader('X-RateLimit-Reset');
          
          this.logger.warn(
            `⚠️ SECURITY: Rate limit excedido - ${method} ${originalUrl} - IP: ${ip} - User: ${userLabel}`,
          );
          
          this.winstonLogger.warn('Rate limit excedido', logData);
        } else if (statusCode === HttpStatus.BAD_REQUEST && originalUrl.includes('/auth')) {
          // Validación fallida en endpoints de autenticación - posible intento de abuso
          logData.securityEvent = 'validation_failed';
          logData.endpointType = 'authentication';
          
          this.logger.warn(
            `⚠️ SECURITY: Validación fallida en endpoint de auth - ${method} ${originalUrl} - IP: ${ip} - User: ${userLabel}`,
          );
          
          this.winstonLogger.warn('Validación fallida en endpoint de autenticación', logData);
        } else if (isSensitiveEndpoint) {
          // Acceso a endpoint sensible - registrar con contexto adicional
          logData.securityEvent = 'auth_attempt';
          logData.endpointType = originalUrl.includes('/auth') ? 'authentication' : 'webhook';
          
          if (statusCode >= 200 && statusCode < 300) {
            // Acceso exitoso
            this.winstonLogger.info('Acceso a endpoint sensible exitoso', logData);
          } else if (statusCode >= 400) {
            // Acceso fallido
            logData.securityEvent = 'auth_failed';
            this.winstonLogger.warn('Acceso a endpoint sensible fallido', logData);
          }
        } else {
          // Logging normal
          this.winstonLogger.info(`${method} ${originalUrl}`, logData);
        }
      }),
      catchError((error) => {
        const elapsed = Date.now() - startedAt;
        const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
        
        // Si es un error de rate limiting, ya fue manejado arriba
        // Solo loggear otros errores aquí
        if (statusCode !== HttpStatus.TOO_MANY_REQUESTS) {
          const errorLogData: Record<string, any> = {
            context: LoggingInterceptor.name,
            method,
            url: originalUrl,
            statusCode,
            responseTime: elapsed,
            userId: user?.id,
            userEmail: user?.email,
            ip,
            errorMessage: error.message,
            userAgent: headers['user-agent'],
          };

          // Si es un error de validación, marcarlo como evento de seguridad
          if (statusCode === HttpStatus.BAD_REQUEST && originalUrl.includes('/auth')) {
            errorLogData.securityEvent = 'validation_failed';
            this.winstonLogger.warn('Error de validación en endpoint de autenticación', errorLogData);
          } else {
            this.winstonLogger.error('Error en request', errorLogData);
          }
        }
        
        throw error;
      }),
    );
  }
}

