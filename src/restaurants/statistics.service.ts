import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { RestaurantsService } from './restaurants.service';
import { DateRangeDto } from './dto/date-range.dto';

export interface OrdersByStatus {
  pendiente: number;
  aceptado: number;
  preparando: number;
  listo: number;
  entregado: number;
  cancelado: number;
}

export interface PopularDish {
  dishId: string;
  dishNombre: string;
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number; // En centavos
}

export interface RestaurantStatistics {
  totalOrders: number;
  totalRevenue: number; // En centavos
  ordersByStatus: OrdersByStatus;
  popularDishes: PopularDish[];
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  /**
   * Obtener el total de pedidos de un restaurante
   * @param restaurantId - ID del restaurante
   * @param dateRange - Rango de fechas opcional
   * @returns Total de pedidos
   */
  async getTotalOrders(restaurantId: string, dateRange?: DateRangeDto): Promise<number> {
    // Verificar que el restaurante exista
    await this.restaurantsService.findOne(restaurantId);

    const where: any = { restaurantId };

    if (dateRange?.startDate && dateRange?.endDate) {
      where.fechaPedido = Between(
        new Date(dateRange.startDate),
        new Date(dateRange.endDate),
      );
    }

    return await this.orderRepository.count({ where });
  }

  /**
   * Obtener el total de ingresos de un restaurante
   * @param restaurantId - ID del restaurante
   * @param dateRange - Rango de fechas opcional
   * @returns Total de ingresos en centavos
   */
  async getTotalRevenue(restaurantId: string, dateRange?: DateRangeDto): Promise<number> {
    // Verificar que el restaurante exista
    await this.restaurantsService.findOne(restaurantId);

    const where: any = { restaurantId };

    // Solo contar pedidos completados (entregados) para ingresos
    where.status = OrderStatus.ENTREGADO;

    if (dateRange?.startDate && dateRange?.endDate) {
      where.fechaPedido = Between(
        new Date(dateRange.startDate),
        new Date(dateRange.endDate),
      );
    }

    const orders = await this.orderRepository.find({
      where,
      select: ['total'],
    });

    // Sumar todos los totales
    return orders.reduce((sum, order) => sum + order.total, 0);
  }

  /**
   * Obtener conteo de pedidos por estado
   * @param restaurantId - ID del restaurante
   * @returns Objeto con conteo por cada estado
   */
  async getOrdersByStatus(restaurantId: string): Promise<OrdersByStatus> {
    // Verificar que el restaurante exista
    await this.restaurantsService.findOne(restaurantId);

    const orders = await this.orderRepository.find({
      where: { restaurantId },
      select: ['status'],
    });

    const result: OrdersByStatus = {
      pendiente: 0,
      aceptado: 0,
      preparando: 0,
      listo: 0,
      entregado: 0,
      cancelado: 0,
    };

    orders.forEach(order => {
      if (order.status in result) {
        result[order.status as keyof OrdersByStatus]++;
      }
    });

    return result;
  }

  /**
   * Obtener platos más populares de un restaurante
   * @param restaurantId - ID del restaurante
   * @param limit - Número máximo de platos a retornar (default: 10)
   * @returns Array de platos ordenados por popularidad
   */
  async getPopularDishes(restaurantId: string, limit: number = 10): Promise<PopularDish[]> {
    // Verificar que el restaurante exista
    await this.restaurantsService.findOne(restaurantId);

    // Obtener todos los pedidos entregados del restaurante
    const orders = await this.orderRepository.find({
      where: {
        restaurantId,
        status: OrderStatus.ENTREGADO,
      },
      select: ['items'],
    });

    // Agregar datos de platos
    const dishMap = new Map<string, PopularDish>();

    orders.forEach(order => {
      order.items.forEach((item: any) => {
        const dishId = item.dishId;
        const existing = dishMap.get(dishId);

        if (existing) {
          existing.totalOrders += 1;
          existing.totalQuantity += item.cantidad;
          existing.totalRevenue += item.precioTotal;
        } else {
          dishMap.set(dishId, {
            dishId,
            dishNombre: item.dishNombre,
            totalOrders: 1,
            totalQuantity: item.cantidad,
            totalRevenue: item.precioTotal,
          });
        }
      });
    });

    // Convertir a array y ordenar por total de pedidos (descendente)
    const popularDishes = Array.from(dishMap.values()).sort(
      (a, b) => b.totalOrders - a.totalOrders,
    );

    // Retornar solo el límite solicitado
    return popularDishes.slice(0, limit);
  }

  /**
   * Obtener todas las estadísticas del restaurante
   * @param restaurantId - ID del restaurante
   * @param dateRange - Rango de fechas opcional
   * @param popularDishesLimit - Límite de platos populares (default: 10)
   * @returns Objeto con todas las estadísticas
   */
  async getRestaurantStatistics(
    restaurantId: string,
    dateRange?: DateRangeDto,
    popularDishesLimit: number = 10,
  ): Promise<RestaurantStatistics> {
    const [totalOrders, totalRevenue, ordersByStatus, popularDishes] = await Promise.all([
      this.getTotalOrders(restaurantId, dateRange),
      this.getTotalRevenue(restaurantId, dateRange),
      this.getOrdersByStatus(restaurantId),
      this.getPopularDishes(restaurantId, popularDishesLimit),
    ]);

    return {
      totalOrders,
      totalRevenue,
      ordersByStatus,
      popularDishes,
    };
  }
}







