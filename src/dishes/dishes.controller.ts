import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DishesService } from './dishes.service';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { DishResponseDto } from './dto/dish-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateToppingDto } from './dto/create-topping.dto';

@ApiTags('Platos')
@Controller('dishes')
@UseGuards(RolesGuard)
export class DishesController {
  constructor(private readonly dishesService: DishesService) {}

  /**
   * Crear un nuevo plato
   */
  @Post()
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear plato',
    description: 'Crea un nuevo plato en el menú del restaurante. Solo el dueño del restaurante.',
  })
  @ApiResponse({
    status: 201,
    description: 'Plato creado exitosamente',
    type: DishResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para crear platos en este restaurante',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o toppings no válidos para el tipo de plato',
  })
  async create(
    @Body() createDishDto: CreateDishDto,
    @CurrentUser() user: any,
  ) {
    return await this.dishesService.create(createDishDto, user.id, user.role);
  }

  /**
   * Obtener todos los platos activos
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Listar platos',
    description: 'Obtiene todos los platos activos. Puede filtrar por restaurante o categoría.',
  })
  @ApiQuery({
    name: 'restaurantId',
    required: false,
    description: 'Filtrar por ID de restaurante',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'categoria',
    required: false,
    description: 'Filtrar por categoría',
    example: 'Pizza',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar platos por nombre',
    example: 'Pizza',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de platos',
    type: [DishResponseDto],
  })
  async findAll(
    @Query('restaurantId') restaurantId?: string,
    @Query('categoria') categoria?: string,
    @Query('search') search?: string,
  ) {
    if (search) {
      return await this.dishesService.search(search);
    }
    
    if (restaurantId) {
      return await this.dishesService.findByRestaurant(restaurantId);
    }
    
    if (categoria) {
      return await this.dishesService.findByCategory(categoria);
    }
    
    return await this.dishesService.findAll();
  }

  /**
   * Obtener menú de un restaurante
   */
  @Public()
  @Get('restaurant/:restaurantId')
  @ApiOperation({
    summary: 'Menú del restaurante',
    description: 'Obtiene todos los platos activos de un restaurante específico',
  })
  @ApiParam({
    name: 'restaurantId',
    description: 'ID del restaurante',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Menú del restaurante',
    type: [DishResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurante no encontrado',
  })
  async getRestaurantMenu(@Param('restaurantId') restaurantId: string) {
    return await this.dishesService.findByRestaurant(restaurantId);
  }

  /**
   * Obtener un plato por ID
   */
  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener plato',
    description: 'Obtiene los detalles de un plato por su ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plato',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Plato encontrado',
    type: DishResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Plato no encontrado',
  })
  async findOne(@Param('id') id: string) {
    return await this.dishesService.findOne(id);
  }

  /**
   * Actualizar un plato
   */
  @Patch(':id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar plato',
    description: 'Actualiza los datos de un plato. Solo el dueño del restaurante.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plato',
  })
  @ApiResponse({
    status: 200,
    description: 'Plato actualizado exitosamente',
    type: DishResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para actualizar este plato',
  })
  @ApiResponse({
    status: 404,
    description: 'Plato no encontrado',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDishDto: UpdateDishDto,
    @CurrentUser() user: any,
  ) {
    return await this.dishesService.update(id, updateDishDto, user.id, user.role);
  }

  /**
   * Cambiar estado activo/inactivo del plato
   */
  @Patch(':id/toggle-active')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activar/Desactivar plato',
    description: 'Cambia el estado activo del plato',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plato',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado cambiado exitosamente',
    type: DishResponseDto,
  })
  async toggleActive(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return await this.dishesService.toggleActive(id, user.id, user.role);
  }

  /**
   * Agregar topping a un plato
   */
  @Post(':id/toppings')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Agregar topping',
    description: 'Agrega un topping a un plato existente',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plato',
  })
  @ApiResponse({
    status: 201,
    description: 'Topping agregado exitosamente',
    type: DishResponseDto,
  })
  async addTopping(
    @Param('id') dishId: string,
    @Body() toppingDto: CreateToppingDto,
    @CurrentUser() user: any,
  ) {
    return await this.dishesService.addTopping(dishId, toppingDto, user.id, user.role);
  }

  /**
   * Eliminar topping de un plato
   */
  @Delete(':id/toppings/:toppingId')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar topping',
    description: 'Elimina un topping de un plato',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plato',
  })
  @ApiParam({
    name: 'toppingId',
    description: 'ID del topping',
  })
  @ApiResponse({
    status: 200,
    description: 'Topping eliminado exitosamente',
    type: DishResponseDto,
  })
  async removeTopping(
    @Param('id') dishId: string,
    @Param('toppingId') toppingId: string,
    @CurrentUser() user: any,
  ) {
    return await this.dishesService.removeTopping(dishId, toppingId, user.id, user.role);
  }

  /**
   * Eliminar un plato
   */
  @Delete(':id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar plato',
    description: 'Elimina un plato del menú. Solo el dueño del restaurante.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plato',
  })
  @ApiResponse({
    status: 204,
    description: 'Plato eliminado exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para eliminar este plato',
  })
  @ApiResponse({
    status: 404,
    description: 'Plato no encontrado',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    await this.dishesService.remove(id, user.id, user.role);
  }
}

