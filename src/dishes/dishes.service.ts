import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dish, DishType } from './entities/dish.entity';
import { Topping } from './entities/topping.entity';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class DishesService {
  constructor(
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    @InjectRepository(Topping)
    private readonly toppingRepository: Repository<Topping>,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  /**
   * Crear un nuevo plato con toppings
   */
  async create(createDishDto: CreateDishDto, userId: string, userRole: string): Promise<Dish> {
    // Verificar que el restaurante existe y el usuario es el dueño
    const restaurant = await this.restaurantsService.findOne(createDishDto.restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el dueño del restaurante puede crear platos');
    }

    // Validar toppings según tipo de plato
    this.validateToppingsByDishType(createDishDto.tipoPlato, createDishDto.toppings);

    // Crear el plato con toppings
    const dish = this.dishRepository.create({
      ...createDishDto,
      toppings: createDishDto.toppings || [],
    });

    return await this.dishRepository.save(dish);
  }

  /**
   * Obtener todos los platos activos
   */
  async findAll(): Promise<Dish[]> {
    return await this.dishRepository.find({
      where: { activo: true },
      relations: ['restaurant', 'toppings'],
      order: {
        nombre: 'ASC',
      },
    });
  }

  /**
   * Obtener platos por restaurante
   */
  async findByRestaurant(restaurantId: string): Promise<Dish[]> {
    // Verificar que el restaurante existe
    await this.restaurantsService.findOne(restaurantId);

    return await this.dishRepository.find({
      where: {
        restaurantId,
        activo: true,
      },
      relations: ['toppings'],
      order: {
        categoria: 'ASC',
        nombre: 'ASC',
      },
    });
  }

  /**
   * Obtener platos por categoría
   */
  async findByCategory(categoria: string): Promise<Dish[]> {
    return await this.dishRepository.find({
      where: {
        categoria,
        activo: true,
      },
      relations: ['restaurant', 'toppings'],
      order: {
        nombre: 'ASC',
      },
    });
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
      throw new NotFoundException(`Plato con ID ${id} no encontrado`);
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
      throw new ForbiddenException('Solo el dueño del restaurante puede actualizar este plato');
    }

    // Validar precio si se proporciona
    if (updateDishDto.precio !== undefined && updateDishDto.precio < 1) {
      throw new BadRequestException('El precio debe ser mayor a 0');
    }

    // Aplicar cambios
    Object.assign(dish, updateDishDto);

    return await this.dishRepository.save(dish);
  }

  /**
   * Eliminar un plato
   */
  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const dish = await this.findOne(id);

    // Verificar permisos
    const restaurant = await this.restaurantsService.findOne(dish.restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el dueño del restaurante puede eliminar este plato');
    }

    await this.dishRepository.remove(dish);
  }

  /**
   * Cambiar estado activo/inactivo del plato
   */
  async toggleActive(id: string, userId: string, userRole: string): Promise<Dish> {
    const dish = await this.findOne(id);

    // Verificar permisos
    const restaurant = await this.restaurantsService.findOne(dish.restaurantId);
    
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permisos para cambiar el estado de este plato');
    }

    dish.activo = !dish.activo;

    return await this.dishRepository.save(dish);
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
      throw new ForbiddenException('Solo el dueño del restaurante puede agregar toppings');
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
      throw new ForbiddenException('Solo el dueño del restaurante puede eliminar toppings');
    }

    const topping = await this.toppingRepository.findOne({
      where: { id: toppingId, dishId },
    });

    if (!topping) {
      throw new NotFoundException('Topping no encontrado');
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
          throw new BadRequestException('Los platos tipo FIJO no pueden tener ingredientes removibles');
        }
        break;

      case DishType.MIXTO:
      case DishType.PERSONALIZABLE:
        // Pueden tener cualquier combinación de toppings
        break;

      default:
        throw new BadRequestException('Tipo de plato inválido');
    }
  }

  /**
   * Buscar platos por nombre
   */
  async search(query: string): Promise<Dish[]> {
    return await this.dishRepository
      .createQueryBuilder('dish')
      .where('dish.nombre ILIKE :query', { query: `%${query}%` })
      .andWhere('dish.activo = :activo', { activo: true })
      .leftJoinAndSelect('dish.restaurant', 'restaurant')
      .leftJoinAndSelect('dish.toppings', 'toppings')
      .orderBy('dish.nombre', 'ASC')
      .getMany();
  }
}

