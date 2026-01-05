import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { DishesService } from '../dishes/dishes.service';
import { OrderItemDto } from './dto/order-item.dto';
import { UserRole } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { BusinessException } from '../common/exceptions/business-exception';
import { ForbiddenAccessException } from '../common/exceptions/unauthorized-exception';
import { ResourceNotFoundException } from '../common/exceptions/not-found-exception';
import { OrdersGateway } from './orders.gateway';
import { OrderHistoryQueryDto, OrderHistoryOrderBy, OrderDirection } from './dto/order-history-query.dto';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly restaurantsService: RestaurantsService,
    private readonly dishesService: DishesService,
    private readonly notificationsService: NotificationsService,
    private readonly ordersGateway: OrdersGateway,
    private readonly paymentsService: PaymentsService,
  ) {}

  private readonly statusTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDIENTE]: [OrderStatus.ACEPTADO],
    [OrderStatus.ACEPTADO]: [OrderStatus.PREPARANDO],
    [OrderStatus.PREPARANDO]: [OrderStatus.LISTO],
    [OrderStatus.LISTO]: [OrderStatus.ENTREGADO],
    [OrderStatus.ENTREGADO]: [],
    [OrderStatus.CANCELADO]: [],
  };

  /**
   * Crear un nuevo pedido
   * Flujo completo:
   * 1. Validar restaurante
   * 2. Validar disponibilidad
   * 3. Calcular totales
   * 4. PROCESAR PAGO CON WOMPI (antes de crear pedido)
   * 5. Crear pedido (solo si pago exitoso)
   * 6. Guardar relación Payment → Order
   * 7. Notificar restaurante
   */
  async create(createOrderDto: CreateOrderDto, userId: string): Promise<Order> {
    // 1. Validar restaurante
    const restaurant = await this.restaurantsService.findOne(createOrderDto.restaurantId);
    
    if (!restaurant.activo) {
      throw new BusinessException('El restaurante no está activo en este momento', 'RESTAURANT_INACTIVE', {
        restaurantId: restaurant.id,
      });
    }

    // 1.1 Verificar que no haya pedidos pendientes duplicados
    const pendingOrder = await this.orderRepository.findOne({
      where: {
        userId,
        restaurantId: createOrderDto.restaurantId,
        status: OrderStatus.PENDIENTE,
      },
    });

    if (pendingOrder) {
      throw new BusinessException(
        'Ya tienes un pedido pendiente en este restaurante. Espera a que sea procesado.',
        'ORDER_ALREADY_PENDING',
        {
          orderId: pendingOrder.id,
          restaurantId: createOrderDto.restaurantId,
        },
      );
    }

    // 2. Validar disponibilidad de cada plato
    for (const item of createOrderDto.items) {
      const isAvailable = await this.dishesService.checkAvailability(
        item.dishId,
        createOrderDto.restaurantId,
      );

      if (!isAvailable) {
        throw new BusinessException(
          `El plato "${item.dishNombre}" no está disponible en este momento`,
          'DISH_NOT_AVAILABLE',
          {
            dishId: item.dishId,
            restaurantId: createOrderDto.restaurantId,
          },
        );
      }

      // Verificar que el plato existe y pertenece al restaurante
      const dish = await this.dishesService.findOne(item.dishId);
      
      if (dish.restaurantId !== createOrderDto.restaurantId) {
        throw new BusinessException(
          `El plato "${item.dishNombre}" no pertenece a este restaurante`,
          'DISH_RESTAURANT_MISMATCH',
          {
            dishId: item.dishId,
            restaurantId: createOrderDto.restaurantId,
          },
        );
      }

      if (!dish.activo) {
        throw new BusinessException(
          `El plato "${item.dishNombre}" no está activo`,
          'DISH_INACTIVE',
          {
            dishId: item.dishId,
          },
        );
      }
    }

    // 3. Calcular totales
    const { subtotal, tarifaServicio, total } = this.calculateTotals(createOrderDto.items);

    // Generar número de orden único (temporal para referencia de pago)
    const numeroOrden = await this.generateOrderNumber();

    // 4. PROCESAR PAGO CON WOMPI (antes de crear el pedido)
    // - Obtener tarjeta del usuario (default o especificada en paymentSourceId)
    // - Crear transacción en Wompi
    // - Si pago falla → lanzar excepción (NO crear pedido)
    // - Si pago exitoso → continuar
    const totalInPesos = total / 100;
    
    let paymentResult;
    try {
      paymentResult = await this.paymentsService.processOrderPayment(
        userId,
        totalInPesos,
        createOrderDto.paymentSourceId, // Si no se proporciona, usa la tarjeta default
        numeroOrden, // Usar número de orden como referencia temporal
      );
      this.logger.log(`✅ Pago procesado exitosamente: ${paymentResult.transactionId}`);
    } catch (error: any) {
      this.logger.error(`❌ Error procesando pago: ${error.message}`);
      // Si el pago falla, NO crear el pedido
      throw new BusinessException(
        error.message || 'El pago no pudo ser procesado. El pedido no fue creado.',
        'PAYMENT_FAILED',
        {
          userId,
          restaurantId: createOrderDto.restaurantId,
          total,
        },
      );
    }

    // 5. Crear pedido (solo si el pago fue exitoso)
    const order = this.orderRepository.create({
      ...createOrderDto,
      userId,
      numeroOrden,
      subtotal,
      tarifaServicio,
      total,
      status: OrderStatus.PENDIENTE,
    });

    // Guardar y retornar con relaciones
    const savedOrder = await this.orderRepository.save(order);
    const fullOrder = await this.findOne(savedOrder.id);

    // 6. Guardar relación Payment → Order
    try {
      await this.paymentsService.updatePaymentOrderId(paymentResult.transactionId, savedOrder.id);
    } catch (error) {
      this.logger.error(`Error al actualizar orderId en payment: ${error}`);
      // No fallar el pedido si esto falla, ya está creado
    }

    // 7. Notificar restaurante (solo si todo exitoso)
    // Notificar vía push notification (no bloquea si falla)
    try {
      await this.notificationsService.notifyNewOrder(fullOrder);
    } catch (error) {
      this.logger.error(`Error al enviar notificación push para pedido ${fullOrder.id}:`, error);
    }

    // 10. Notificar vía WebSocket (no bloquea si falla)
    try {
      this.ordersGateway.notifyNewOrder(fullOrder);
    } catch (error) {
      this.logger.error(`Error al emitir evento WebSocket para nuevo pedido ${fullOrder.id}:`, error);
    }

    return fullOrder;
  }

  /**
   * Generar número de orden único
   * Formato: #ABC-123
   */
  private async generateOrderNumber(): Promise<string> {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-3);
    const random = Math.random().toString(36).toUpperCase().slice(-3);
    const numeroOrden = `#${timestamp}-${random}`;

    // Verificar que no exista (muy improbable pero por seguridad)
    const existing = await this.orderRepository.findOne({
      where: { numeroOrden },
    });

    if (existing) {
      // Recursión si por casualidad existe (extremadamente raro)
      return this.generateOrderNumber();
    }

    return numeroOrden;
  }

  /**
   * Calcular totales del pedido
   */
  private calculateTotals(items: OrderItemDto[]): {
    subtotal: number;
    tarifaServicio: number;
    total: number;
  } {
    // Calcular subtotal sumando todos los items
    const subtotal = items.reduce((sum, item) => sum + item.precioTotal, 0);

    // Tarifa de servicio (5%)
    const tarifaServicio = Math.round(subtotal * 0.05);

    // Total
    const total = subtotal + tarifaServicio;

    return { subtotal, tarifaServicio, total };
  }

  /**
   * Obtener todos los pedidos con filtros opcionales
   */
  async findAll(
    filters?: {
      status?: OrderStatus;
      restaurantId?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    pagination?: PaginationDto,
  ): Promise<PaginatedResponse<Order>> {
    const query = this.orderRepository.createQueryBuilder('order');

    if (filters?.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }

    if (filters?.restaurantId) {
      query.andWhere('order.restaurantId = :restaurantId', {
        restaurantId: filters.restaurantId,
      });
    }

    if (filters?.userId) {
      query.andWhere('order.userId = :userId', { userId: filters.userId });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('order.fechaPedido BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    query
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.restaurant', 'restaurant')
      .orderBy('order.fechaPedido', 'DESC');

    if (pagination) {
      query.skip(pagination.skip).take(pagination.take);
    }

    const [items, total] = await query.getManyAndCount();

    return this.buildPaginatedResponse(items, total, pagination);
  }

  /**
   * Obtener un pedido por ID
   */
  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'restaurant'],
    });

    if (!order) {
      throw new ResourceNotFoundException('Pedido', { id });
    }

    return order;
  }

  /**
   * Obtener pedidos de un usuario
   */
  async findByUser(userId: string, pagination?: PaginationDto): Promise<PaginatedResponse<Order>> {
    const [items, total] = await this.orderRepository.findAndCount({
      where: { userId },
      relations: ['restaurant'],
      order: {
        fechaPedido: 'DESC',
      },
      skip: pagination ? pagination.skip : undefined,
      take: pagination ? pagination.take : undefined,
    });

    return this.buildPaginatedResponse(items, total, pagination);
  }

  /**
   * Obtener pedidos de un restaurante
   */
  async findByRestaurant(
    restaurantId: string,
    status?: OrderStatus,
    actorId?: string,
    actorRole?: string,
    pagination?: PaginationDto,
  ): Promise<PaginatedResponse<Order>> {
    if (actorRole && actorRole !== UserRole.ADMIN) {
      const restaurant = await this.restaurantsService.findOne(restaurantId);

      if (restaurant.ownerId !== actorId) {
        throw new ForbiddenAccessException('No tienes permisos para ver los pedidos de este restaurante', 'RESTAURANT_ORDERS_FORBIDDEN');
      }
    }

    const where: any = { restaurantId };
    
    if (status) {
      where.status = status;
    }

    const [items, total] = await this.orderRepository.findAndCount({
      where,
      relations: ['user'],
      order: {
        fechaPedido: 'ASC', // Más antiguos primero para que vean lo urgente
      },
      skip: pagination ? pagination.skip : undefined,
      take: pagination ? pagination.take : undefined,
    });

    return this.buildPaginatedResponse(items, total, pagination);
  }

  /**
   * Obtener estadísticas de pedidos de un restaurante
   */
  async getRestaurantStats(restaurantId: string): Promise<{
    total: number;
    pendientes: number;
    enPreparacion: number;
    completados: number;
  }> {
    const all = await this.orderRepository.find({
      where: { restaurantId },
    });

    return {
      total: all.length,
      pendientes: all.filter(o => o.status === OrderStatus.PENDIENTE).length,
      enPreparacion: all.filter(o => 
        o.status === OrderStatus.ACEPTADO || o.status === OrderStatus.PREPARANDO
      ).length,
      completados: all.filter(o => o.status === OrderStatus.ENTREGADO).length,
    };
  }

  /**
   * Actualizar el estado de un pedido
   */
  async updateStatus(
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
    actorId: string,
    actorRole: string,
  ): Promise<Order> {
    if (updateStatusDto.status === OrderStatus.CANCELADO) {
      throw new BusinessException('Para cancelar un pedido utiliza el endpoint de cancelación', 'ORDER_STATUS_USE_CANCEL_ENDPOINT');
    }

    const order = await this.findOne(orderId);
    const restaurant = await this.restaurantsService.findOne(order.restaurantId);

    if (actorRole !== UserRole.ADMIN && restaurant.ownerId !== actorId) {
      throw new ForbiddenAccessException('No tienes permisos para actualizar el estado de este pedido', 'ORDER_STATUS_FORBIDDEN');
    }

    if (order.status === OrderStatus.CANCELADO) {
      throw new BusinessException('El pedido está cancelado y no puede cambiar de estado', 'ORDER_STATUS_ALREADY_CANCELLED');
    }

    if (order.status === OrderStatus.ENTREGADO) {
      throw new BusinessException('El pedido ya fue entregado', 'ORDER_STATUS_ALREADY_DELIVERED');
    }

    const allowedTransitions = this.statusTransitions[order.status] ?? [];

    if (!allowedTransitions.includes(updateStatusDto.status)) {
      throw new BusinessException(
        `Transición inválida: no se puede cambiar de ${order.status} a ${updateStatusDto.status}`,
        'ORDER_STATUS_TRANSITION_INVALID',
        {
          currentStatus: order.status,
          requestedStatus: updateStatusDto.status,
        },
      );
    }

    switch (updateStatusDto.status) {
      case OrderStatus.ACEPTADO: {
        if (!updateStatusDto.tiempoEstimado) {
          throw new BusinessException('Debes proporcionar un tiempo estimado en minutos', 'ORDER_ESTIMATE_REQUIRED');
        }

        order.fechaAceptado = new Date();
        order.tiempoEstimado = updateStatusDto.tiempoEstimado;
        break;
      }

      case OrderStatus.PREPARANDO: {
        if (order.status !== OrderStatus.ACEPTADO) {
          throw new BusinessException('El pedido debe haber sido aceptado antes de prepararse', 'ORDER_PREPARE_SEQUENCE');
        }
        break;
      }

      case OrderStatus.LISTO: {
        order.fechaListo = new Date();
        break;
      }

      case OrderStatus.ENTREGADO: {
        order.fechaEntregado = new Date();
        break;
      }

      default:
        break;
    }

    order.status = updateStatusDto.status;

    if (updateStatusDto.comentarios) {
      order.comentariosRestaurante = updateStatusDto.comentarios;
    }

    // El tiempo estimado solo es relevante cuando el pedido está aceptado
    if (updateStatusDto.status !== OrderStatus.ACEPTADO) {
      order.tiempoEstimado = order.tiempoEstimado ?? null;
    }

    const saved = await this.orderRepository.save(order);
    const fullOrder = await this.findOne(saved.id);

    // Notificar vía push notification (no bloquea si falla)
    try {
      await this.notificationsService.notifyOrderStatusChange(fullOrder);
    } catch (error) {
      this.logger.error(`Error al enviar notificación push para cambio de estado del pedido ${fullOrder.id}:`, error);
    }

    // Notificar vía WebSocket (no bloquea si falla)
    try {
      this.ordersGateway.notifyStatusChange(fullOrder);
    } catch (error) {
      this.logger.error(`Error al emitir evento WebSocket para cambio de estado del pedido ${fullOrder.id}:`, error);
    }

    return fullOrder;
  }

  /**
   * Cancelar un pedido
   */
  async cancel(
    orderId: string,
    actorId: string,
    actorRole: string,
    motivo: string,
    comentariosRestaurante?: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.status === OrderStatus.CANCELADO) {
      throw new BusinessException('El pedido ya está cancelado', 'ORDER_ALREADY_CANCELLED');
    }

    if (order.status === OrderStatus.ENTREGADO) {
      throw new BusinessException('No puedes cancelar un pedido que ya fue entregado', 'ORDER_CANCEL_DELIVERED');
    }

    const motivoLimpio = motivo?.trim();

    if (!motivoLimpio) {
      throw new BusinessException('Debes proporcionar un motivo de cancelación', 'ORDER_CANCEL_REASON_REQUIRED');
    }

    if (actorRole === UserRole.STUDENT) {
      if (order.userId !== actorId) {
        throw new ForbiddenAccessException('No puedes cancelar pedidos de otros usuarios', 'ORDER_CANCEL_FORBIDDEN');
      }

      if (order.status !== OrderStatus.PENDIENTE) {
        throw new BusinessException('Solo puedes cancelar pedidos pendientes', 'ORDER_CANCEL_INVALID_STATUS');
      }
    } else if (actorRole === UserRole.RESTAURANT_OWNER) {
      const restaurant = await this.restaurantsService.findOne(order.restaurantId);

      if (restaurant.ownerId !== actorId) {
        throw new ForbiddenAccessException('No puedes cancelar pedidos de otros restaurantes', 'ORDER_CANCEL_FORBIDDEN');
      }
    } else if (actorRole !== UserRole.ADMIN) {
      throw new ForbiddenAccessException('No tienes permisos para cancelar pedidos', 'ORDER_CANCEL_FORBIDDEN');
    }

    order.status = OrderStatus.CANCELADO;
    order.motivoCancelacion = motivoLimpio;

    if (actorRole !== UserRole.STUDENT && comentariosRestaurante) {
      order.comentariosRestaurante = comentariosRestaurante.trim();
    }

    order.tiempoEstimado = null;

    const saved = await this.orderRepository.save(order);
    const fullOrder = await this.findOne(saved.id);

    // Notificar vía push notification (no bloquea si falla)
    try {
      await this.notificationsService.notifyOrderCancelled(fullOrder, actorRole);
    } catch (error) {
      this.logger.error(`Error al enviar notificación push para cancelación del pedido ${fullOrder.id}:`, error);
    }

    // Notificar vía WebSocket (no bloquea si falla)
    try {
      this.ordersGateway.notifyStatusChange(fullOrder);
    } catch (error) {
      this.logger.error(`Error al emitir evento WebSocket para cancelación del pedido ${fullOrder.id}:`, error);
    }

    return fullOrder;
  }

  /**
   * Obtener historial de pedidos con filtros avanzados
   * @param userId - ID del usuario (obligatorio)
   * @param filters - Filtros de búsqueda (fechas, status, ordenamiento)
   * @param pagination - Parámetros de paginación
   * @returns Historial de pedidos paginado
   */
  async getHistory(
    userId: string,
    filters: OrderHistoryQueryDto,
    pagination?: PaginationDto,
  ): Promise<PaginatedResponse<Order>> {
    const query = this.orderRepository.createQueryBuilder('order');

    // Filtro obligatorio por usuario
    query.andWhere('order.userId = :userId', { userId });

    // Aplicar filtros comunes
    this.applyHistoryFilters(query, filters);

    // Incluir relaciones
    query
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.restaurant', 'restaurant');

    // Aplicar ordenamiento
    this.applyHistoryOrdering(query, filters);

    // Aplicar paginación
    if (pagination) {
      query.skip(pagination.skip).take(pagination.take);
    }

    const [items, total] = await query.getManyAndCount();

    return this.buildPaginatedResponse(items, total, pagination);
  }

  /**
   * Obtener historial de pedidos de un restaurante con filtros avanzados
   * @param restaurantId - ID del restaurante (obligatorio)
   * @param actorId - ID del usuario que hace la consulta (para validar permisos)
   * @param actorRole - Rol del usuario que hace la consulta
   * @param filters - Filtros de búsqueda (fechas, status, ordenamiento)
   * @param pagination - Parámetros de paginación
   * @returns Historial de pedidos del restaurante paginado
   */
  async getRestaurantHistory(
    restaurantId: string,
    actorId: string,
    actorRole: string,
    filters: OrderHistoryQueryDto,
    pagination?: PaginationDto,
  ): Promise<PaginatedResponse<Order>> {
    // Validar permisos
    if (actorRole !== UserRole.ADMIN) {
      const restaurant = await this.restaurantsService.findOne(restaurantId);
      if (restaurant.ownerId !== actorId) {
        throw new ForbiddenAccessException(
          'No tienes permisos para ver el historial de pedidos de este restaurante',
          'RESTAURANT_HISTORY_FORBIDDEN',
        );
      }
    }

    const query = this.orderRepository.createQueryBuilder('order');

    // Filtro obligatorio por restaurante
    query.andWhere('order.restaurantId = :restaurantId', { restaurantId });

    // Aplicar filtros comunes
    this.applyHistoryFilters(query, filters);

    // Incluir relaciones
    query
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.restaurant', 'restaurant');

    // Aplicar ordenamiento
    this.applyHistoryOrdering(query, filters);

    // Aplicar paginación
    if (pagination) {
      query.skip(pagination.skip).take(pagination.take);
    }

    const [items, total] = await query.getManyAndCount();

    return this.buildPaginatedResponse(items, total, pagination);
  }

  /**
   * Aplicar filtros comunes al query builder del historial
   */
  private applyHistoryFilters(query: any, filters: OrderHistoryQueryDto): void {
    // Filtro opcional por estado
    if (filters.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }

    // Filtro opcional por rango de fechas
    if (filters.startDate && filters.endDate) {
      query.andWhere('order.fechaPedido BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters.startDate) {
      query.andWhere('order.fechaPedido >= :startDate', {
        startDate: filters.startDate,
      });
    } else if (filters.endDate) {
      query.andWhere('order.fechaPedido <= :endDate', {
        endDate: filters.endDate,
      });
    }
  }

  /**
   * Aplicar ordenamiento al query builder del historial
   */
  private applyHistoryOrdering(query: any, filters: OrderHistoryQueryDto): void {
    const orderBy = filters.orderBy || OrderHistoryOrderBy.FECHA_PEDIDO;
    const orderDirection = filters.orderDirection || OrderDirection.DESC;

    // Mapear el campo de ordenamiento al nombre de columna correcto
    const orderColumnMap: Record<OrderHistoryOrderBy, string> = {
      [OrderHistoryOrderBy.FECHA_PEDIDO]: 'order.fechaPedido',
      [OrderHistoryOrderBy.TOTAL]: 'order.total',
      [OrderHistoryOrderBy.STATUS]: 'order.status',
    };

    query.orderBy(orderColumnMap[orderBy], orderDirection);
  }

  private buildPaginatedResponse<T>(
    items: T[],
    total: number,
    pagination?: PaginationDto,
  ): PaginatedResponse<T> {
    const computedLimit = pagination?.limit ?? (total > 0 ? total : 1);
    const limit = Math.min(Math.max(computedLimit, 1), 1000);
    const page = pagination?.page ?? 1;

    return {
      items,
      meta: {
        total,
        limit,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}


