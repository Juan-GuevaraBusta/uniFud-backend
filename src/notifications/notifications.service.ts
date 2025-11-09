import { Injectable, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NotificationToken, NotificationPlatform } from './entities/notification-token.entity';
import { RegisterTokenDto, UpdateTokenDto, NotificationPreferences } from './dto/register-token.dto';
import { NotificationTokenResponseDto } from './dto/notification-response.dto';
import { SendNotificationDto, NotificationType } from './dto/send-notification.dto';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { UserRole } from '../users/entities/user.entity';

interface ExpoPushResult {
  status: 'ok' | 'error';
  details?: Record<string, any>;
  message?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationToken)
    private readonly tokenRepository: Repository<NotificationToken>,
  ) {}

  private readonly DEFAULT_CONFIG: NotificationPreferences = {
    pedidosNuevos: true,
    cambiosEstado: true,
    promociones: true,
  };

  /**
   * Registrar o actualizar un token de notificación para el usuario autenticado
   */
  async registerToken(
    userId: string,
    userEmail: string,
    dto: RegisterTokenDto,
  ): Promise<NotificationTokenResponseDto> {
    const userDevice = `${userEmail.toLowerCase()}#${dto.deviceId}`;
    const configuraciones = this.mergePreferences(dto.configuraciones);

    let token = await this.tokenRepository.findOne({
      where: { userDevice },
    });

    const basePayload = {
      userId,
      userEmail: userEmail.toLowerCase(),
      expoPushToken: dto.expoPushToken,
      deviceId: dto.deviceId,
      platform: dto.platform,
      deviceInfo: dto.deviceInfo ?? null,
      configuraciones,
      activo: true,
      userDevice,
    };

    if (token) {
      token = this.tokenRepository.merge(token, {
        ...basePayload,
        lastUsedAt: new Date(),
      });
    } else {
      token = this.tokenRepository.create({
        ...basePayload,
      });
    }

    const saved = await this.tokenRepository.save(token);
    return this.toResponse(saved);
  }

  /**
   * Actualizar configuraciones de un token
   */
  async updateToken(
    tokenId: string,
    userId: string,
    dto: UpdateTokenDto,
  ): Promise<NotificationTokenResponseDto> {
    const token = await this.tokenRepository.findOne({ where: { id: tokenId } });

    if (!token || token.userId !== userId) {
      throw new NotFoundException('Token de notificación no encontrado');
    }

    if (dto.configuraciones) {
      token.configuraciones = this.mergePreferences(dto.configuraciones, token.configuraciones);
    }

    if (dto.activo !== undefined) {
      token.activo = dto.activo;
    }

    token.lastUsedAt = new Date();
    const saved = await this.tokenRepository.save(token);
    return this.toResponse(saved);
  }

  /**
   * Desactivar un token específico
   */
  async deactivateToken(tokenId: string, userId: string): Promise<void> {
    const token = await this.tokenRepository.findOne({ where: { id: tokenId } });

    if (!token || token.userId !== userId) {
      throw new NotFoundException('Token de notificación no encontrado');
    }

    token.activo = false;
    token.lastUsedAt = new Date();
    await this.tokenRepository.save(token);
  }

  /**
   * Desactivar todos los tokens del usuario (logout)
   */
  async deactivateUserTokens(userId: string): Promise<number> {
    const result = await this.tokenRepository.update(
      { userId },
      { activo: false, lastUsedAt: new Date() },
    );

    return result.affected ?? 0;
  }

  /**
   * Obtener los tokens activos del usuario
   */
  async getUserTokens(userId: string): Promise<NotificationTokenResponseDto[]> {
    const tokens = await this.tokenRepository.find({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
    });

    return tokens.map((token) => this.toResponse(token));
  }

  /**
   * Enviar notificaciones push manualmente (admin / restaurante)
   */
  async sendPushNotification(
    senderId: string,
    senderRole: string,
    dto: SendNotificationDto,
  ): Promise<{ attempted: number; sent: number; failed: number }> {
    if (senderRole === UserRole.STUDENT) {
      throw new ForbiddenException('No tienes permisos para enviar notificaciones');
    }

    const { attempted, sent, failed } = await this.deliverNotification(
      dto.recipients,
      dto.title,
      dto.body,
      dto.type,
      dto.data,
    );

    if (attempted === 0) {
      throw new NotFoundException('No se encontraron tokens activos para los destinatarios');
    }

    return { attempted, sent, failed };
  }

  /**
   * Obtener tokens activos por email (utilizado por otros servicios)
   */
  async getActiveTokensByEmail(email: string): Promise<NotificationToken[]> {
    return await this.tokenRepository.find({
      where: {
        userEmail: email.toLowerCase(),
        activo: true,
      },
    });
  }

  // ==================== Helpers ====================

  private mergePreferences(
    incoming?: NotificationPreferences,
    current?: Record<string, any>,
  ): NotificationPreferences {
    return {
      ...this.DEFAULT_CONFIG,
      ...(current ?? {}),
      ...(incoming ?? {}),
    };
  }

  private toResponse(token: NotificationToken): NotificationTokenResponseDto {
    return {
      id: token.id,
      userId: token.userId,
      userEmail: token.userEmail,
      expoPushToken: token.expoPushToken,
      deviceId: token.deviceId,
      platform: token.platform,
      deviceInfo: token.deviceInfo ?? null,
      configuraciones: token.configuraciones ?? this.DEFAULT_CONFIG,
      activo: token.activo,
      userDevice: token.userDevice,
      registeredAt: token.registeredAt,
      lastUsedAt: token.lastUsedAt,
    };
  }

  private async callExpoPushApi(messages: any[]): Promise<ExpoPushResult[]> {
    try {
      const chunkSize = 50;
      const results: ExpoPushResult[] = [];

      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new InternalServerErrorException(
            `Expo Push Service respondió con código ${response.status}: ${text}`,
          );
        }

        const json = (await response.json()) as { data: ExpoPushResult[] };
        results.push(...(json?.data ?? []));
      }

      return results;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error enviando notificaciones push: ${(error as Error).message}`,
      );
    }
  }

  private async deliverNotification(
    recipients: string[],
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, any>,
  ): Promise<{ attempted: number; sent: number; failed: number }> {
    const normalizedRecipients = recipients.map((recipient) => recipient.toLowerCase());

    const tokens = await this.tokenRepository.find({
      where: {
        userEmail: In(normalizedRecipients),
        activo: true,
      },
      order: { lastUsedAt: 'DESC' },
    });

    if (tokens.length === 0) {
      return { attempted: 0, sent: 0, failed: 0 };
    }

    const messages = tokens.map((token) => ({
      to: token.expoPushToken,
      sound: 'default',
      title,
      body,
      data: {
        type,
        ...data,
      },
      channelId: 'default',
      priority: 'high',
    }));

    const response = await this.callExpoPushApi(messages);

    const sent = response.filter((result) => result.status === 'ok').length;
    const failed = response.length - sent;

    return {
      attempted: response.length,
      sent,
      failed,
    };
  }

  // ==================== Notificaciones automáticas ====================

  async notifyNewOrder(order: Order) {
    const ownerEmail = order.restaurant?.owner?.email;

    if (!ownerEmail) {
      return;
    }

    await this.deliverNotification(
      [ownerEmail],
      '🍽️ Nuevo pedido recibido',
      `Pedido ${order.numeroOrden} por $${this.formatCurrency(order.total)}.`,
      NotificationType.NUEVO_PEDIDO,
      {
        pedidoId: order.id,
        numeroOrden: order.numeroOrden,
        restaurantId: order.restaurantId,
      },
    );
  }

  async notifyOrderStatusChange(order: Order) {
    const userEmail = order.user?.email;
    if (!userEmail) {
      return;
    }

    const { title, body, type } = this.composeStatusNotification(order);

    await this.deliverNotification(
      [userEmail],
      title,
      body,
      type,
      {
        pedidoId: order.id,
        numeroOrden: order.numeroOrden,
        restaurantId: order.restaurantId,
        status: order.status,
      },
    );
  }

  async notifyOrderCancelled(order: Order, actorRole: string) {
    const recipients = new Set<string>();

    if (order.user?.email) {
      recipients.add(order.user.email);
    }

    const ownerEmail = order.restaurant?.owner?.email;

    if (ownerEmail && actorRole !== UserRole.STUDENT) {
      recipients.add(ownerEmail);
    }

    if (recipients.size === 0) {
      return;
    }

    await this.deliverNotification(
      Array.from(recipients),
      '❌ Pedido cancelado',
      `El pedido ${order.numeroOrden} fue cancelado${order.motivoCancelacion ? `: ${order.motivoCancelacion}` : ''}.`,
      NotificationType.PEDIDO_RECHAZADO,
      {
        pedidoId: order.id,
        numeroOrden: order.numeroOrden,
        restaurantId: order.restaurantId,
        status: order.status,
      },
    );
  }

  private composeStatusNotification(order: Order): {
    title: string;
    body: string;
    type: NotificationType;
  } {
    switch (order.status) {
      case OrderStatus.ACEPTADO:
        return {
          title: '✅ Pedido aceptado',
          body: `Tu pedido ${order.numeroOrden} ha sido aceptado. Tiempo estimado: ${order.tiempoEstimado ?? 20} minutos.`,
          type: NotificationType.PEDIDO_ACEPTADO,
        };
      case OrderStatus.PREPARANDO:
        return {
          title: '👩‍🍳 Pedido en preparación',
          body: `Estamos preparando tu pedido ${order.numeroOrden}.`,
          type: NotificationType.PEDIDO_ACEPTADO,
        };
      case OrderStatus.LISTO:
        return {
          title: '🎉 ¡Pedido listo!',
          body: `Tu pedido ${order.numeroOrden} está listo para recoger.`,
          type: NotificationType.PEDIDO_LISTO,
        };
      case OrderStatus.ENTREGADO:
        return {
          title: '📦 Pedido entregado',
          body: `Tu pedido ${order.numeroOrden} ha sido entregado. ¡Disfrútalo!`,
          type: NotificationType.PEDIDO_ENTREGADO,
        };
      default:
        return {
          title: 'Actualización de pedido',
          body: `El estado de tu pedido ${order.numeroOrden} cambió a ${order.status}.`,
          type: NotificationType.PERSONALIZADA,
        };
    }
  }

  private formatCurrency(cents: number): string {
    return (cents / 100).toLocaleString('es-CO', {
      minimumFractionDigits: 0,
    });
  }
}
