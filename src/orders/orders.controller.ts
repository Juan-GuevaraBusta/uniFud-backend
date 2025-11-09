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
  @ApiOperation({
    summary: 'Crear pedido',
    description: 'Permite a un estudiante crear un nuevo pedido en un restaurante',
  })
  @ApiResponse({ status: 201, description: 'Pedido creado exitosamente' })
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
  @ApiOperation({ summary: 'Detalle del pedido' })
  @ApiParam({ name: 'id', description: 'ID del pedido' })
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
  @ApiParam({ name: 'restaurantId', description: 'ID del restaurante' })
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
  @ApiParam({ name: 'id', description: 'ID del pedido' })
  @ApiResponse({ status: 200, description: 'Estado actualizado exitosamente' })
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
  @ApiParam({ name: 'id', description: 'ID del pedido' })
  @ApiResponse({ status: 200, description: 'Pedido cancelado exitosamente' })
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
