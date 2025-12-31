import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

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

    const { method, originalUrl, ip } = request;
    const user = request.user as any;
    const userLabel = user
      ? user.email ?? user.nombre ?? user.id
      : 'anonymous';
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - startedAt;
        const statusCode = response.statusCode;
        
        this.logger.log(`${method} ${originalUrl} ${statusCode} (${elapsed}ms) - user: ${userLabel}`);
        
        this.winstonLogger.info(`${method} ${originalUrl}`, {
          context: LoggingInterceptor.name,
          method,
          url: originalUrl,
          statusCode,
          responseTime: elapsed,
          userId: user?.id,
          userEmail: user?.email,
          ip,
        });
      }),
    );
  }
}

