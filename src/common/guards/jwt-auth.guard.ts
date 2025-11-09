import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Verificar si la ruta es pública
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Si no es pública, aplicar autenticación JWT
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Si hay un error o no hay usuario, lanzar excepción
    if (err || !user) {
      throw err || new UnauthorizedException('No estás autenticado. Por favor inicia sesión.');
    }
    return user;
  }
}




