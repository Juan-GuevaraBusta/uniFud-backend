import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { DishesService } from '../dishes/dishes.service';
import { OrderItemDto } from './dto/order-item.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly restaurantsService: RestaurantsService,
    private readonly dishesService: DishesService,
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
   */
  async create(createOrderDto: CreateOrderDto, userId: string): Promise<Order> {
    // 1. Verificar que el restaurante existe y está activo
    const restaurant = await this.restaurantsService.findOne(createOrderDto.restaurantId);
    
    if (!restaurant.activo) {
      throw new BadRequestException('El restaurante no está activo en este momento');
    }

    // 2. Verificar que el usuario no tenga un pedido PENDIENTE en el mismo restaurante
    const pendingOrder = await this.orderRepository.findOne({
      where: {
        userId,
        restaurantId: createOrderDto.restaurantId,
        status: OrderStatus.PENDIENTE,
      },
    });

    if (pendingOrder) {
      throw new ConflictException(
        'Ya tienes un pedido pendiente en este restaurante. Espera a que sea procesado.'
      );
    }

    // 3. Validar disponibilidad de cada plato
    for (const item of createOrderDto.items) {
      const isAvailable = await this.dishesService.checkAvailability(
        item.dishId,
        createOrderDto.restaurantId,
      );

      if (!isAvailable) {
        throw new BadRequestException(
          `El plato "${item.dishNombre}" no está disponible en este momento`
        );
      }

      // Verificar que el plato existe y pertenece al restaurante
      const dish = await this.dishesService.findOne(item.dishId);
      
      if (dish.restaurantId !== createOrderDto.restaurantId) {
        throw new BadRequestException(
          `El plato "${item.dishNombre}" no pertenece a este restaurante`
        );
      }

      if (!dish.activo) {
        throw new BadRequestException(
          `El plato "${item.dishNombre}" no está activo`
        );
      }
    }

    // 4. Calcular totales
    const { subtotal, tarifaServicio, total } = this.calculateTotals(createOrderDto.items);

    // 5. Generar número de orden único
    const numeroOrden = await this.generateOrderNumber();

    // 6. Crear el pedido
    const order = this.orderRepository.create({
      ...createOrderDto,
      userId,
      numeroOrden,
      subtotal,
      tarifaServicio,
      total,
      status: OrderStatus.PENDIENTE,
    });

    // 7. Guardar y retornar con relaciones
    const savedOrder = await this.orderRepository.save(order);

    return await this.findOne(savedOrder.id);
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
  async findAll(filters?: {
    status?: OrderStatus;
    restaurantId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Order[]> {
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

    return await query.getMany();
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
      throw new NotFoundException(`Pedido con ID ${id} no encontrado`);
    }

    return order;
  }

  /**
   * Obtener pedidos de un usuario
   */
  async findByUser(userId: string): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { userId },
      relations: ['restaurant'],
      order: {
        fechaPedido: 'DESC',
      },
    });
  }

  /**
   * Obtener pedidos de un restaurante
   */
  async findByRestaurant(
    restaurantId: string,
    status?: OrderStatus,
    actorId?: string,
    actorRole?: string,
  ): Promise<Order[]> {
    if (actorRole && actorRole !== UserRole.ADMIN) {
      const restaurant = await this.restaurantsService.findOne(restaurantId);

      if (restaurant.ownerId !== actorId) {
        throw new ForbiddenException('No tienes permisos para ver los pedidos de este restaurante');
      }
    }

    const where: any = { restaurantId };
    
    if (status) {
      where.status = status;
    }

    return await this.orderRepository.find({
      where,
      relations: ['user'],
      order: {
        fechaPedido: 'ASC', // Más antiguos primero para que vean lo urgente
      },
    });
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
      throw new BadRequestException('Para cancelar un pedido utiliza el endpoint de cancelación');
    }

    const order = await this.findOne(orderId);
    const restaurant = await this.restaurantsService.findOne(order.restaurantId);

    if (actorRole !== UserRole.ADMIN && restaurant.ownerId !== actorId) {
      throw new ForbiddenException('No tienes permisos para actualizar el estado de este pedido');
    }

    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException('El pedido está cancelado y no puede cambiar de estado');
    }

    if (order.status === OrderStatus.ENTREGADO) {
      throw new BadRequestException('El pedido ya fue entregado');
    }

    const allowedTransitions = this.statusTransitions[order.status] ?? [];

    if (!allowedTransitions.includes(updateStatusDto.status)) {
      throw new BadRequestException(
        `Transición inválida: no se puede cambiar de ${order.status} a ${updateStatusDto.status}`,
      );
    }

    switch (updateStatusDto.status) {
      case OrderStatus.ACEPTADO: {
        if (!updateStatusDto.tiempoEstimado) {
          throw new BadRequestException('Debes proporcionar un tiempo estimado en minutos');
        }

        order.fechaAceptado = new Date();
        order.tiempoEstimado = updateStatusDto.tiempoEstimado;
        break;
      }

      case OrderStatus.PREPARANDO: {
        if (order.status !== OrderStatus.ACEPTADO) {
          throw new BadRequestException('El pedido debe haber sido aceptado antes de prepararse');
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
    return await this.findOne(saved.id);
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
      throw new BadRequestException('El pedido ya está cancelado');
    }

    if (order.status === OrderStatus.ENTREGADO) {
      throw new BadRequestException('No puedes cancelar un pedido que ya fue entregado');
    }

    const motivoLimpio = motivo?.trim();

    if (!motivoLimpio) {
      throw new BadRequestException('Debes proporcionar un motivo de cancelación');
    }

    if (actorRole === UserRole.STUDENT) {
      if (order.userId !== actorId) {
        throw new ForbiddenException('No puedes cancelar pedidos de otros usuarios');
      }

      if (order.status !== OrderStatus.PENDIENTE) {
        throw new BadRequestException('Solo puedes cancelar pedidos pendientes');
      }
    } else if (actorRole === UserRole.RESTAURANT_OWNER) {
      const restaurant = await this.restaurantsService.findOne(order.restaurantId);

      if (restaurant.ownerId !== actorId) {
        throw new ForbiddenException('No puedes cancelar pedidos de otros restaurantes');
      }
    } else if (actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permisos para cancelar pedidos');
    }

    order.status = OrderStatus.CANCELADO;
    order.motivoCancelacion = motivoLimpio;

    if (actorRole !== UserRole.STUDENT && comentariosRestaurante) {
      order.comentariosRestaurante = comentariosRestaurante.trim();
    }

    order.tiempoEstimado = null;

    const saved = await this.orderRepository.save(order);
    return await this.findOne(saved.id);
  }
}


