import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DishesService } from './dishes.service';
import { Dish, DishType } from './entities/dish.entity';
import { Topping } from './entities/topping.entity';
import { DishAvailability } from './entities/dish-availability.entity';
import { Order } from '../orders/entities/order.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { BulkUpdateAvailabilityDto } from './dto/update-availability.dto';
import { DishSearchQueryDto, DishSearchOrderBy, DishSearchOrderDirection } from './dto/dish-search-query.dto';
import { BusinessException } from '../common/exceptions/business-exception';
import { ForbiddenAccessException } from '../common/exceptions/unauthorized-exception';
import { ResourceNotFoundException } from '../common/exceptions/not-found-exception';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { UserRole } from '../users/entities/user.entity';
import { BadRequestException } from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('DishesService', () => {
  let service: DishesService;
  let dishRepository: jest.Mocked<Repository<Dish>>;
  let toppingRepository: jest.Mocked<Repository<Topping>>;
  let availabilityRepository: jest.Mocked<Repository<DishAvailability>>;
  let orderRepository: jest.Mocked<Repository<Order>>;
  let restaurantsService: jest.Mocked<RestaurantsService>;
  let cacheManager: jest.Mocked<Cache>;

  const mockUserId = 'user-uuid-123';
  const mockRestaurantId = 'restaurant-uuid-456';
  const mockDishId = 'dish-uuid-789';
  const mockToppingId = 'topping-uuid-abc';

  const mockRestaurant: Restaurant = {
    id: mockRestaurantId,
    nombre: 'Test Restaurant',
    universityId: 'university-uuid',
    ownerId: mockUserId,
    activo: true,
    categorias: ['Pizza', 'Hamburguesas', 'Bebidas'],
    calificacion: 4.5,
    tiempoEntrega: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Restaurant;

  const mockTopping: Topping = {
    id: mockToppingId,
    nombre: 'Queso extra',
    precio: 2000,
    removible: false,
    categoria: 'Proteína',
    dishId: mockDishId,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Topping;

  const mockDish: Dish = {
    id: mockDishId,
    nombre: 'Pizza Margarita',
    descripcion: 'Pizza con queso y tomate',
    precio: 15000,
    categoria: 'Pizza',
    tipoPlato: DishType.SIMPLE,
    restaurantId: mockRestaurantId,
    activo: true,
    toppings: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Dish;

  const mockDishAvailability: DishAvailability = {
    id: 'availability-uuid',
    dishId: mockDishId,
    restaurantId: mockRestaurantId,
    disponible: true,
    updatedAt: new Date(),
  } as DishAvailability;

  const mockCreateDishDto: CreateDishDto = {
    nombre: 'Pizza Margarita',
    descripcion: 'Pizza con queso y tomate',
    precio: 15000,
    categoria: 'Pizza',
    tipoPlato: DishType.SIMPLE,
    restaurantId: mockRestaurantId,
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DishesService,
        {
          provide: getRepositoryToken(Dish),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Topping),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DishAvailability),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: RestaurantsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DishesService>(DishesService);
    dishRepository = module.get(getRepositoryToken(Dish));
    toppingRepository = module.get(getRepositoryToken(Topping));
    availabilityRepository = module.get(getRepositoryToken(DishAvailability));
    orderRepository = module.get(getRepositoryToken(Order));
    restaurantsService = module.get(RestaurantsService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('debe crear un plato SIMPLE sin toppings exitosamente', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.create.mockReturnValue(mockDish);
      dishRepository.save.mockResolvedValue(mockDish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.create(mockCreateDishDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(restaurantsService.findOne).toHaveBeenCalledWith(mockRestaurantId);
      expect(dishRepository.create).toHaveBeenCalledWith({
        ...mockCreateDishDto,
        toppings: [],
      });
      expect(dishRepository.save).toHaveBeenCalled();
      expect(cacheManager.del).toHaveBeenCalledWith(`dishes:restaurant:${mockRestaurantId}:menu`);
      expect(result).toEqual(mockDish);
    });

    it('debe crear un plato FIJO con toppings no removibles exitosamente', async () => {
      // Arrange
      const toppings = [
        { nombre: 'Queso', precio: 0, removible: false },
        { nombre: 'Tomate', precio: 0, removible: false },
      ];
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        tipoPlato: DishType.FIJO,
        toppings,
      };
      const mockToppings = toppings.map((t, idx) => ({
        ...mockTopping,
        id: `topping-${idx}`,
        nombre: t.nombre,
        precio: t.precio,
        removible: t.removible,
      }));
      const dishWithToppings = { ...mockDish, tipoPlato: DishType.FIJO, toppings: mockToppings };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.create.mockReturnValue(dishWithToppings as Dish);
      dishRepository.save.mockResolvedValue(dishWithToppings as Dish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(dishRepository.create).toHaveBeenCalledWith({
        ...createDto,
        toppings,
      });
      expect(result).toEqual(dishWithToppings);
    });

    it('debe crear un plato MIXTO con toppings removibles y no removibles exitosamente', async () => {
      // Arrange
      const toppings = [
        { nombre: 'Queso', precio: 2000, removible: false },
        { nombre: 'Cebolla', precio: 0, removible: true },
      ];
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        tipoPlato: DishType.MIXTO,
        toppings,
      };
      const mockToppings = toppings.map((t, idx) => ({
        ...mockTopping,
        id: `topping-${idx}`,
        nombre: t.nombre,
        precio: t.precio,
        removible: t.removible,
      }));
      const dishWithToppings = { ...mockDish, tipoPlato: DishType.MIXTO, toppings: mockToppings };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.create.mockReturnValue(dishWithToppings as Dish);
      dishRepository.save.mockResolvedValue(dishWithToppings as Dish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(result).toEqual(dishWithToppings);
    });

    it('debe crear un plato PERSONALIZABLE con toppings exitosamente', async () => {
      // Arrange
      const toppings = [
        { nombre: 'Queso extra', precio: 2000, removible: false },
        { nombre: 'Bacon', precio: 3000, removible: false },
      ];
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        tipoPlato: DishType.PERSONALIZABLE,
        toppings,
      };
      const mockToppings = toppings.map((t, idx) => ({
        ...mockTopping,
        id: `topping-${idx}`,
        nombre: t.nombre,
        precio: t.precio,
        removible: t.removible,
      }));
      const dishWithToppings = { ...mockDish, tipoPlato: DishType.PERSONALIZABLE, toppings: mockToppings };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.create.mockReturnValue(dishWithToppings as Dish);
      dishRepository.save.mockResolvedValue(dishWithToppings as Dish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(result).toEqual(dishWithToppings);
    });

    it('debe invalidar caché del menú después de crear', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.create.mockReturnValue(mockDish);
      dishRepository.save.mockResolvedValue(mockDish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      await service.create(mockCreateDishDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(cacheManager.del).toHaveBeenCalledWith(`dishes:restaurant:${mockRestaurantId}:menu`);
    });

    it('debe lanzar ForbiddenAccessException cuando no tiene permisos', async () => {
      // Arrange
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      // Act & Assert
      try {
        await service.create(mockCreateDishDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar ForbiddenAccessException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenAccessException);
        expect((error as ForbiddenAccessException).getResponse()).toHaveProperty('errorCode', 'DISH_CREATE_FORBIDDEN');
        expect(dishRepository.create).not.toHaveBeenCalled();
      }
    });

    it('debe permitir crear plato si es ADMIN aunque no sea owner', async () => {
      // Arrange
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);
      dishRepository.create.mockReturnValue(mockDish);
      dishRepository.save.mockResolvedValue(mockDish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.create(mockCreateDishDto, 'admin-id', UserRole.ADMIN);

      // Assert
      expect(result).toEqual(mockDish);
      expect(dishRepository.create).toHaveBeenCalled();
    });

    it('debe lanzar BusinessException cuando el precio > 1.000.000', async () => {
      // Arrange
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        precio: 1_000_001,
      };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      // Act & Assert
      try {
        await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'DISH_PRICE_OUT_OF_RANGE');
        expect(dishRepository.create).not.toHaveBeenCalled();
      }
    });

    it('debe lanzar BusinessException cuando la categoría no está configurada en el restaurante', async () => {
      // Arrange
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        categoria: 'Categoría Inexistente',
      };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      // Act & Assert
      try {
        await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'DISH_CATEGORY_INVALID');
        expect(dishRepository.create).not.toHaveBeenCalled();
      }
    });

    it('debe lanzar BadRequestException cuando SIMPLE tiene toppings', async () => {
      // Arrange
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        tipoPlato: DishType.SIMPLE,
        toppings: [{ nombre: 'Queso', precio: 0, removible: false }],
      };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      // Act & Assert
      try {
        await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(dishRepository.create).not.toHaveBeenCalled();
      }
    });

    it('debe lanzar BusinessException cuando FIJO tiene toppings removibles', async () => {
      // Arrange
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        tipoPlato: DishType.FIJO,
        toppings: [{ nombre: 'Cebolla', precio: 0, removible: true }],
      };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      // Act & Assert
      try {
        await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'DISH_TOPPING_INVALID');
        expect(dishRepository.create).not.toHaveBeenCalled();
      }
    });
  });

  describe('findByRestaurant', () => {
    it('debe retornar platos del restaurante con paginación', async () => {
      // Arrange
      const dishes = [mockDish];
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.findAndCount.mockResolvedValue([dishes, 1]);

      // Act
      const result = await service.findByRestaurant(mockRestaurantId);

      // Assert
      expect(restaurantsService.findOne).toHaveBeenCalledWith(mockRestaurantId);
      expect(dishRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          restaurantId: mockRestaurantId,
          activo: true,
        },
        relations: ['toppings'],
        order: {
          categoria: 'ASC',
          nombre: 'ASC',
        },
      });
      expect(result.items).toEqual(dishes);
      expect(result.meta.total).toBe(1);
    });

    it('debe incluir relaciones (toppings)', async () => {
      // Arrange
      const dishWithToppings = { ...mockDish, toppings: [mockTopping] };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.findAndCount.mockResolvedValue([[dishWithToppings], 1]);

      // Act
      const result = await service.findByRestaurant(mockRestaurantId);

      // Assert
      expect(result.items[0].toppings).toBeDefined();
    });

    it('debe aplicar paginación correctamente', async () => {
      // Arrange
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.limit = 10;
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.findAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.findByRestaurant(mockRestaurantId, pagination);

      // Assert
      expect(dishRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: pagination.skip,
          take: pagination.take,
        }),
      );
    });
  });

  describe('updateAvailability', () => {
    it('debe actualizar disponibilidad existente (upsert)', async () => {
      // Arrange
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      availabilityRepository.findOne.mockResolvedValue(mockDishAvailability);
      availabilityRepository.save.mockResolvedValue({
        ...mockDishAvailability,
        disponible: false,
      });
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.updateAvailability(
        mockDishId,
        mockRestaurantId,
        false,
        mockUserId,
        UserRole.RESTAURANT_OWNER,
      );

      // Assert
      expect(availabilityRepository.findOne).toHaveBeenCalledWith({
        where: { dishId: mockDishId, restaurantId: mockRestaurantId },
      });
      expect(availabilityRepository.save).toHaveBeenCalled();
      expect(result.disponible).toBe(false);
      expect(cacheManager.del).toHaveBeenCalledWith(`dishes:restaurant:${mockRestaurantId}:menu`);
    });

    it('debe crear nueva disponibilidad si no existe', async () => {
      // Arrange
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      availabilityRepository.findOne.mockResolvedValue(null);
      availabilityRepository.create.mockReturnValue(mockDishAvailability);
      availabilityRepository.save.mockResolvedValue(mockDishAvailability);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.updateAvailability(
        mockDishId,
        mockRestaurantId,
        true,
        mockUserId,
        UserRole.RESTAURANT_OWNER,
      );

      // Assert
      expect(availabilityRepository.create).toHaveBeenCalledWith({
        dishId: mockDishId,
        restaurantId: mockRestaurantId,
        disponible: true,
      });
      expect(availabilityRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockDishAvailability);
    });

    it('debe invalidar caché del menú después de actualizar', async () => {
      // Arrange
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      availabilityRepository.findOne.mockResolvedValue(mockDishAvailability);
      availabilityRepository.save.mockResolvedValue(mockDishAvailability);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      await service.updateAvailability(mockDishId, mockRestaurantId, false, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(cacheManager.del).toHaveBeenCalledWith(`dishes:restaurant:${mockRestaurantId}:menu`);
    });

    it('debe lanzar BadRequestException cuando el plato no pertenece al restaurante', async () => {
      // Arrange
      const dishFromOtherRestaurant = { ...mockDish, restaurantId: 'other-restaurant-id' };
      dishRepository.findOne.mockResolvedValue(dishFromOtherRestaurant);

      // Act & Assert
      try {
        await service.updateAvailability(
          mockDishId,
          mockRestaurantId,
          false,
          mockUserId,
          UserRole.RESTAURANT_OWNER,
        );
        fail('Debe lanzar BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(availabilityRepository.save).not.toHaveBeenCalled();
      }
    });

    it('debe lanzar ForbiddenAccessException cuando no tiene permisos', async () => {
      // Arrange
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      // Act & Assert
      try {
        await service.updateAvailability(
          mockDishId,
          mockRestaurantId,
          false,
          mockUserId,
          UserRole.RESTAURANT_OWNER,
        );
        fail('Debe lanzar ForbiddenAccessException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenAccessException);
        expect((error as ForbiddenAccessException).getResponse()).toHaveProperty('errorCode', 'DISH_AVAILABILITY_FORBIDDEN');
      }
    });
  });

  describe('getRestaurantAvailability', () => {
    it('debe retornar todas las disponibilidades del restaurante', async () => {
      // Arrange
      const availabilities = [mockDishAvailability];
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      availabilityRepository.find.mockResolvedValue(availabilities);

      // Act
      const result = await service.getRestaurantAvailability(mockRestaurantId);

      // Assert
      expect(restaurantsService.findOne).toHaveBeenCalledWith(mockRestaurantId);
      expect(availabilityRepository.find).toHaveBeenCalledWith({
        where: { restaurantId: mockRestaurantId },
        relations: ['dish'],
        order: {
          updatedAt: 'DESC',
        },
      });
      expect(result).toEqual(availabilities);
    });

    it('debe incluir relación con dish y ordenar por updatedAt DESC', async () => {
      // Arrange
      const availabilityWithDish = { ...mockDishAvailability, dish: mockDish };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      availabilityRepository.find.mockResolvedValue([availabilityWithDish]);

      // Act
      const result = await service.getRestaurantAvailability(mockRestaurantId);

      // Assert
      expect(result[0].dish).toBeDefined();
      expect(availabilityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['dish'],
          order: { updatedAt: 'DESC' },
        }),
      );
    });
  });

  describe('getMenuWithAvailability', () => {
    it('debe retornar menú desde caché si existe', async () => {
      // Arrange
      const cachedMenu = [{ ...mockDish, disponible: true }];
      cacheManager.get.mockResolvedValue(cachedMenu);

      // Act
      const result = await service.getMenuWithAvailability(mockRestaurantId);

      // Assert
      expect(cacheManager.get).toHaveBeenCalledWith(`dishes:restaurant:${mockRestaurantId}:menu`);
      expect(result).toEqual(cachedMenu);
      expect(dishRepository.findAndCount).not.toHaveBeenCalled();
    });

    it('debe generar menú si no está en caché', async () => {
      // Arrange
      const dishes = [mockDish];
      const availabilities = [{ ...mockDishAvailability, disponible: true }];
      cacheManager.get.mockResolvedValue(null);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.findAndCount.mockResolvedValue([dishes, 1]);
      availabilityRepository.find.mockResolvedValue(availabilities);
      cacheManager.set.mockResolvedValue(undefined);

      // Act
      const result = await service.getMenuWithAvailability(mockRestaurantId);

      // Assert
      expect(cacheManager.get).toHaveBeenCalled();
      expect(dishRepository.findAndCount).toHaveBeenCalled();
      expect(availabilityRepository.find).toHaveBeenCalled();
      expect(result[0]).toHaveProperty('disponible', true);
    });

    it('debe guardar en caché con TTL de 600 segundos', async () => {
      // Arrange
      cacheManager.get.mockResolvedValue(null);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.findAndCount.mockResolvedValue([[], 0]);
      availabilityRepository.find.mockResolvedValue([]);
      cacheManager.set.mockResolvedValue(undefined);

      // Act
      await service.getMenuWithAvailability(mockRestaurantId);

      // Assert
      expect(cacheManager.set).toHaveBeenCalledWith(
        `dishes:restaurant:${mockRestaurantId}:menu`,
        expect.any(Array),
        600,
      );
    });

    it('debe combinar platos con disponibilidad correctamente', async () => {
      // Arrange
      const dishes = [mockDish];
      const availabilities = [{ ...mockDishAvailability, disponible: false }];
      cacheManager.get.mockResolvedValue(null);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.findAndCount.mockResolvedValue([dishes, 1]);
      availabilityRepository.find.mockResolvedValue(availabilities);
      cacheManager.set.mockResolvedValue(undefined);

      // Act
      const result = await service.getMenuWithAvailability(mockRestaurantId);

      // Assert
      expect(result[0].disponible).toBe(false);
    });

    it('debe usar default disponible: true si no hay registro', async () => {
      // Arrange
      const dishes = [mockDish];
      cacheManager.get.mockResolvedValue(null);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.findAndCount.mockResolvedValue([dishes, 1]);
      availabilityRepository.find.mockResolvedValue([]);
      cacheManager.set.mockResolvedValue(undefined);

      // Act
      const result = await service.getMenuWithAvailability(mockRestaurantId);

      // Assert
      expect(result[0].disponible).toBe(true);
    });
  });

  describe('findOne', () => {
    it('debe retornar plato con relaciones (restaurant, toppings)', async () => {
      // Arrange
      const dishWithRelations = {
        ...mockDish,
        restaurant: mockRestaurant,
        toppings: [mockTopping],
      };
      dishRepository.findOne.mockResolvedValue(dishWithRelations);

      // Act
      const result = await service.findOne(mockDishId);

      // Assert
      expect(dishRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDishId },
        relations: ['restaurant', 'toppings'],
      });
      expect(result).toEqual(dishWithRelations);
    });

    it('debe lanzar ResourceNotFoundException cuando el plato no existe', async () => {
      // Arrange
      dishRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(mockDishId)).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('update', () => {
    it('debe actualizar plato exitosamente', async () => {
      // Arrange
      const updateDto: UpdateDishDto = {
        nombre: 'Pizza Margarita Actualizada',
        precio: 16000,
      };
      const updatedDish = { ...mockDish, ...updateDto };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.save.mockResolvedValue(updatedDish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.update(mockDishId, updateDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(dishRepository.save).toHaveBeenCalled();
      expect(result.nombre).toBe('Pizza Margarita Actualizada');
      expect(cacheManager.del).toHaveBeenCalledWith(`dishes:restaurant:${mockRestaurantId}:menu`);
    });

    it('debe validar precio si se proporciona', async () => {
      // Arrange
      const updateDto: UpdateDishDto = {
        precio: 1_000_001,
      };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      // Act & Assert
      try {
        await service.update(mockDishId, updateDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'DISH_PRICE_OUT_OF_RANGE');
      }
    });

    it('debe validar categoría si se proporciona', async () => {
      // Arrange
      const updateDto: UpdateDishDto = {
        categoria: 'Categoría Inexistente',
      };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      // Act & Assert
      try {
        await service.update(mockDishId, updateDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'DISH_CATEGORY_INVALID');
      }
    });

    it('debe invalidar caché después de actualizar', async () => {
      // Arrange
      const updateDto: UpdateDishDto = { nombre: 'Nuevo Nombre' };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.save.mockResolvedValue(mockDish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      await service.update(mockDishId, updateDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(cacheManager.del).toHaveBeenCalledWith(`dishes:restaurant:${mockRestaurantId}:menu`);
    });

    it('debe lanzar ForbiddenAccessException cuando no tiene permisos', async () => {
      // Arrange
      const updateDto: UpdateDishDto = { nombre: 'Nuevo Nombre' };
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      // Act & Assert
      try {
        await service.update(mockDishId, updateDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar ForbiddenAccessException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenAccessException);
        expect((error as ForbiddenAccessException).getResponse()).toHaveProperty('errorCode', 'DISH_UPDATE_FORBIDDEN');
      }
    });

    it('debe lanzar BadRequestException cuando precio < 1', async () => {
      // Arrange
      const updateDto: UpdateDishDto = { precio: 0 };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      // Act & Assert
      try {
        await service.update(mockDishId, updateDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
      }
    });
  });

  describe('remove', () => {
    it('debe eliminar plato exitosamente', async () => {
      // Arrange
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.remove.mockResolvedValue(mockDish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      await service.remove(mockDishId, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(dishRepository.remove).toHaveBeenCalledWith(mockDish);
      expect(cacheManager.del).toHaveBeenCalledWith(`dishes:restaurant:${mockRestaurantId}:menu`);
    });

    it('debe invalidar caché después de eliminar', async () => {
      // Arrange
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.remove.mockResolvedValue(mockDish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      await service.remove(mockDishId, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(cacheManager.del).toHaveBeenCalled();
    });

    it('debe lanzar ForbiddenAccessException cuando no tiene permisos', async () => {
      // Arrange
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      // Act & Assert
      try {
        await service.remove(mockDishId, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar ForbiddenAccessException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenAccessException);
        expect((error as ForbiddenAccessException).getResponse()).toHaveProperty('errorCode', 'DISH_DELETE_FORBIDDEN');
      }
    });
  });

  describe('toggleActive', () => {
    it('debe cambiar estado activo/inactivo', async () => {
      // Arrange
      const activeDish = { ...mockDish, activo: true };
      dishRepository.findOne.mockResolvedValue(activeDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.save.mockResolvedValue({ ...activeDish, activo: false });
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.toggleActive(mockDishId, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(result.activo).toBe(false);
      expect(cacheManager.del).toHaveBeenCalled();
    });

    it('debe invalidar caché después de cambiar estado', async () => {
      // Arrange
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.save.mockResolvedValue(mockDish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      await service.toggleActive(mockDishId, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(cacheManager.del).toHaveBeenCalledWith(`dishes:restaurant:${mockRestaurantId}:menu`);
    });

    it('debe lanzar ForbiddenAccessException cuando no tiene permisos', async () => {
      // Arrange
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      // Act & Assert
      try {
        await service.toggleActive(mockDishId, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar ForbiddenAccessException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenAccessException);
        expect((error as ForbiddenAccessException).getResponse()).toHaveProperty('errorCode', 'DISH_STATUS_FORBIDDEN');
      }
    });
  });

  describe('calculatePrice', () => {
    it('debe calcular precio base sin toppings', () => {
      // Arrange
      const dish = { ...mockDish, precio: 15000, toppings: [] };

      // Act
      const result = service.calculatePrice(dish, []);

      // Assert
      expect(result).toBe(15000);
    });

    it('debe calcular precio con toppings adicionales (no removibles)', () => {
      // Arrange
      const toppings = [
        { ...mockTopping, id: 'topping-1', precio: 2000, removible: false },
        { ...mockTopping, id: 'topping-2', precio: 3000, removible: false },
      ];
      const dish = { ...mockDish, precio: 15000, toppings };

      // Act
      const result = service.calculatePrice(dish, ['topping-1', 'topping-2']);

      // Assert
      expect(result).toBe(20000); // 15000 + 2000 + 3000
    });

    it('debe no agregar precio de toppings removibles', () => {
      // Arrange
      const toppings = [
        { ...mockTopping, id: 'topping-1', precio: 2000, removible: false },
        { ...mockTopping, id: 'topping-2', precio: 1000, removible: true },
      ];
      const dish = { ...mockDish, precio: 15000, toppings };

      // Act
      const result = service.calculatePrice(dish, ['topping-1', 'topping-2']);

      // Assert
      expect(result).toBe(17000); // 15000 + 2000 (solo el no removible)
    });

    it('debe manejar toppings no encontrados', () => {
      // Arrange
      const dish = { ...mockDish, precio: 15000, toppings: [] };

      // Act
      const result = service.calculatePrice(dish, ['topping-inexistente']);

      // Assert
      expect(result).toBe(15000); // Solo precio base
    });
  });

  describe('addTopping', () => {
    it('debe agregar topping exitosamente', async () => {
      // Arrange
      const toppingData = { nombre: 'Queso extra', precio: 2000, removible: false };
      const dishWithToppings = { ...mockDish, toppings: [mockTopping] };
      dishRepository.findOne
        .mockResolvedValueOnce(mockDish)
        .mockResolvedValueOnce(dishWithToppings);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      toppingRepository.create.mockReturnValue(mockTopping);
      toppingRepository.save.mockResolvedValue(mockTopping);

      // Act
      const result = await service.addTopping(mockDishId, toppingData, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(toppingRepository.create).toHaveBeenCalledWith({
        ...toppingData,
        dishId: mockDishId,
      });
      expect(toppingRepository.save).toHaveBeenCalled();
      expect(result).toEqual(dishWithToppings);
    });

    it('debe lanzar ForbiddenAccessException cuando no tiene permisos', async () => {
      // Arrange
      const toppingData = { nombre: 'Queso extra', precio: 2000 };
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      // Act & Assert
      try {
        await service.addTopping(mockDishId, toppingData, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar ForbiddenAccessException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenAccessException);
        expect((error as ForbiddenAccessException).getResponse()).toHaveProperty('errorCode', 'DISH_TOPPING_FORBIDDEN');
      }
    });
  });

  describe('removeTopping', () => {
    it('debe eliminar topping exitosamente', async () => {
      // Arrange
      const dishWithToppings = { ...mockDish, toppings: [mockTopping] };
      dishRepository.findOne
        .mockResolvedValueOnce(mockDish)
        .mockResolvedValueOnce(dishWithToppings);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      toppingRepository.findOne.mockResolvedValue(mockTopping);
      toppingRepository.remove.mockResolvedValue(mockTopping);

      // Act
      const result = await service.removeTopping(mockDishId, mockToppingId, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(toppingRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockToppingId, dishId: mockDishId },
      });
      expect(toppingRepository.remove).toHaveBeenCalledWith(mockTopping);
      expect(result).toEqual(dishWithToppings);
    });

    it('debe lanzar ResourceNotFoundException cuando el topping no existe', async () => {
      // Arrange
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      toppingRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      try {
        await service.removeTopping(mockDishId, mockToppingId, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar ResourceNotFoundException');
      } catch (error) {
        expect(error).toBeInstanceOf(ResourceNotFoundException);
      }
    });

    it('debe lanzar ForbiddenAccessException cuando no tiene permisos', async () => {
      // Arrange
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      dishRepository.findOne.mockResolvedValue(mockDish);
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      // Act & Assert
      try {
        await service.removeTopping(mockDishId, mockToppingId, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar ForbiddenAccessException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenAccessException);
        expect((error as ForbiddenAccessException).getResponse()).toHaveProperty('errorCode', 'DISH_TOPPING_FORBIDDEN');
      }
    });
  });

  describe('validateToppingsByDishType', () => {
    it('debe permitir SIMPLE sin toppings', () => {
      // Arrange
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        tipoPlato: DishType.SIMPLE,
        toppings: undefined,
      };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.create.mockReturnValue(mockDish);
      dishRepository.save.mockResolvedValue(mockDish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act & Assert - No debe lanzar error
      expect(async () => {
        await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);
      }).not.toThrow();
    });

    it('debe rechazar SIMPLE con toppings', async () => {
      // Arrange
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        tipoPlato: DishType.SIMPLE,
        toppings: [{ nombre: 'Queso', precio: 0, removible: false }],
      };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      // Act & Assert
      try {
        await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
      }
    });

    it('debe permitir FIJO con toppings no removibles', async () => {
      // Arrange
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        tipoPlato: DishType.FIJO,
        toppings: [{ nombre: 'Queso', precio: 0, removible: false }],
      };
      const mockToppings = [{ ...mockTopping, nombre: 'Queso', precio: 0, removible: false }];
      const dishWithToppings = { ...mockDish, tipoPlato: DishType.FIJO, toppings: mockToppings };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.create.mockReturnValue(dishWithToppings as Dish);
      dishRepository.save.mockResolvedValue(dishWithToppings as Dish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert - No debe lanzar error
      expect(result).toBeDefined();
    });

    it('debe rechazar FIJO con toppings removibles', async () => {
      // Arrange
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        tipoPlato: DishType.FIJO,
        toppings: [{ nombre: 'Cebolla', precio: 0, removible: true }],
      };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      // Act & Assert
      try {
        await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'DISH_TOPPING_INVALID');
      }
    });

    it('debe permitir MIXTO y PERSONALIZABLE con cualquier topping', async () => {
      // Arrange
      const toppings = [
        { nombre: 'Queso', precio: 2000, removible: false },
        { nombre: 'Cebolla', precio: 0, removible: true },
      ];
      const createDto: CreateDishDto = {
        ...mockCreateDishDto,
        tipoPlato: DishType.MIXTO,
        toppings,
      };
      const mockToppings = toppings.map((t, idx) => ({
        ...mockTopping,
        id: `topping-${idx}`,
        nombre: t.nombre,
        precio: t.precio,
        removible: t.removible,
      }));
      const dishWithToppings = { ...mockDish, tipoPlato: DishType.MIXTO, toppings: mockToppings };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.create.mockReturnValue(dishWithToppings as Dish);
      dishRepository.save.mockResolvedValue(dishWithToppings as Dish);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.create(createDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert - No debe lanzar error
      expect(result).toBeDefined();
    });
  });

  describe('checkAvailability', () => {
    it('debe retornar true si no hay registro (default disponible)', async () => {
      // Arrange
      availabilityRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.checkAvailability(mockDishId, mockRestaurantId);

      // Assert
      expect(result).toBe(true);
      expect(availabilityRepository.findOne).toHaveBeenCalledWith({
        where: { dishId: mockDishId, restaurantId: mockRestaurantId },
      });
    });

    it('debe retornar estado real si existe registro', async () => {
      // Arrange
      const available = { ...mockDishAvailability, disponible: true };
      availabilityRepository.findOne.mockResolvedValue(available);

      // Act
      const result = await service.checkAvailability(mockDishId, mockRestaurantId);

      // Assert
      expect(result).toBe(true);

      // Test con disponible: false
      const unavailable = { ...mockDishAvailability, disponible: false };
      availabilityRepository.findOne.mockResolvedValue(unavailable);
      const result2 = await service.checkAvailability(mockDishId, mockRestaurantId);
      expect(result2).toBe(false);
    });
  });

  describe('bulkUpdateAvailability', () => {
    it('debe actualizar múltiples platos exitosamente', async () => {
      // Arrange
      const bulkDto: BulkUpdateAvailabilityDto = {
        changes: [
          { dishId: mockDishId, disponible: false },
          { dishId: 'dish-2', disponible: true },
        ],
      };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.findOne
        .mockResolvedValueOnce(mockDish)
        .mockResolvedValueOnce({ ...mockDish, id: 'dish-2' });
      availabilityRepository.findOne
        .mockResolvedValueOnce(mockDishAvailability)
        .mockResolvedValueOnce(null);
      availabilityRepository.create.mockReturnValue(mockDishAvailability);
      availabilityRepository.save
        .mockResolvedValueOnce({ ...mockDishAvailability, disponible: false })
        .mockResolvedValueOnce(mockDishAvailability);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.bulkUpdateAvailability(mockRestaurantId, bulkDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(result.updated).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(cacheManager.del).toHaveBeenCalled();
    });

    it('debe omitir platos que no existen o no pertenecen al restaurante', async () => {
      // Arrange
      const bulkDto: BulkUpdateAvailabilityDto = {
        changes: [
          { dishId: mockDishId, disponible: false },
          { dishId: 'dish-inexistente', disponible: true },
        ],
      };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.findOne
        .mockResolvedValueOnce(mockDish)
        .mockResolvedValueOnce(null); // Plato no existe
      availabilityRepository.findOne.mockResolvedValue(mockDishAvailability);
      availabilityRepository.save.mockResolvedValue(mockDishAvailability);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      const result = await service.bulkUpdateAvailability(mockRestaurantId, bulkDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(result.updated).toBe(1); // Solo se actualizó el plato que existe
      expect(result.results).toHaveLength(1);
    });

    it('debe invalidar caché después de actualización masiva', async () => {
      // Arrange
      const bulkDto: BulkUpdateAvailabilityDto = {
        changes: [{ dishId: mockDishId, disponible: false }],
      };
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishRepository.findOne.mockResolvedValue(mockDish);
      availabilityRepository.findOne.mockResolvedValue(mockDishAvailability);
      availabilityRepository.save.mockResolvedValue(mockDishAvailability);
      cacheManager.del.mockResolvedValue(undefined);

      // Act
      await service.bulkUpdateAvailability(mockRestaurantId, bulkDto, mockUserId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(cacheManager.del).toHaveBeenCalledWith(`dishes:restaurant:${mockRestaurantId}:menu`);
    });

    it('debe lanzar ForbiddenAccessException cuando no tiene permisos', async () => {
      // Arrange
      const bulkDto: BulkUpdateAvailabilityDto = {
        changes: [{ dishId: mockDishId, disponible: false }],
      };
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      // Act & Assert
      try {
        await service.bulkUpdateAvailability(mockRestaurantId, bulkDto, mockUserId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar ForbiddenAccessException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenAccessException);
        expect((error as ForbiddenAccessException).getResponse()).toHaveProperty('errorCode', 'DISH_AVAILABILITY_FORBIDDEN');
      }
    });
  });

  describe('search', () => {
    it('debe buscar platos por nombre con ILIKE', async () => {
      // Arrange
      const dishes = [mockDish];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([dishes, 1]);

      // Act
      const result = await service.search('pizza');

      // Assert
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('dish.nombre ILIKE :query', { query: '%pizza%' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('dish.activo = :activo', { activo: true });
      expect(result.items).toEqual(dishes);
    });

    it('debe aplicar paginación correctamente', async () => {
      // Arrange
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.limit = 10;
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.search('pizza', pagination);

      // Assert
      expect(mockQueryBuilder.skip).toHaveBeenCalled();
      expect(mockQueryBuilder.take).toHaveBeenCalled();
    });
  });

  describe('searchAdvanced', () => {
    it('debe buscar con filtros (restaurante, categoría, precio)', async () => {
      // Arrange
      const searchDto = Object.assign(new DishSearchQueryDto(), {
        q: 'pizza',
        restaurantId: mockRestaurantId,
        categoria: 'Pizza',
        precioMin: 10000,
        precioMax: 20000,
        page: 1,
        limit: 10,
      });
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.searchAdvanced(searchDto);

      // Assert
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('debe ordenar por nombre', async () => {
      // Arrange
      const searchDto = Object.assign(new DishSearchQueryDto(), {
        q: 'pizza',
        orderBy: DishSearchOrderBy.NOMBRE,
        orderDirection: DishSearchOrderDirection.ASC,
        page: 1,
        limit: 10,
      });
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.searchAdvanced(searchDto);

      // Assert
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('dish.nombre', 'ASC');
    });

    it('debe ordenar por precio', async () => {
      // Arrange
      const searchDto = Object.assign(new DishSearchQueryDto(), {
        q: 'pizza',
        orderBy: DishSearchOrderBy.PRECIO,
        orderDirection: DishSearchOrderDirection.DESC,
        page: 1,
        limit: 10,
      });
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.searchAdvanced(searchDto);

      // Assert
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('dish.precio', 'DESC');
    });

    it('debe ordenar por popularidad (con subquery)', async () => {
      // Arrange
      const searchDto = Object.assign(new DishSearchQueryDto(), {
        q: 'pizza',
        orderBy: DishSearchOrderBy.POPULARIDAD,
        orderDirection: DishSearchOrderDirection.DESC,
        page: 1,
        limit: 10,
      });
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.searchAdvanced(searchDto);

      // Assert
      expect(mockQueryBuilder.addSelect).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('popularity_count', 'DESC');
    });

    it('debe aplicar paginación', async () => {
      // Arrange
      const searchDto = Object.assign(new DishSearchQueryDto(), {
        q: 'pizza',
        page: 1,
        limit: 10,
      });
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.searchAdvanced(searchDto);

      // Assert
      expect(mockQueryBuilder.skip).toHaveBeenCalled();
      expect(mockQueryBuilder.take).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe retornar todos los platos activos con paginación', async () => {
      // Arrange
      const dishes = [mockDish];
      dishRepository.findAndCount.mockResolvedValue([dishes, 1]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(dishRepository.findAndCount).toHaveBeenCalledWith({
        where: { activo: true },
        relations: ['restaurant', 'toppings'],
        order: {
          nombre: 'ASC',
        },
      });
      expect(result.items).toEqual(dishes);
      expect(result.meta.total).toBe(1);
    });

    it('debe incluir relaciones (restaurant, toppings)', async () => {
      // Arrange
      const dishWithRelations = {
        ...mockDish,
        restaurant: mockRestaurant,
        toppings: [mockTopping],
      };
      dishRepository.findAndCount.mockResolvedValue([[dishWithRelations], 1]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result.items[0].restaurant).toBeDefined();
      expect(result.items[0].toppings).toBeDefined();
    });
  });

  describe('findByCategory', () => {
    it('debe retornar platos por categoría con paginación', async () => {
      // Arrange
      const dishes = [mockDish];
      dishRepository.findAndCount.mockResolvedValue([dishes, 1]);

      // Act
      const result = await service.findByCategory('Pizza');

      // Assert
      expect(dishRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          categoria: 'Pizza',
          activo: true,
        },
        relations: ['restaurant', 'toppings'],
        order: {
          nombre: 'ASC',
        },
      });
      expect(result.items).toEqual(dishes);
    });

    it('debe incluir relaciones', async () => {
      // Arrange
      const dishWithRelations = {
        ...mockDish,
        restaurant: mockRestaurant,
        toppings: [mockTopping],
      };
      dishRepository.findAndCount.mockResolvedValue([[dishWithRelations], 1]);

      // Act
      const result = await service.findByCategory('Pizza');

      // Assert
      expect(result.items[0].restaurant).toBeDefined();
      expect(result.items[0].toppings).toBeDefined();
    });
  });
});
