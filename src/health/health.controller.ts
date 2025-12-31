import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { OrderStatus } from '../orders/entities/order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';

@ApiTags('Health')
@Controller('health')
@ApiBearerAuth()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
  ) {}

  /**
   * Health check general del sistema
   */
  @Get()
  @ApiOperation({
    summary: 'Health check general',
    description: 'Verifica el estado general del sistema. Requiere autenticación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sistema saludable',
    schema: {
      example: {
        status: 'ok',
        info: {
          database: {
            status: 'up',
          },
        },
        error: {},
        details: {
          database: {
            status: 'up',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Sistema no saludable',
    schema: {
      example: {
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: 'Connection timeout',
          },
        },
        details: {
          database: {
            status: 'down',
            message: 'Connection timeout',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  /**
   * Health check específico de la base de datos
   */
  @Get('db')
  @ApiOperation({
    summary: 'Health check de base de datos',
    description: 'Verifica el estado de la conexión a PostgreSQL. Requiere autenticación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Base de datos saludable',
    schema: {
      example: {
        status: 'ok',
        info: {
          database: {
            status: 'up',
          },
        },
        error: {},
        details: {
          database: {
            status: 'up',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Base de datos no disponible',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @HealthCheck()
  checkDb() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  /**
   * Métricas básicas del sistema (solo administradores)
   */
  @Get('metrics')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Métricas del sistema',
    description: 'Obtiene métricas básicas del sistema: total de usuarios, pedidos del día, pedidos por estado, restaurantes activos. Solo para administradores.',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas obtenidas exitosamente',
    schema: {
      example: {
        totalUsers: 150,
        totalOrdersToday: 45,
        ordersByStatus: {
          pendiente: 5,
          aceptado: 10,
          preparando: 8,
          listo: 3,
          entregado: 15,
          cancelado: 4,
        },
        activeRestaurants: 12,
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'No autorizado (solo administradores)',
  })
  async getMetrics() {
    // Obtener fecha de hoy (inicio y fin del día)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total de usuarios
    const totalUsers = await this.userRepository.count();

    // Total de pedidos del día
    const totalOrdersToday = await this.orderRepository.count({
      where: {
        fechaPedido: Between(today, tomorrow),
      },
    });

    // Pedidos por estado
    const allOrders = await this.orderRepository.find({
      select: ['status'],
    });

    const ordersByStatus = {
      [OrderStatus.PENDIENTE]: 0,
      [OrderStatus.ACEPTADO]: 0,
      [OrderStatus.PREPARANDO]: 0,
      [OrderStatus.LISTO]: 0,
      [OrderStatus.ENTREGADO]: 0,
      [OrderStatus.CANCELADO]: 0,
    };

    allOrders.forEach((order) => {
      if (order.status in ordersByStatus) {
        ordersByStatus[order.status as keyof typeof ordersByStatus]++;
      }
    });

    // Total de restaurantes activos
    const activeRestaurants = await this.restaurantRepository.count({
      where: { activo: true },
    });

    return {
      totalUsers,
      totalOrdersToday,
      ordersByStatus,
      activeRestaurants,
      timestamp: new Date().toISOString(),
    };
  }
}

