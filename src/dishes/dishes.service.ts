import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { Dish, DishType } from './entities/dish.entity';
import { Topping } from './entities/topping.entity';
import { DishAvailability } from './entities/dish-availability.entity';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { BulkUpdateAvailabilityDto } from './dto/update-availability.dto';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { UserRole } from '../users/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { BusinessException } from '../common/exceptions/business-exception';
import { ForbiddenAccessException } from '../common/exceptions/unauthorized-exception';
import { ResourceNotFoundException } from '../common/exceptions/not-found-exception';
import { DishSearchQueryDto, DishSearchOrderBy, DishSearchOrderDirection } from './dto/dish-search-query.dto';
import { Order, OrderStatus } from '../orders/entities/order.entity';

@Injectable()
export class DishesService {
  constructor(
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    @InjectRepository(Topping)
    private readonly toppingRepository: Repository<Topping>,
    @InjectRepository(DishAvailability)
    private readonly availabilityRepository: Repository<DishAvailability>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly restaurantsService: RestaurantsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Crear un nuevo plato con toppings
   */
  async create(createDishDto: CreateDishDto, userId: string, userRole: string): Promise<Dish> {
    // Verificar que el restaurante existe y el usuario es el dueño
    const restaurant = await this.restaurantsService.findOne(createDishDto.restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenAccessException('Solo el dueño del restaurante puede crear platos', 'DISH_CREATE_FORBIDDEN');
    }

    if (createDishDto.precio > 1_000_000) {
      throw new BusinessException('El precio del plato no puede superar 1.000.000', 'DISH_PRICE_OUT_OF_RANGE');
    }

    const categories = restaurant.categorias?.map(cat => cat.trim().toLowerCase()) ?? [];
    if (!categories.includes(createDishDto.categoria.trim().toLowerCase())) {
      throw new BusinessException('La categoría indicada no está configurada en el restaurante', 'DISH_CATEGORY_INVALID', {
        categoria: createDishDto.categoria,
        restaurantId: restaurant.id,
      });
    }

    // Validar toppings según tipo de plato
    this.validateToppingsByDishType(createDishDto.tipoPlato, createDishDto.toppings);

    // Crear el plato con toppings
    const dish = this.dishRepository.create({
      ...createDishDto,
      toppings: createDishDto.toppings || [],
    });

    const savedDish = await this.dishRepository.save(dish);

    // Invalidar caché del menú después de crear
    await this.invalidateDishMenuCache(createDishDto.restaurantId);

    return savedDish;
  }

  /**
   * Obtener todos los platos activos
   */
  async findAll(pagination?: PaginationDto): Promise<PaginatedResponse<Dish>> {
    const options: FindManyOptions<Dish> = {
      where: { activo: true },
      relations: ['restaurant', 'toppings'],
      order: {
        nombre: 'ASC',
      },
    };

    if (pagination) {
      options.skip = pagination.skip;
      options.take = pagination.take;
    }

    const [items, total] = await this.dishRepository.findAndCount(options);

    return this.buildPaginatedResponse(items, total, pagination);
  }

  /**
   * Obtener platos por restaurante
   */
  async findByRestaurant(restaurantId: string, pagination?: PaginationDto): Promise<PaginatedResponse<Dish>> {
    // Verificar que el restaurante existe
    await this.restaurantsService.findOne(restaurantId);

    const options: FindManyOptions<Dish> = {
      where: {
        restaurantId,
        activo: true,
      },
      relations: ['toppings'],
      order: {
        categoria: 'ASC',
        nombre: 'ASC',
      },
    };

    if (pagination) {
      options.skip = pagination.skip;
      options.take = pagination.take;
    }

    const [items, total] = await this.dishRepository.findAndCount(options);

    return this.buildPaginatedResponse(items, total, pagination);
  }

  /**
   * Obtener platos por categoría
   */
  async findByCategory(categoria: string, pagination?: PaginationDto): Promise<PaginatedResponse<Dish>> {
    const options: FindManyOptions<Dish> = {
      where: {
        categoria,
        activo: true,
      },
      relations: ['restaurant', 'toppings'],
      order: {
        nombre: 'ASC',
      },
    };

    if (pagination) {
      options.skip = pagination.skip;
      options.take = pagination.take;
    }

    const [items, total] = await this.dishRepository.findAndCount(options);

    return this.buildPaginatedResponse(items, total, pagination);
  }

  /**
   * Obtener un plato por ID
   */
  async findOne(id: string): Promise<Dish> {
    const dish = await this.dishRepository.findOne({
      where: { id },
      relations: ['restaurant', 'toppings'],
    });

    if (!dish) {
      throw new ResourceNotFoundException('Plato', { id });
    }

    return dish;
  }

  /**
   * Actualizar un plato
   */
  async update(id: string, updateDishDto: UpdateDishDto, userId: string, userRole: string): Promise<Dish> {
    const dish = await this.findOne(id);

    // Verificar permisos
    const restaurant = await this.restaurantsService.findOne(dish.restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenAccessException('Solo el dueño del restaurante puede actualizar este plato', 'DISH_UPDATE_FORBIDDEN');
    }

    // Validar precio si se proporciona
    if (updateDishDto.precio !== undefined && updateDishDto.precio < 1) {
      throw new BadRequestException('El precio debe ser mayor a 0');
    }

    if (updateDishDto.precio !== undefined && updateDishDto.precio > 1_000_000) {
      throw new BusinessException('El precio del plato no puede superar 1.000.000', 'DISH_PRICE_OUT_OF_RANGE');
    }

    if (updateDishDto.categoria) {
      const categories = restaurant.categorias?.map(cat => cat.trim().toLowerCase()) ?? [];
      if (!categories.includes(updateDishDto.categoria.trim().toLowerCase())) {
        throw new BusinessException('La categoría indicada no está configurada en el restaurante', 'DISH_CATEGORY_INVALID', {
          categoria: updateDishDto.categoria,
          restaurantId: restaurant.id,
        });
      }
    }

    // Aplicar cambios
    Object.assign(dish, updateDishDto);

    const updatedDish = await this.dishRepository.save(dish);

    // Invalidar caché del menú después de actualizar
    await this.invalidateDishMenuCache(dish.restaurantId);

    return updatedDish;
  }

  /**
   * Eliminar un plato
   */
  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const dish = await this.findOne(id);

    // Verificar permisos
    const restaurant = await this.restaurantsService.findOne(dish.restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenAccessException('Solo el dueño del restaurante puede eliminar este plato', 'DISH_DELETE_FORBIDDEN');
    }

    const restaurantId = dish.restaurantId;
    await this.dishRepository.remove(dish);

    // Invalidar caché del menú después de eliminar
    await this.invalidateDishMenuCache(restaurantId);
  }

  /**
   * Cambiar estado activo/inactivo del plato
   */
  async toggleActive(id: string, userId: string, userRole: string): Promise<Dish> {
    const dish = await this.findOne(id);

    // Verificar permisos
    const restaurant = await this.restaurantsService.findOne(dish.restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenAccessException('No tienes permisos para cambiar el estado de este plato', 'DISH_STATUS_FORBIDDEN');
    }

    dish.activo = !dish.activo;

    const updatedDish = await this.dishRepository.save(dish);

    // Invalidar caché del menú al cambiar estado activo
    await this.invalidateDishMenuCache(dish.restaurantId);

    return updatedDish;
  }

  /**
   * Calcular precio total del plato con toppings seleccionados
   */
  calculatePrice(dish: Dish, selectedToppingIds: string[]): number {
    let totalPrice = dish.precio;

    if (selectedToppingIds && selectedToppingIds.length > 0) {
      const selectedToppings = dish.toppings.filter(topping => 
        selectedToppingIds.includes(topping.id)
      );

      for (const topping of selectedToppings) {
        if (!topping.removible) {
          // Solo agregar precio de toppings adicionales (no removibles)
          totalPrice += topping.precio;
        }
      }
    }

    return totalPrice;
  }

  /**
   * Agregar topping a un plato existente
   */
  async addTopping(dishId: string, toppingData: any, userId: string, userRole: string): Promise<Dish> {
    const dish = await this.findOne(dishId);

    // Verificar permisos
    const restaurant = await this.restaurantsService.findOne(dish.restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenAccessException('Solo el dueño del restaurante puede agregar toppings', 'DISH_TOPPING_FORBIDDEN');
    }

    const topping = this.toppingRepository.create({
      ...toppingData,
      dishId: dish.id,
    });

    await this.toppingRepository.save(topping);

    return await this.findOne(dishId);
  }

  /**
   * Eliminar topping de un plato
   */
  async removeTopping(dishId: string, toppingId: string, userId: string, userRole: string): Promise<Dish> {
    const dish = await this.findOne(dishId);

    // Verificar permisos
    const restaurant = await this.restaurantsService.findOne(dish.restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenAccessException('Solo el dueño del restaurante puede eliminar toppings', 'DISH_TOPPING_FORBIDDEN');
    }

    const topping = await this.toppingRepository.findOne({
      where: { id: toppingId, dishId },
    });

    if (!topping) {
      throw new ResourceNotFoundException('Topping', { id: toppingId });
    }

    await this.toppingRepository.remove(topping);

    return await this.findOne(dishId);
  }

  /**
   * Validar toppings según el tipo de plato
   */
  private validateToppingsByDishType(tipoPlato: DishType, toppings?: any[]): void {
    if (!toppings || toppings.length === 0) {
      // SIMPLE no necesita toppings
      if (tipoPlato === DishType.SIMPLE) {
        return;
      }
      // Otros tipos pueden no tener toppings al crear, se pueden agregar después
      return;
    }

    switch (tipoPlato) {
      case DishType.SIMPLE:
        // Simple no debería tener toppings
        if (toppings.length > 0) {
          throw new BadRequestException('Los platos tipo SIMPLE no pueden tener toppings');
        }
        break;

      case DishType.FIJO:
        // Fijo: todos los toppings deben ser no removibles (ingredientes fijos)
        const hasRemovible = toppings.some(t => t.removible === true);
        if (hasRemovible) {
          throw new BusinessException('Los platos tipo FIJO no pueden tener ingredientes removibles', 'DISH_TOPPING_INVALID');
        }
        break;

      case DishType.MIXTO:
      case DishType.PERSONALIZABLE:
        // Pueden tener cualquier combinación de toppings
        break;

      default:
        throw new BusinessException('Tipo de plato inválido', 'DISH_TYPE_INVALID');
    }
  }

  /**
   * Buscar platos por nombre (método legacy - mantener compatibilidad)
   */
  async search(query: string, pagination?: PaginationDto): Promise<PaginatedResponse<Dish>> {
    const qb = this.dishRepository
      .createQueryBuilder('dish')
      .where('dish.nombre ILIKE :query', { query: `%${query}%` })
      .andWhere('dish.activo = :activo', { activo: true })
      .leftJoinAndSelect('dish.restaurant', 'restaurant')
      .leftJoinAndSelect('dish.toppings', 'toppings')
      .orderBy('dish.nombre', 'ASC');

    if (pagination) {
      qb.skip(pagination.skip).take(pagination.take);
    }

    const [items, total] = await qb.getManyAndCount();

    return this.buildPaginatedResponse(items, total, pagination);
  }

  /**
   * Búsqueda avanzada de platos con filtros y ordenamiento
   */
  async searchAdvanced(
    searchDto: DishSearchQueryDto,
  ): Promise<PaginatedResponse<Dish>> {
    const query = this.dishRepository.createQueryBuilder('dish');

    // Búsqueda por nombre
    query.where('dish.nombre ILIKE :searchQuery', {
      searchQuery: `%${searchDto.q}%`,
    });

    // Solo platos activos
    query.andWhere('dish.activo = :activo', { activo: true });

    // Filtro por restaurante
    if (searchDto.restaurantId) {
      query.andWhere('dish.restaurantId = :restaurantId', {
        restaurantId: searchDto.restaurantId,
      });
    }

    // Filtro por categoría
    if (searchDto.categoria) {
      query.andWhere('dish.categoria = :categoria', {
        categoria: searchDto.categoria,
      });
    }

    // Filtro por rango de precios
    if (searchDto.precioMin !== undefined && searchDto.precioMax !== undefined) {
      query.andWhere('dish.precio BETWEEN :precioMin AND :precioMax', {
        precioMin: searchDto.precioMin,
        precioMax: searchDto.precioMax,
      });
    } else if (searchDto.precioMin !== undefined) {
      query.andWhere('dish.precio >= :precioMin', {
        precioMin: searchDto.precioMin,
      });
    } else if (searchDto.precioMax !== undefined) {
      query.andWhere('dish.precio <= :precioMax', {
        precioMax: searchDto.precioMax,
      });
    }

    // Incluir relaciones
    query
      .leftJoinAndSelect('dish.restaurant', 'restaurant')
      .leftJoinAndSelect('dish.toppings', 'toppings');

    // Ordenamiento
    const orderBy = searchDto.orderBy || DishSearchOrderBy.NOMBRE;
    const orderDirection = searchDto.orderDirection || DishSearchOrderDirection.ASC;

    if (orderBy === DishSearchOrderBy.POPULARIDAD) {
      // Para popularidad, usamos SQL raw para contar pedidos entregados que contengan este plato
      // La subquery cuenta cuántos pedidos entregados tienen este dishId en sus items
      query
        .addSelect(
          `(
            SELECT COUNT(DISTINCT o.id)
            FROM orders o
            WHERE o.status = 'entregado'
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(o.items) AS item
              WHERE (item->>'dishId')::uuid = dish.id
            )
          )`,
          'popularity_count',
        )
        .orderBy('popularity_count', orderDirection)
        .addOrderBy('dish.nombre', 'ASC');
    } else {
      // Ordenamiento por precio o nombre
      const orderColumnMap: Record<DishSearchOrderBy, string> = {
        [DishSearchOrderBy.PRECIO]: 'dish.precio',
        [DishSearchOrderBy.NOMBRE]: 'dish.nombre',
        [DishSearchOrderBy.POPULARIDAD]: 'dish.nombre', // Fallback, no debería usarse aquí
      };
      query.orderBy(orderColumnMap[orderBy], orderDirection);
    }

    // Aplicar paginación
    if (searchDto) {
      query.skip(searchDto.skip).take(searchDto.take);
    }

    const [items, total] = await query.getManyAndCount();

    return this.buildPaginatedResponse(items, total, searchDto);
  }

  // ==================== MÉTODOS DE DISPONIBILIDAD ====================

  /**
   * Actualizar disponibilidad de un plato
   */
  async updateAvailability(
    dishId: string,
    restaurantId: string,
    disponible: boolean,
    userId: string,
    userRole: string,
  ): Promise<DishAvailability> {
    // Verificar que el plato existe
    const dish = await this.findOne(dishId);

    // Verificar que el plato pertenece al restaurante
    if (dish.restaurantId !== restaurantId) {
      throw new BadRequestException('El plato no pertenece a este restaurante');
    }

    // Verificar permisos
    const restaurant = await this.restaurantsService.findOne(restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenAccessException('Solo el dueño del restaurante puede actualizar la disponibilidad', 'DISH_AVAILABILITY_FORBIDDEN');
    }

    // Buscar disponibilidad existente
    let availability = await this.availabilityRepository.findOne({
      where: { dishId, restaurantId },
    });

    if (availability) {
      // Actualizar existente
      availability.disponible = disponible;
    } else {
      // Crear nueva
      availability = this.availabilityRepository.create({
        dishId,
        restaurantId,
        disponible,
      });
    }

    const savedAvailability = await this.availabilityRepository.save(availability);

    // Invalidar caché del menú después de actualizar disponibilidad
    await this.invalidateDishMenuCache(restaurantId);

    return savedAvailability;
  }

  /**
   * Obtener disponibilidad de todos los platos de un restaurante
   */
  async getRestaurantAvailability(restaurantId: string): Promise<DishAvailability[]> {
    // Verificar que el restaurante existe
    await this.restaurantsService.findOne(restaurantId);

    return await this.availabilityRepository.find({
      where: { restaurantId },
      relations: ['dish'],
      order: {
        updatedAt: 'DESC',
      },
    });
  }

  /**
   * Verificar si un plato está disponible
   */
  async checkAvailability(dishId: string, restaurantId: string): Promise<boolean> {
    const availability = await this.availabilityRepository.findOne({
      where: { dishId, restaurantId },
    });

    // Si no hay registro de disponibilidad, asumimos que está disponible
    return availability ? availability.disponible : true;
  }

  /**
   * Actualización masiva de disponibilidad
   */
  async bulkUpdateAvailability(
    restaurantId: string,
    bulkUpdateDto: BulkUpdateAvailabilityDto,
    userId: string,
    userRole: string,
  ): Promise<{ updated: number; results: DishAvailability[] }> {
    // Verificar permisos
    const restaurant = await this.restaurantsService.findOne(restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenAccessException('Solo el dueño del restaurante puede actualizar la disponibilidad', 'DISH_AVAILABILITY_FORBIDDEN');
    }

    const results: DishAvailability[] = [];

    for (const change of bulkUpdateDto.changes) {
      // Verificar que el plato existe y pertenece al restaurante
      const dish = await this.dishRepository.findOne({
        where: { id: change.dishId, restaurantId },
      });

      if (!dish) {
        // Omitir platos que no existen o no pertenecen al restaurante
        continue;
      }

      // Buscar o crear disponibilidad
      let availability = await this.availabilityRepository.findOne({
        where: { dishId: change.dishId, restaurantId },
      });

      if (availability) {
        availability.disponible = change.disponible;
      } else {
        availability = this.availabilityRepository.create({
          dishId: change.dishId,
          restaurantId,
          disponible: change.disponible,
        });
      }

      const saved = await this.availabilityRepository.save(availability);
      results.push(saved);
    }

    // Invalidar caché del menú después de actualización masiva
    await this.invalidateDishMenuCache(restaurantId);

    return {
      updated: results.length,
      results,
    };
  }

  /**
   * Obtener menú con disponibilidad incluida
   */
  async getMenuWithAvailability(restaurantId: string): Promise<any[]> {
    const cacheKey = `dishes:restaurant:${restaurantId}:menu`;

    // Intentar obtener de caché
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const dishes = await this.findByRestaurant(restaurantId);
    const availabilities = await this.getRestaurantAvailability(restaurantId);

    // Crear mapa de disponibilidad para lookup rápido
    const availabilityMap = new Map<string, boolean>();
    for (const av of availabilities) {
      availabilityMap.set(av.dishId, av.disponible);
    }

    // Agregar disponibilidad a cada plato
    const menu = dishes.items.map(dish => ({
      ...dish,
      disponible: availabilityMap.get(dish.id) ?? true, // Default: disponible
    }));

    // Guardar en caché por 10 minutos (600 segundos)
    await this.cacheManager.set(cacheKey, menu, 600).catch(() => {
      // Si falla guardar en caché, no bloquea la operación
    });

    return menu;
  }

  /**
   * Invalidar caché del menú de un restaurante
   */
  private async invalidateDishMenuCache(restaurantId: string): Promise<void> {
    const cacheKey = `dishes:restaurant:${restaurantId}:menu`;
    await this.cacheManager.del(cacheKey).catch(() => {
      // Si falla la invalidación, no bloquea la operación
    });
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

