import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { ThrottlerLimitDetail } from '@nestjs/throttler/dist/throttler.guard.interface';
import { Request } from 'express';

/**
 * Guard personalizado de Rate Limiting
 * 
 * Extiende ThrottlerGuard para proporcionar tracking dual:
 * - Por IP para usuarios no autenticados
 * - Por IP + user.id para usuarios autenticados (protección dual)
 * 
 * Esto previene que usuarios evadan límites cambiando IP o creando múltiples cuentas
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Obtener identificador único para tracking de rate limiting
   * 
   * Para usuarios autenticados: combina IP + user.id
   * Para usuarios no autenticados: solo IP
   * 
   * @param req - Request object de Express
   * @returns Identificador único para tracking
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const request = req as Request;
    
    // Obtener IP del request
    const ip = request.ip || 
               request.headers['x-forwarded-for']?.toString().split(',')[0] || 
               request.socket?.remoteAddress || 
               'unknown';
    
    // Obtener usuario si está autenticado
    const user = (request as any).user;
    
    // Para usuarios autenticados: combinar IP + user.id para protección dual
    if (user?.id) {
      return `user-${user.id}-ip-${ip}`;
    }
    
    // Para usuarios no autenticados: solo IP
    return `ip-${ip}`;
  }

  /**
   * Generar mensaje de error personalizado cuando se excede el límite
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new ThrottlerException('Demasiadas solicitudes. Por favor, intenta de nuevo más tarde.');
  }
}

