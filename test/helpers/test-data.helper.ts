import { INestApplication } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { User, UserRole } from '../../src/users/entities/user.entity';
import { University } from '../../src/universities/entities/university.entity';
import { Restaurant } from '../../src/restaurants/entities/restaurant.entity';
import { Dish, DishType } from '../../src/dishes/entities/dish.entity';
import { Topping } from '../../src/dishes/entities/topping.entity';
import { DishAvailability } from '../../src/dishes/entities/dish-availability.entity';
import { Order, OrderStatus } from '../../src/orders/entities/order.entity';
import { UserCard } from '../../src/payments/entities/user-card.entity';

export interface CreateTestUserOptions {
  email?: string;
  password?: string;
  nombre?: string;
  role?: UserRole;
}

export interface CreateTestUniversityOptions {
  nombre?: string;
  ciudad?: string;
  imagen?: string;
}

export interface CreateTestRestaurantOptions {
  nombre?: string;
  universityId: string;
  ownerId: string;
  categorias?: string[];
  calificacion?: number;
  tiempoEntrega?: number;
  activo?: boolean;
}

export interface CreateTestDishOptions {
  nombre?: string;
  descripcion?: string;
  precio?: number;
  categoria?: string;
  tipoPlato?: DishType;
  restaurantId: string;
  activo?: boolean;
  toppings?: Array<{
    nombre: string;
    precio?: number;
    removible?: boolean;
    categoria?: string;
  }>;
}

export interface CreateTestOrderOptions {
  userId: string;
  restaurantId: string;
  items: Array<{
    dishId: string;
    dishNombre: string;
    cantidad: number;
    precioUnitario: number;
    precioTotal: number;
    toppings?: Array<{ id: string; nombre: string }>;
    comentarios?: string;
  }>;
  comentariosCliente?: string;
  paymentSourceId?: string;
}

export interface CreateTestCardOptions {
  userId: string;
  token?: string;
  acceptanceToken?: string;
  acceptPersonalAuth?: string;
  isDefault?: boolean;
}

/**
 * Crea un usuario de prueba
 */
export async function createTestUser(
  app: INestApplication,
  module: TestingModule,
  options: CreateTestUserOptions = {},
): Promise<{ user: User; token: string }> {
  const timestamp = Date.now();
  const email = options.email || `test-user-${timestamp}@example.com`;
  const password = options.password || 'Test123456!';
  const nombre = options.nombre || `Test User ${timestamp}`;
  const role = options.role || UserRole.STUDENT;

  // Registrar usuario
  const registerResponse = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email,
      password,
      nombre,
      role,
    });

  if (registerResponse.status !== 201) {
    throw new Error(
      `Error al crear usuario: ${registerResponse.status} - ${JSON.stringify(registerResponse.body)}`,
    );
  }

  const userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  const user = await userRepository.findOne({ where: { email: email.toLowerCase() } });

  if (!user) {
    throw new Error('Usuario no encontrado después de registro');
  }

  // Confirmar email
  if (user.verificationCode) {
    await request(app.getHttpServer())
      .post('/auth/confirm-email')
      .send({
        email: email.toLowerCase(),
        code: user.verificationCode,
      });
  }

  // Login
  const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
    email: email.toLowerCase(),
    password,
  });

  if (loginResponse.status !== 200) {
    throw new Error(
      `Error al hacer login: ${loginResponse.status} - ${JSON.stringify(loginResponse.body)}`,
    );
  }

  const token = loginResponse.body.data?.accessToken || loginResponse.body.accessToken;

  // Obtener usuario actualizado
  const updatedUser = await userRepository.findOne({ where: { email: email.toLowerCase() } });

  return {
    user: updatedUser!,
    token,
  };
}

/**
 * Crea una universidad de prueba
 */
export async function createTestUniversity(
  module: TestingModule,
  options: CreateTestUniversityOptions = {},
): Promise<University> {
  const timestamp = Date.now();
  const universityRepository = module.get<Repository<University>>(getRepositoryToken(University));

  const university = universityRepository.create({
    nombre: options.nombre || `Universidad de Prueba ${timestamp}`,
    ciudad: options.ciudad || 'Bogotá',
    imagen: options.imagen,
  });

  return await universityRepository.save(university);
}

/**
 * Crea un restaurante de prueba
 */
export async function createTestRestaurant(
  module: TestingModule,
  options: CreateTestRestaurantOptions,
): Promise<Restaurant> {
  const timestamp = Date.now();
  const restaurantRepository = module.get<Repository<Restaurant>>(
    getRepositoryToken(Restaurant),
  );

  const restaurant = restaurantRepository.create({
    nombre: options.nombre || `Restaurante de Prueba ${timestamp}`,
    universityId: options.universityId,
    ownerId: options.ownerId,
    categorias: options.categorias || ['Pizza', 'Hamburguesas'],
    calificacion: options.calificacion ?? 4.5,
    tiempoEntrega: options.tiempoEntrega ?? 20,
    activo: options.activo !== undefined ? options.activo : true,
  });

  return await restaurantRepository.save(restaurant);
}

/**
 * Crea un plato de prueba
 */
export async function createTestDish(
  module: TestingModule,
  options: CreateTestDishOptions,
): Promise<Dish> {
  const timestamp = Date.now();
  const dishRepository = module.get<Repository<Dish>>(getRepositoryToken(Dish));
  const toppingRepository = module.get<Repository<Topping>>(getRepositoryToken(Topping));

  const dish = dishRepository.create({
    nombre: options.nombre || `Plato de Prueba ${timestamp}`,
    descripcion: options.descripcion || 'Descripción de prueba',
    precio: options.precio || 15000,
    categoria: options.categoria || 'General',
    tipoPlato: options.tipoPlato || DishType.SIMPLE,
    restaurantId: options.restaurantId,
    activo: options.activo !== undefined ? options.activo : true,
  });

  const savedDish = await dishRepository.save(dish);

  // Crear toppings si se proporcionan
  if (options.toppings && options.toppings.length > 0) {
    const toppings = options.toppings.map((topping) =>
      toppingRepository.create({
        nombre: topping.nombre,
        precio: topping.precio || 0,
        removible: topping.removible || false,
        categoria: topping.categoria,
        dishId: savedDish.id,
      }),
    );
    await toppingRepository.save(toppings);
  }

  return savedDish;
}

/**
 * Crea disponibilidad para un plato
 */
export async function createTestAvailability(
  module: TestingModule,
  dishId: string,
  restaurantId: string,
  disponible: boolean = true,
): Promise<DishAvailability> {
  const availabilityRepository = module.get<Repository<DishAvailability>>(
    getRepositoryToken(DishAvailability),
  );

  const availability = availabilityRepository.create({
    dishId,
    restaurantId,
    disponible,
  });

  return await availabilityRepository.save(availability);
}

/**
 * Crea un pedido de prueba
 */
export async function createTestOrder(
  app: INestApplication,
  module: TestingModule,
  token: string,
  options: CreateTestOrderOptions,
): Promise<Order> {
  const orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));

  // Calcular totales
  const subtotal = options.items.reduce((sum, item) => sum + item.precioTotal, 0);
  const tarifaServicio = Math.round(subtotal * 0.05); // 5%
  const total = subtotal + tarifaServicio;

  // Crear pedido vía API
  const createOrderResponse = await request(app.getHttpServer())
    .post('/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      restaurantId: options.restaurantId,
      items: options.items,
      comentariosCliente: options.comentariosCliente,
      paymentSourceId: options.paymentSourceId,
    });

  if (createOrderResponse.status !== 201) {
    throw new Error(
      `Error al crear pedido: ${createOrderResponse.status} - ${JSON.stringify(createOrderResponse.body)}`,
    );
  }

  const orderId = createOrderResponse.body.data?.id || createOrderResponse.body.id;
  const order = await orderRepository.findOne({ where: { id: orderId } });

  if (!order) {
    throw new Error('Pedido no encontrado después de creación');
  }

  return order;
}

/**
 * Crea una tarjeta de prueba
 */
export async function createTestCard(
  app: INestApplication,
  module: TestingModule,
  token: string,
  options: CreateTestCardOptions,
): Promise<UserCard> {
  const createCardResponse = await request(app.getHttpServer())
    .post('/payments/cards')
    .set('Authorization', `Bearer ${token}`)
    .send({
      token: options.token || 'test_token_mock',
      acceptanceToken: options.acceptanceToken || 'test_acceptance_token_mock',
      acceptPersonalAuth: options.acceptPersonalAuth || 'test_personal_auth_mock',
      isDefault: options.isDefault !== undefined ? options.isDefault : true,
    });

  if (createCardResponse.status !== 201) {
    throw new Error(
      `Error al crear tarjeta: ${createCardResponse.status} - ${JSON.stringify(createCardResponse.body)}`,
    );
  }

  const cardId = createCardResponse.body.data?.id || createCardResponse.body.id;

  // Obtener tarjeta desde BD
  const cardRepository = module.get<Repository<UserCard>>(getRepositoryToken(UserCard));
  const card = await cardRepository.findOne({ where: { id: cardId } });

  if (!card) {
    throw new Error('Tarjeta no encontrada después de creación');
  }

  return card;
}
