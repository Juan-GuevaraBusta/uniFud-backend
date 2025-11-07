import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant } from './entities/restaurant.entity';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { UniversitiesService } from '../universities/universities.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    private readonly universitiesService: UniversitiesService,
  ) {}

  /**
   * Crear un nuevo restaurante
   */
  async create(createRestaurantDto: CreateRestaurantDto, ownerId: string, userRole: string): Promise<Restaurant> {
    // Validar que el usuario sea restaurant_owner
    if (userRole !== UserRole.RESTAURANT_OWNER && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo los propietarios de restaurantes pueden crear restaurantes');
    }

    // Verificar que la universidad exista
    await this.universitiesService.findOne(createRestaurantDto.universityId);

    // Verificar que el usuario no tenga ya un restaurante
    const existingRestaurant = await this.restaurantRepository.findOne({
      where: { ownerId },
    });

    if (existingRestaurant) {
      throw new ConflictException('Ya tienes un restaurante registrado. Solo puedes tener un restaurante por cuenta.');
    }

    // Verificar que no exista un restaurante con el mismo nombre en la misma universidad
    const duplicateRestaurant = await this.restaurantRepository.findOne({
      where: {
        nombre: createRestaurantDto.nombre,
        universityId: createRestaurantDto.universityId,
      },
    });

    if (duplicateRestaurant) {
      throw new ConflictException(
        `Ya existe un restaurante con el nombre "${createRestaurantDto.nombre}" en esta universidad`
      );
    }

    // Crear el restaurante
    const restaurant = this.restaurantRepository.create({
      ...createRestaurantDto,
      ownerId,
      calificacion: 0, // Calificación inicial
      tiempoEntrega: createRestaurantDto.tiempoEntrega || 20, // Default 20 minutos
    });

    return await this.restaurantRepository.save(restaurant);
  }

  /**
   * Obtener todos los restaurantes
   */
  async findAll(): Promise<Restaurant[]> {
    return await this.restaurantRepository.find({
      relations: ['university'],
      where: { activo: true },
      order: {
        nombre: 'ASC',
      },
    });
  }

  /**
   * Obtener restaurantes por universidad
   */
  async findByUniversity(universityId: string): Promise<Restaurant[]> {
    // Verificar que la universidad exista
    await this.universitiesService.findOne(universityId);

    return await this.restaurantRepository.find({
      where: {
        universityId,
        activo: true,
      },
      relations: ['university'],
      order: {
        calificacion: 'DESC',
        nombre: 'ASC',
      },
    });
  }

  /**
   * Obtener restaurante por owner (dueño)
   */
  async findByOwner(ownerId: string): Promise<Restaurant | null> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { ownerId },
      relations: ['university', 'owner'],
    });

    return restaurant;
  }

  /**
   * Obtener un restaurante por ID
   */
  async findOne(id: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id },
      relations: ['university', 'owner'],
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurante con ID ${id} no encontrado`);
    }

    return restaurant;
  }

  /**
   * Actualizar un restaurante
   */
  async update(id: string, updateRestaurantDto: UpdateRestaurantDto, userId: string, userRole: string): Promise<Restaurant> {
    const restaurant = await this.findOne(id);

    // Verificar permisos: solo el dueño o un admin pueden actualizar
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permisos para actualizar este restaurante');
    }

    // Si se actualiza el nombre o universidad, verificar unicidad
    if (updateRestaurantDto.nombre || updateRestaurantDto.universityId) {
      const nombre = updateRestaurantDto.nombre || restaurant.nombre;
      const universityId = updateRestaurantDto.universityId || restaurant.universityId;

      // Si se cambia la universidad, verificar que exista
      if (updateRestaurantDto.universityId && updateRestaurantDto.universityId !== restaurant.universityId) {
        await this.universitiesService.findOne(updateRestaurantDto.universityId);
      }

      const duplicateRestaurant = await this.restaurantRepository.findOne({
        where: { nombre, universityId },
      });

      if (duplicateRestaurant && duplicateRestaurant.id !== id) {
        throw new ConflictException(
          `Ya existe un restaurante con el nombre "${nombre}" en esta universidad`
        );
      }
    }

    // Validar calificación si se proporciona
    if (updateRestaurantDto.calificacion !== undefined) {
      if (updateRestaurantDto.calificacion < 0 || updateRestaurantDto.calificacion > 5) {
        throw new BadRequestException('La calificación debe estar entre 0 y 5');
      }
    }

    // Aplicar cambios
    Object.assign(restaurant, updateRestaurantDto);

    return await this.restaurantRepository.save(restaurant);
  }

  /**
   * Eliminar un restaurante
   */
  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const restaurant = await this.findOne(id);

    // Verificar permisos: solo el dueño o un admin pueden eliminar
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permisos para eliminar este restaurante');
    }

    await this.restaurantRepository.remove(restaurant);
  }

  /**
   * Cambiar estado activo/inactivo del restaurante
   */
  async toggleActive(id: string, userId: string, userRole: string): Promise<Restaurant> {
    const restaurant = await this.findOne(id);

    // Verificar permisos
    if (restaurant.ownerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No tienes permisos para cambiar el estado de este restaurante');
    }

    restaurant.activo = !restaurant.activo;

    return await this.restaurantRepository.save(restaurant);
  }
}


