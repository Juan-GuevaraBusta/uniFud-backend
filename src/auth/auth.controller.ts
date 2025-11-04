import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Registro de nuevo usuario
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Registrar nuevo usuario',
    description: 'Crea un nuevo usuario en el sistema y envía un código de verificación al email'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Usuario registrado exitosamente',
    schema: {
      example: {
        message: 'Usuario registrado exitosamente. Por favor verifica tu email.',
        userId: '123e4567-e89b-12d3-a456-426614174000'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login de usuario
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Iniciar sesión',
    description: 'Autentica un usuario y retorna tokens JWT'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login exitoso',
    type: AuthResponseDto
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas o email no verificado' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  /**
   * Confirmación de email
   */
  @Public()
  @Post('confirm-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Confirmar email',
    description: 'Verifica el email del usuario mediante el código de verificación'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Email verificado exitosamente',
    schema: {
      example: {
        message: 'Email verificado exitosamente. Ya puedes iniciar sesión.'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Código inválido o expirado' })
  async confirmEmail(@Body() confirmEmailDto: ConfirmEmailDto) {
    return this.authService.confirmEmail(confirmEmailDto);
  }

  /**
   * Reenvío de código de verificación
   */
  @Public()
  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Reenviar código de verificación',
    description: 'Envía un nuevo código de verificación al email del usuario'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          example: 'juan.perez@universidadean.edu.co'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Código reenviado exitosamente',
    schema: {
      example: {
        message: 'Código de verificación reenviado exitosamente'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Usuario no encontrado o email ya verificado' })
  async resendCode(@Body('email') email: string) {
    return this.authService.resendVerificationCode(email);
  }

  /**
   * Refrescar access token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Refrescar token',
    description: 'Genera un nuevo access token usando el refresh token'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token refrescado exitosamente',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 1699123456789
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  /**
   * Obtener perfil del usuario autenticado
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Obtener perfil',
    description: 'Retorna la información del usuario autenticado'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Perfil del usuario',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'juan.perez@universidadean.edu.co',
        nombre: 'Juan Pérez',
        role: 'student',
        emailVerified: true
      }
    }
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  /**
   * Logout (invalidar tokens - por implementar)
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Cerrar sesión',
    description: 'Invalida los tokens del usuario (por implementar con Redis)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Logout exitoso',
    schema: {
      example: {
        message: 'Sesión cerrada exitosamente'
      }
    }
  })
  async logout(@CurrentUser() user: any) {
    // TODO: Implementar invalidación de tokens con Redis o blacklist
    // Por ahora, el logout se maneja en el cliente eliminando los tokens
    return {
      message: 'Sesión cerrada exitosamente. Elimina los tokens del lado del cliente.',
    };
  }
}

