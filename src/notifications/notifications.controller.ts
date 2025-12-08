import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto, UpdateTokenDto } from './dto/register-token.dto';
import { NotificationTokenResponseDto } from './dto/notification-response.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Notificaciones')
@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Registrar o actualizar un token de notificación Expo
   */
  @Post('register')
  @Roles(UserRole.STUDENT, UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Registrar token de notificación',
    description: 'Registra o actualiza el token de Expo del dispositivo actual',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Token registrado', 
    type: NotificationTokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o validación fallida',
    schema: {
      example: {
        statusCode: 400,
        message: ['expoPushToken debe ser una cadena válida', 'deviceId es requerido'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      },
    },
  })
  async registerToken(@Body() dto: RegisterTokenDto, @CurrentUser() user: any) {
    return await this.notificationsService.registerToken(user.id, user.email, dto);
  }

  /**
   * Obtener los tokens del usuario actual
   */
  @Get('me')
  @Roles(UserRole.STUDENT, UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listado de tokens del usuario autenticado' })
  @ApiResponse({ 
    status: 200, 
    type: [NotificationTokenResponseDto],
    description: 'Lista de tokens del usuario',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      },
    },
  })
  async getMyTokens(@CurrentUser() user: any) {
    return await this.notificationsService.getUserTokens(user.id);
  }

  /**
   * Actualizar un token específico
   */
  @Patch(':id')
  @Roles(UserRole.STUDENT, UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar token de notificación' })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del token (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ 
    status: 200, 
    type: NotificationTokenResponseDto,
    description: 'Token actualizado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
    schema: {
      example: {
        statusCode: 400,
        message: ['configuraciones debe ser un objeto válido'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para actualizar este token',
    schema: {
      example: {
        statusCode: 403,
        message: 'No tienes permisos para actualizar este token',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Token no encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Token no encontrado',
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      },
    },
  })
  async updateToken(
    @Param('id') tokenId: string,
    @Body() dto: UpdateTokenDto,
    @CurrentUser() user: any,
  ) {
    return await this.notificationsService.updateToken(tokenId, user.id, dto);
  }

  /**
   * Desactivar un token
   */
  @Delete(':id')
  @Roles(UserRole.STUDENT, UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar token de notificación' })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del token (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ 
    status: 204, 
    description: 'Token desactivado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para desactivar este token',
    schema: {
      example: {
        statusCode: 403,
        message: 'No tienes permisos para desactivar este token',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Token no encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Token no encontrado',
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      },
    },
  })
  async deactivateToken(@Param('id') tokenId: string, @CurrentUser() user: any) {
    await this.notificationsService.deactivateToken(tokenId, user.id);
  }

  /**
   * Desactivar todos los tokens del usuario autenticado
   */
  @Delete()
  @Roles(UserRole.STUDENT, UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar todos los tokens del usuario' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cantidad de tokens desactivados', 
    schema: { 
      example: { 
        success: true,
        data: { deactivated: 2 },
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      },
    },
  })
  async deactivateAllTokens(@CurrentUser() user: any) {
    const count = await this.notificationsService.deactivateUserTokens(user.id);
    return { deactivated: count };
  }

  /**
   * Enviar notificaciones manualmente (admin o propietario)
   */
  @Post('send')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enviar notificaciones manuales',
    description: 'Solo para administrador o propietarios de restaurantes',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado del envío',
    schema: {
      example: {
        success: true,
        data: {
          attempted: 3,
          sent: 2,
          failed: 1,
        },
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o validación fallida',
    schema: {
      example: {
        statusCode: 400,
        message: ['title es requerido', 'body es requerido'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para enviar notificaciones',
    schema: {
      example: {
        statusCode: 403,
        message: 'Solo administradores y propietarios pueden enviar notificaciones',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor o error al enviar notificaciones',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error al enviar notificaciones',
        error: 'Internal Server Error',
      },
    },
  })
  async sendNotification(@Body() dto: SendNotificationDto, @CurrentUser() user: any) {
    return await this.notificationsService.sendPushNotification(user.id, user.role, dto);
  }
}


