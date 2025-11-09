import { HttpException, HttpStatus } from '@nestjs/common';

interface BusinessExceptionPayload {
  message: string;
  errorCode: string;
  details?: Record<string, unknown>;
}

export class BusinessException extends HttpException {
  constructor(message: string, errorCode = 'BUSINESS_RULE_VIOLATION', details?: Record<string, unknown>) {
    const response: BusinessExceptionPayload = {
      message,
      errorCode,
    };

    if (details) {
      response.details = details;
    }

    super(response, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
