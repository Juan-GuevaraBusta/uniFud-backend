import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { RestaurantResponseDto } from './dto/restaurant-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Restaurantes')
@Controller('restaurants')
@UseGuards(RolesGuard)
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  /**
   * Crear un nuevo restaurante
   */
  @Post()
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear restaurante',
    description: 'Crea un nuevo restaurante. Solo para propietarios de restaurantes.',
  })
  @ApiResponse({
    status: 201,
    description: 'Restaurante creado exitosamente',
    type: RestaurantResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para crear restaurantes',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya tienes un restaurante o el nombre está duplicado',
  })
  async create(
    @Body() createRestaurantDto: CreateRestaurantDto,
    @CurrentUser() user: any,
  ) {
    return await this.restaurantsService.create(createRestaurantDto, user.id, user.role);
  }

  /**
   * Obtener todos los restaurantes activos
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Listar restaurantes',
    description: 'Obtiene todos los restaurantes activos',
  })
  @ApiQuery({
    name: 'universityId',
    required: false,
    description: 'Filtrar por universidad',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de restaurantes',
    type: [RestaurantResponseDto],
  })
  async findAll(@Query('universityId') universityId?: string) {
    if (universityId) {
      return await this.restaurantsService.findByUniversity(universityId);
    }
    return await this.restaurantsService.findAll();
  }

  /**
   * Obtener mi restaurante (del usuario autenticado)
   */
  @Get('me')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener mi restaurante',
    description: 'Obtiene el restaurante del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Restaurante encontrado',
    type: RestaurantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No tienes un restaurante registrado',
  })
  async findMine(@CurrentUser() user: any) {
    const restaurant = await this.restaurantsService.findByOwner(user.id);
    if (!restaurant) {
      throw new Error('No tienes un restaurante registrado');
    }
    return restaurant;
  }

  /**
   * Obtener restaurantes por universidad
   */
  @Public()
  @Get('university/:universityId')
  @ApiOperation({
    summary: 'Restaurantes por universidad',
    description: 'Obtiene todos los restaurantes de una universidad específica',
  })
  @ApiParam({
    name: 'universityId',
    description: 'ID de la universidad',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de restaurantes de la universidad',
    type: [RestaurantResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Universidad no encontrada',
  })
  async findByUniversity(@Param('universityId') universityId: string) {
    return await this.restaurantsService.findByUniversity(universityId);
  }

  /**
   * Obtener un restaurante por ID
   */
  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener restaurante',
    description: 'Obtiene los detalles de un restaurante por su ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del restaurante',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Restaurante encontrado',
    type: RestaurantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurante no encontrado',
  })
  async findOne(@Param('id') id: string) {
    return await this.restaurantsService.findOne(id);
  }

  /**
   * Actualizar un restaurante
   */
  @Patch(':id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar restaurante',
    description: 'Actualiza los datos de un restaurante. Solo el dueño o admin.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del restaurante',
  })
  @ApiResponse({
    status: 200,
    description: 'Restaurante actualizado exitosamente',
    type: RestaurantResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para actualizar este restaurante',
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurante no encontrado',
  })
  async update(
    @Param('id') id: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
    @CurrentUser() user: any,
  ) {
    return await this.restaurantsService.update(id, updateRestaurantDto, user.id, user.role);
  }

  /**
   * Cambiar estado activo/inactivo del restaurante
   */
  @Patch(':id/toggle-active')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activar/Desactivar restaurante',
    description: 'Cambia el estado activo del restaurante',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del restaurante',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado cambiado exitosamente',
    type: RestaurantResponseDto,
  })
  async toggleActive(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return await this.restaurantsService.toggleActive(id, user.id, user.role);
  }

  /**
   * Eliminar un restaurante
   */
  @Delete(':id')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar restaurante',
    description: 'Elimina un restaurante del sistema. Solo el dueño o admin.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del restaurante',
  })
  @ApiResponse({
    status: 204,
    description: 'Restaurante eliminado exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para eliminar este restaurante',
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurante no encontrado',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    await this.restaurantsService.remove(id, user.id, user.role);
  }
}




