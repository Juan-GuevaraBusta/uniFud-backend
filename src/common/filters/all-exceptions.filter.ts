import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, Inject } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: WinstonLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let extra: Record<string, any> | undefined;

    // Manejar ThrottlerException (Rate Limiting)
    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      const res = exception.getResponse();
      
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const { message: msg, ...rest } = res as Record<string, any>;
        message = Array.isArray(msg) ? msg.join(', ') : msg ?? message;
        extra = rest;
      }

      // Extraer información de rate limit de los headers o del contexto
      // Los headers se setean automáticamente por ThrottlerGuard
      const rateLimitLimit = response.getHeader('x-ratelimit-limit');
      const rateLimitRemaining = response.getHeader('x-ratelimit-remaining');
      const rateLimitReset = response.getHeader('x-ratelimit-reset');

      // Si no están en los headers, calcularlos basándose en el error
      // En un escenario real, el ThrottlerGuard debería setear estos headers
      // Por ahora, los agregamos manualmente si no existen
      if (!rateLimitLimit) {
        response.setHeader('X-RateLimit-Limit', '100'); // Default
      }
      if (rateLimitRemaining !== undefined) {
        response.setHeader('X-RateLimit-Remaining', rateLimitRemaining.toString());
      } else {
        response.setHeader('X-RateLimit-Remaining', '0');
      }
      if (rateLimitReset) {
        response.setHeader('X-RateLimit-Reset', rateLimitReset.toString());
      } else {
        // Calcular reset time (aproximadamente, TTL desde ahora)
        const resetTime = Math.floor(Date.now() / 1000) + 60; // Default 60 segundos
        response.setHeader('X-RateLimit-Reset', resetTime.toString());
      }

      // Calcular segundos restantes para mensaje más descriptivo
      const resetTime = parseInt(response.getHeader('X-RateLimit-Reset') as string || '0', 10);
      const secondsUntilReset = Math.max(0, resetTime - Math.floor(Date.now() / 1000));
      message = `Demasiadas solicitudes. Por favor, intenta de nuevo en ${secondsUntilReset} segundo${secondsUntilReset !== 1 ? 's' : ''}.`;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const { message: msg, ...rest } = res as Record<string, any>;
        message = Array.isArray(msg) ? msg.join(', ') : msg ?? message;
        extra = rest;
      }
    } else if (exception instanceof Error) {
      message = exception.message ?? message;
    }

    const user = request?.user as any;
    const logContext = {
      context: AllExceptionsFilter.name,
      method: request?.method,
      url: request?.originalUrl ?? request?.url ?? '',
      statusCode: status,
      userId: user?.id,
      userEmail: user?.email,
      ...extra,
    };

    this.logger.error(
      `HTTP ${status} ${request?.method} ${request?.originalUrl ?? request?.url ?? ''} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    this.winstonLogger.error(message, {
      ...logContext,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(status).json({
      success: false,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.originalUrl ?? request?.url ?? '',
      ...(extra ?? {}),
    });
  }
}

