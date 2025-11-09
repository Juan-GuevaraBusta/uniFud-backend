import { NotFoundException } from '@nestjs/common';

export class ResourceNotFoundException extends NotFoundException {
  constructor(resource: string, criteria?: Record<string, unknown>) {
    super({
      message: `${resource} no encontrado`,
      errorCode: 'RESOURCE_NOT_FOUND',
      resource,
      criteria,
    });
  }
}
