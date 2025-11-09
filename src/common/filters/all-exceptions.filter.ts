import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let extra: Record<string, any> | undefined;

    if (exception instanceof HttpException) {
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

    this.logger.error(
      `HTTP ${status} ${request?.method} ${request?.originalUrl ?? request?.url ?? ''} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

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
