import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();

    if (!request) {
      return next.handle();
    }

    const { method, originalUrl } = request;
    const userLabel = request.user
      ? request.user.email ?? request.user.nombre ?? request.user.id
      : 'anonymous';
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - startedAt;
        this.logger.log(`${method} ${originalUrl} (${elapsed}ms) - user: ${userLabel}`);
      }),
    );
  }
}

