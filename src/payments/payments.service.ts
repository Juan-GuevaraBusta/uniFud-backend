import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WompiClient, WompiTransaction, WompiWebhookEvent } from './providers/wompi.client';
import { UserCardsService } from './user-cards.service';
import { UsersService } from '../users/users.service';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { BusinessException } from '../common/exceptions/business-exception';
import { ResourceNotFoundException } from '../common/exceptions/not-found-exception';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, SendNotificationDto } from '../notifications/dto/send-notification.dto';
import { Order } from '../orders/entities/order.entity';

export interface ProcessPaymentResult {
  transactionId: string;
  status: string;
  reference: string;
  amountInCents: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly wompiClient: WompiClient,
    private readonly userCardsService: UserCardsService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Mapear estado de Wompi (string) a PaymentStatus (enum)
   * @param wompiStatus Estado de la transacción de Wompi
   * @returns PaymentStatus correspondiente
   */
  private mapWompiStatusToPaymentStatus(wompiStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      APPROVED: PaymentStatus.APPROVED,
      DECLINED: PaymentStatus.DECLINED,
      PENDING: PaymentStatus.PENDING,
      VOIDED: PaymentStatus.VOIDED,
    };

    return statusMap[wompiStatus] || PaymentStatus.ERROR;
  }

  /**
   * Procesar pago de un pedido
   * Crea una transacción en Wompi usando el Payment Source del usuario
   * @param userId ID del usuario
   * @param amount Monto en pesos colombianos
   * @param paymentSourceId ID del Payment Source (opcional, si no se proporciona usa la tarjeta default)
   * @param orderId ID del pedido (para generar referencia única)
   */
  async processOrderPayment(
    userId: string,
    amount: number,
    paymentSourceId?: string,
    orderId?: string,
  ): Promise<ProcessPaymentResult> {
    this.logger.log(`Procesando pago para usuario ${userId}, monto: ${amount} COP`);

    // 1. Obtener usuario para email
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new ResourceNotFoundException('Usuario', { id: userId });
    }

    // 2. Obtener Payment Source
    let paymentSource;
    if (paymentSourceId) {
      try {
        const card = await this.userCardsService.getCardById(paymentSourceId, userId);
        paymentSource = card.wompiPaymentSourceId;
      } catch (error: any) {
        // Si la tarjeta no existe, lanzar ResourceNotFoundException
        throw new ResourceNotFoundException('Tarjeta', { id: paymentSourceId, userId });
      }
    } else {
      // Usar tarjeta default
      const defaultCard = await this.userCardsService.getDefaultCard(userId);
      if (!defaultCard) {
        throw new BusinessException(
          'No tienes una tarjeta configurada. Por favor, agrega una tarjeta primero.',
          'PAYMENT_NO_CARD',
          { userId },
        );
      }
      paymentSource = defaultCard.wompiPaymentSourceId;
    }

    // 3. Generar referencia única con formato UFD-XXX
    const reference = this.generatePaymentReference(orderId);

    // 4. Crear transacción en Wompi
    let transaction: WompiTransaction;
    try {
      transaction = await this.wompiClient.createTransaction(
        paymentSource,
        amount,
        reference,
        user.email,
      );
      this.logger.log(`✅ Transacción creada: ${transaction.id} - Status: ${transaction.status}`);
    } catch (error: any) {
      this.logger.error(`❌ Error creando transacción: ${error.message}`);
      // Error de Wompi → BusinessException con detalles
      throw new BusinessException(
        error.message || 'Error al procesar el pago con Wompi. Por favor, intenta nuevamente.',
        'PAYMENT_WOMPI_ERROR',
        {
          userId,
          paymentSourceId,
          amount,
          reference,
          wompiError: error.response?.data || error.message,
        },
      );
    }

    // 5. Guardar registro de pago en BD (orderId se actualizará después de crear el pedido)
    const payment = this.paymentRepository.create({
      userId,
      orderId: orderId || null,
      wompiTransactionId: transaction.id,
      reference,
      amountInCents: transaction.amount_in_cents,
      currency: transaction.currency,
      status: this.mapWompiStatusToPaymentStatus(transaction.status),
      paymentSourceId: paymentSource,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // 6. Validar que el pago fue aprobado
    if (payment.status !== PaymentStatus.APPROVED) {
      this.logger.warn(`⚠️ Transacción no aprobada: ${transaction.id} - Status: ${transaction.status}`);
      // Pago rechazado → BusinessException con código PAYMENT_DECLINED
      throw new BusinessException(
        transaction.status_message || 'El pago no pudo ser procesado. Por favor, verifica tu tarjeta.',
        'PAYMENT_DECLINED',
        {
          transactionId: transaction.id,
          status: transaction.status,
          statusMessage: transaction.status_message,
          reference,
          amountInCents: transaction.amount_in_cents,
        },
      );
    }

    return {
      transactionId: transaction.id,
      status: transaction.status,
      reference,
      amountInCents: transaction.amount_in_cents,
    };
  }

  /**
   * Manejar webhook de Wompi
   * Actualiza el estado de la transacción cuando Wompi notifica cambios
   */
  async handleWebhook(event: WompiWebhookEvent, signature: string): Promise<void> {
    this.logger.log(`Recibido webhook de Wompi: ${event.event.type} - Transaction: ${event.data.transaction.id}`);

    // 1. Verificar firma del webhook
    const isValid = this.wompiClient.verifyWebhookSignature(event, signature);
    if (!isValid) {
      this.logger.error('❌ Firma de webhook inválida');
      throw new BadRequestException('Firma de webhook inválida');
    }

    // 2. Buscar pago por transaction ID
    const transaction = event.data.transaction;
    const payment = await this.paymentRepository.findOne({
      where: { wompiTransactionId: transaction.id },
      relations: ['order'],
    });

    if (!payment) {
      this.logger.warn(`⚠️ Pago no encontrado para transacción: ${transaction.id}`);
      return;
    }

    // 3. Actualizar estado del pago y guardar webhook data
    payment.status = this.mapWompiStatusToPaymentStatus(transaction.status);
    if (transaction.finalized_at) {
      payment.finalizedAt = new Date(transaction.finalized_at);
    }
    payment.webhookData = event as any; // Guardar datos completos del webhook

    await this.paymentRepository.save(payment);

    this.logger.log(`✅ Estado de pago actualizado: ${payment.id} - Status: ${payment.status}`);

    // 4. Procesar según estado del pago
    if (payment.status === PaymentStatus.APPROVED) {
      await this.handleApprovedPayment(payment);
    } else if (payment.status === PaymentStatus.DECLINED) {
      await this.handleDeclinedPayment(payment);
    }
  }

  /**
   * Manejar pago aprobado
   * Actualizar Order si existe (útil para webhooks asíncronos)
   */
  private async handleApprovedPayment(payment: Payment): Promise<void> {
    try {
      if (!payment.orderId) {
        this.logger.log(`⚠️ Pago ${payment.id} aprobado pero no tiene orderId asociado`);
        return;
      }

      // Verificar que el Order existe (puede no existir si el webhook llega antes de crear el pedido)
      try {
        const order = await this.ordersService.findOne(payment.orderId);
        this.logger.log(`✅ Pago aprobado para pedido ${order.numeroOrden}`);
        // El Order ya se crea después del pago aprobado, así que no necesitamos actualizarlo
        // Esto es útil principalmente para webhooks asíncronos que llegan después
      } catch (error) {
        this.logger.warn(`⚠️ Order ${payment.orderId} no encontrado para pago aprobado ${payment.id}`);
      }
    } catch (error: any) {
      this.logger.error(`❌ Error procesando pago aprobado: ${error.message}`);
      // No lanzar error, solo loggear
    }
  }

  /**
   * Manejar pago rechazado
   * Loggear y notificar al usuario
   */
  private async handleDeclinedPayment(payment: Payment): Promise<void> {
    try {
      this.logger.warn(
        `⚠️ Pago rechazado: ${payment.id} - Transaction: ${payment.wompiTransactionId} - Reference: ${payment.reference}`,
      );

      // Obtener usuario para notificación
      const user = await this.usersService.findOne(payment.userId);
      if (!user) {
        this.logger.warn(`⚠️ Usuario ${payment.userId} no encontrado para notificación de pago rechazado`);
        return;
      }

      // Notificar al usuario (usar deliverNotification directamente ya que sendPushNotification requiere permisos)
      try {
        // Acceder al método privado deliverNotification para notificaciones automáticas
        await (this.notificationsService as any).deliverNotification(
          [user.email],
          '❌ Pago rechazado',
          `Tu pago con referencia ${payment.reference} fue rechazado. Por favor, verifica tu tarjeta e intenta nuevamente.`,
          NotificationType.PERSONALIZADA,
          {
            paymentId: payment.id,
            reference: payment.reference,
            amountInCents: payment.amountInCents,
            transactionId: payment.wompiTransactionId,
          },
        );
        this.logger.log(`✅ Notificación de pago rechazado enviada a usuario ${user.email}`);
      } catch (notificationError: any) {
        this.logger.error(`❌ Error enviando notificación de pago rechazado: ${notificationError.message}`);
        // No lanzar error, solo loggear
      }
    } catch (error: any) {
      this.logger.error(`❌ Error procesando pago rechazado: ${error.message}`);
      // No lanzar error, solo loggear
    }
  }

  /**
   * Generar referencia única con formato UFD-XXX
   * @param orderNumber Número de orden (formato #ABC-123) o ID del pedido (opcional)
   */
  private generatePaymentReference(orderNumber?: string): string {
    if (orderNumber) {
      // Si es un número de orden (formato #ABC-123), extraer la parte numérica
      if (orderNumber.startsWith('#')) {
        const match = orderNumber.match(/-(\d+)$/);
        if (match && match[1]) {
          return `UFD-${match[1]}`;
        }
      }
      // Si es un UUID, usar los últimos 6 caracteres numéricos
      const numericPart = orderNumber.replace(/-/g, '').replace(/[^0-9]/g, '').slice(-6);
      if (numericPart.length >= 3) {
        return `UFD-${numericPart}`;
      }
    }
    
    // Si no hay orderNumber o no se pudo extraer, usar timestamp
    const timestamp = Date.now().toString().slice(-6);
    return `UFD-${timestamp}`;
  }

  /**
   * Obtener pago por ID de transacción de Wompi
   */
  async getPaymentByTransactionId(transactionId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { wompiTransactionId: transactionId },
    });
  }

  /**
   * Actualizar orderId de un pago después de crear el pedido
   */
  async updatePaymentOrderId(transactionId: string, orderId: string): Promise<void> {
    await this.paymentRepository.update(
      { wompiTransactionId: transactionId },
      { orderId },
    );
  }
}

