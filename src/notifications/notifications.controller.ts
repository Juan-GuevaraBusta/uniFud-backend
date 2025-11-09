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
  @ApiResponse({ status: 201, description: 'Token registrado', type: NotificationTokenResponseDto })
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
  @ApiResponse({ status: 200, type: [NotificationTokenResponseDto] })
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
  @ApiParam({ name: 'id', description: 'ID del token' })
  @ApiResponse({ status: 200, type: NotificationTokenResponseDto })
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
  @ApiParam({ name: 'id', description: 'ID del token' })
  @ApiResponse({ status: 204, description: 'Token desactivado' })
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
  @ApiResponse({ status: 200, description: 'Cantidad de tokens desactivados', schema: { example: { deactivated: 2 } } })
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
        attempted: 3,
        sent: 2,
        failed: 1,
      },
    },
  })
  async sendNotification(@Body() dto: SendNotificationDto, @CurrentUser() user: any) {
    return await this.notificationsService.sendPushNotification(user.id, user.role, dto);
  }
}

