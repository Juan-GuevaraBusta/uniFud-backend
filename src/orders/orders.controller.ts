import { Body, Controller, Get, Post, Patch, Param, Query, UseGuards, HttpCode, HttpStatus, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderStatus } from './entities/order.entity';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';

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
    name: 'status',
    required: false,
    enum: OrderStatus,
    description: 'Filtrar por estado (solo propietario o admin)',
  })
  @ApiQuery({
    name: 'restaurantId',
    required: false,
    description: 'Obligatorio para propietarios de restaurantes',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Fecha inicial (ISO 8601) para filtros de admin',
    example: '2025-11-05T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Fecha final (ISO 8601) para filtros de admin',
    example: '2025-11-05T23:59:59Z',
  })
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: OrderStatus,
    @Query('restaurantId') restaurantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (status && !Object.values(OrderStatus).includes(status)) {
      throw new BadRequestException('Estado inválido');
    }

    if (user.role === UserRole.STUDENT) {
      return await this.ordersService.findByUser(user.id);
    }

    if (user.role === UserRole.RESTAURANT_OWNER) {
      if (!restaurantId) {
        throw new BadRequestException('Debes proporcionar el ID del restaurante');
      }

      return await this.ordersService.findByRestaurant(restaurantId, status, user.id, user.role);
    }

    // Admin
    const filters: {
      status?: OrderStatus;
      restaurantId?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (status) {
      filters.status = status;
    }

    if (restaurantId) {
      filters.restaurantId = restaurantId;
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new BadRequestException('Rango de fechas inválido');
      }

      filters.startDate = start;
      filters.endDate = end;
    }

    return await this.ordersService.findAll(filters);
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
    name: 'status',
    required: false,
    enum: OrderStatus,
    description: 'Filtrar por estado',
  })
  async findByRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Query('status') status: OrderStatus,
    @CurrentUser() user: any,
  ) {
    if (status && !Object.values(OrderStatus).includes(status)) {
      throw new BadRequestException('Estado inválido');
    }

    return await this.ordersService.findByRestaurant(
      restaurantId,
      status,
      user.id,
      user.role,
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
