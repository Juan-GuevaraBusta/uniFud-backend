import { Body, Controller, Get, Post, Patch, Param, Query, UseGuards, HttpCode, HttpStatus, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderStatus } from './entities/order.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { OrdersRestaurantQueryDto } from './dto/orders-restaurant-query.dto';

@ApiTags('Pedidos')
@Controller('orders')
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  /**
   * Crear un nuevo pedido (solo estudiantes)
   */
  @Post()
  @Roles(UserRole.STUDENT, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear pedido',
    description: 'Permite a un estudiante crear un nuevo pedido en un restaurante',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Pedido creado exitosamente',
    schema: {
      example: {
        success: true,
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          numeroOrden: '#001-2024',
          status: 'PENDIENTE',
          total: 15750,
        },
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos, plato no disponible, o restaurante inactivo',
    schema: {
      example: {
        statusCode: 400,
        message: 'El plato no está disponible actualmente',
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
    description: 'No autorizado (solo estudiantes pueden crear pedidos)',
    schema: {
      example: {
        statusCode: 403,
        message: 'Forbidden resource',
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
  async create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: any) {
    return await this.ordersService.create(createOrderDto, user.id);
  }

  /**
   * Obtener pedidos según el rol del usuario
   */
  @Get()
  @Roles(UserRole.STUDENT, UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listado de pedidos',
    description: 'Retorna pedidos personalizados según el rol del usuario',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página (por defecto 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Resultados por página (por defecto 20)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos paginada',
    schema: {
      example: {
        success: true,
        data: {
          items: [],
          meta: {
            total: 10,
            limit: 20,
            page: 1,
            totalPages: 1,
          },
        },
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros inválidos o rango de fechas inválido',
    schema: {
      example: {
        statusCode: 400,
        message: 'El rango de fechas es inválido (startDate > endDate)',
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
  async findAll(
    @CurrentUser() user: any,
    @Query() query: OrdersQueryDto,
  ) {
    if (user.role === UserRole.STUDENT) {
      return await this.ordersService.findByUser(user.id, query);
    }

    if (user.role === UserRole.RESTAURANT_OWNER) {
      if (!query.restaurantId) {
        throw new BadRequestException('Debes proporcionar el ID del restaurante');
      }

      return await this.ordersService.findByRestaurant(
        query.restaurantId,
        query.status,
        user.id,
        user.role,
        query,
      );
    }

    if (query.startDate && query.endDate && query.startDate > query.endDate) {
      throw new BadRequestException('El rango de fechas es inválido (startDate > endDate)');
    }

    return await this.ordersService.findAll(
      {
        status: query.status,
        restaurantId: query.restaurantId,
        startDate: query.startDate,
        endDate: query.endDate,
      },
      query,
    );
  }

  /**
   * Obtener detalle de un pedido
   */
  @Get(':id')
  @Roles(UserRole.STUDENT, UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Detalle del pedido',
    description: 'Obtiene los detalles completos de un pedido específico. El acceso depende del rol del usuario.',
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del pedido (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del pedido',
    schema: {
      example: {
        success: true,
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          numeroOrden: '#001-2024',
          status: 'PENDIENTE',
          items: [],
          total: 15750,
        },
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
    status: 403,
    description: 'No tienes acceso a este pedido',
    schema: {
      example: {
        statusCode: 403,
        message: 'No tienes acceso a este pedido',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Pedido con ID 123e4567-e89b-12d3-a456-426614174000 no encontrado',
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
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const order = await this.ordersService.findOne(id);

    if (user.role === UserRole.ADMIN) {
      return order;
    }

    if (user.role === UserRole.STUDENT) {
      if (order.userId !== user.id) {
        throw new ForbiddenException('No tienes acceso a este pedido');
      }
      return order;
    }

    // Propietario del restaurante
    const restaurant = await this.restaurantsService.findOne(order.restaurantId);

    if (restaurant.ownerId !== user.id) {
      throw new ForbiddenException('No tienes acceso a este pedido');
    }

    return order;
  }

  /**
   * Obtener pedidos de un restaurante
   */
  @Get('restaurant/:restaurantId')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Pedidos del restaurante',
    description: 'Retorna los pedidos de un restaurante. Solo para propietarios o admin',
  })
  @ApiParam({ 
    name: 'restaurantId', 
    description: 'ID del restaurante (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página (por defecto 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Resultados por página (por defecto 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OrderStatus,
    description: 'Filtrar por estado del pedido',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos del restaurante',
    schema: {
      example: {
        success: true,
        data: {
          items: [],
          meta: {
            total: 5,
            limit: 20,
            page: 1,
            totalPages: 1,
          },
        },
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
    status: 403,
    description: 'No tienes permisos para ver pedidos de este restaurante',
    schema: {
      example: {
        statusCode: 403,
        message: 'No tienes permisos para ver pedidos de este restaurante',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurante no encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Restaurante no encontrado',
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
  async findByRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Query() query: OrdersRestaurantQueryDto,
    @CurrentUser() user: any,
  ) {
    return await this.ordersService.findByRestaurant(
      restaurantId,
      query.status,
      user.id,
      user.role,
      query,
    );
  }

  /**
   * Actualizar el estado de un pedido (solo restaurante o admin)
   */
  @Patch(':id/status')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar estado del pedido',
    description: 'Permite al restaurante avanzar el estado de un pedido',
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del pedido (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Estado actualizado exitosamente',
    schema: {
      example: {
        success: true,
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'PREPARANDO',
          fechaAceptado: '2024-01-15T10:30:00.000Z',
        },
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Transición de estado inválida o datos inválidos',
    schema: {
      example: {
        statusCode: 400,
        message: 'Utiliza el endpoint de cancelación para cancelar pedidos',
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
    description: 'No tienes permisos para actualizar este pedido',
    schema: {
      example: {
        statusCode: 403,
        message: 'No tienes permisos para actualizar este pedido',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Pedido no encontrado',
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
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
  ) {
    if (updateOrderStatusDto.status === OrderStatus.CANCELADO) {
      throw new BadRequestException('Utiliza el endpoint de cancelación para cancelar pedidos');
    }

    return await this.ordersService.updateStatus(
      id,
      updateOrderStatusDto,
      user.id,
      user.role,
    );
  }

  /**
   * Cancelar un pedido
   */
  @Patch(':id/cancel')
  @Roles(UserRole.STUDENT, UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancelar pedido',
    description: 'Permite cancelar un pedido. Los estudiantes solo pueden cancelar pedidos pendientes.',
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del pedido (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Pedido cancelado exitosamente',
    schema: {
      example: {
        success: true,
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'CANCELADO',
          motivo: 'Cliente canceló',
        },
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede cancelar el pedido en su estado actual',
    schema: {
      example: {
        statusCode: 400,
        message: 'Solo se pueden cancelar pedidos en estado PENDIENTE',
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
    description: 'No tienes permisos para cancelar este pedido',
    schema: {
      example: {
        statusCode: 403,
        message: 'No tienes permisos para cancelar este pedido',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Pedido no encontrado',
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
  async cancel(
    @Param('id') id: string,
    @Body() cancelOrderDto: CancelOrderDto,
    @CurrentUser() user: any,
  ) {
    return await this.ordersService.cancel(
      id,
      user.id,
      user.role,
      cancelOrderDto.motivo,
      cancelOrderDto.comentariosRestaurante,
    );
  }
}
