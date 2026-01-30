// Configurar NODE_ENV ANTES de cualquier importación
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { University } from '../src/universities/entities/university.entity';
import { Restaurant } from '../src/restaurants/entities/restaurant.entity';
import { Dish, DishType } from '../src/dishes/entities/dish.entity';
import { Topping } from '../src/dishes/entities/topping.entity';
import { DishAvailability } from '../src/dishes/entities/dish-availability.entity';
import { Order } from '../src/orders/entities/order.entity';
import { Payment } from '../src/payments/entities/payment.entity';
import { UserCard } from '../src/payments/entities/user-card.entity';
import { NotificationToken } from '../src/notifications/entities/notification-token.entity';
import { Invoice } from '../src/invoices/entities/invoice.entity';
import { WompiClient } from '../src/payments/providers/wompi.client';
import { getDataSource, closeDataSource } from './helpers/database.helper';

export interface TestData {
  universityId: string;
  studentId: string;
  studentEmail: string;
  studentToken: string;
  restaurantOwnerId: string;
  restaurantOwnerEmail: string;
  restaurantOwnerToken: string;
  restaurantId: string;
  dishIds: string[];
  adminId?: string;
  adminEmail?: string;
  adminToken?: string;
}

let testApp: INestApplication | null = null;
let testModule: TestingModule | null = null;

/**
 * Limpia todas las tablas de la base de datos en orden correcto
 * Respetando las foreign keys
 */
export async function cleanDatabase(): Promise<void> {
  const dataSource = await getDataSource();
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Orden de eliminación respetando foreign keys
    const tables = [
      'invoices',
      'payments',
      'orders',
      'user_cards',
      'notification_tokens',
      'dish_availability',
      'toppings',
      'dishes',
      'restaurants',
      'universities',
      'users',
    ];

    // Intentar desactivar temporalmente foreign keys para limpieza rápida
    // Si no tiene permisos, usar DELETE en lugar de TRUNCATE
    let canDisableFKs = false;
    try {
      await queryRunner.query('SET session_replication_role = replica');
      canDisableFKs = true;
    } catch (error) {
      // Si no tiene permisos, continuar sin desactivar foreign keys
      console.warn('Warning: Cannot disable foreign keys, using DELETE instead of TRUNCATE');
    }

    for (const table of tables) {
      try {
        if (canDisableFKs) {
          await queryRunner.query(`TRUNCATE TABLE ${table} CASCADE`);
        } else {
          // Usar DELETE si no podemos desactivar foreign keys
          // El orden ya está correcto para respetar foreign keys
          await queryRunner.query(`DELETE FROM ${table}`);
        }
      } catch (error) {
        // Si la tabla no existe o hay error de foreign key, intentar con CASCADE
        try {
          if (canDisableFKs) {
            // Ya intentamos con CASCADE, saltar
            throw error;
          } else {
            // Intentar eliminar con CASCADE si es posible
            await queryRunner.query(`DELETE FROM ${table} CASCADE`);
          }
        } catch (cascadeError) {
          // Si aún falla, solo registrar advertencia
          console.warn(`Warning: Could not clean table ${table}:`, error.message);
        }
      }
    }

    // Reactivar foreign keys si las desactivamos
    if (canDisableFKs) {
      try {
        await queryRunner.query('SET session_replication_role = DEFAULT');
      } catch (error) {
        // Ignorar error al reactivar
      }
    }

    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

/**
 * Crea datos base reutilizables para tests
 */
export async function seedTestData(): Promise<TestData> {
  if (!testApp || !testModule) {
    throw new Error('getTestApp() must be called before seedTestData()');
  }

  const timestamp = Date.now();
  const userRepository = testModule.get<Repository<User>>(getRepositoryToken(User));
  const universityRepository = testModule.get<Repository<University>>(getRepositoryToken(University));
  const restaurantRepository = testModule.get<Repository<Restaurant>>(getRepositoryToken(Restaurant));
  const dishRepository = testModule.get<Repository<Dish>>(getRepositoryToken(Dish));
  const availabilityRepository = testModule.get<Repository<DishAvailability>>(
    getRepositoryToken(DishAvailability),
  );

  // Crear universidad
  const university = universityRepository.create({
    nombre: `Universidad de Prueba ${timestamp}`,
    ciudad: 'Bogotá',
  });
  const savedUniversity = await universityRepository.save(university);

  // Crear usuario estudiante
  const studentEmail = `test-student-${timestamp}@example.com`;
  const studentPassword = 'Test123456!';
  const studentRegisterResponse = await request(testApp.getHttpServer())
    .post('/auth/register')
    .send({
      email: studentEmail,
      password: studentPassword,
      nombre: 'Test Student',
      role: UserRole.STUDENT,
    });

  if (studentRegisterResponse.status !== 201) {
    throw new Error(
      `Error al crear usuario estudiante: ${studentRegisterResponse.status} - ${JSON.stringify(studentRegisterResponse.body)}`,
    );
  }

  const studentUser = await userRepository.findOne({ where: { email: studentEmail } });
  if (!studentUser) {
    throw new Error('Usuario estudiante no encontrado después de registro');
  }

  // Confirmar email del estudiante
  await confirmUserEmail(studentEmail);

  // Login del estudiante
  const studentLoginResponse = await request(testApp.getHttpServer()).post('/auth/login').send({
    email: studentEmail,
    password: studentPassword,
  });

  if (studentLoginResponse.status !== 200) {
    throw new Error(
      `Error al hacer login del estudiante: ${studentLoginResponse.status} - ${JSON.stringify(studentLoginResponse.body)}`,
    );
  }

  const studentToken = studentLoginResponse.body.data?.accessToken || studentLoginResponse.body.accessToken;

  // Crear usuario restaurante owner
  const restaurantOwnerEmail = `test-owner-${timestamp}@example.com`;
  const restaurantOwnerPassword = 'Test123456!';
  const ownerRegisterResponse = await request(testApp.getHttpServer())
    .post('/auth/register')
    .send({
      email: restaurantOwnerEmail,
      password: restaurantOwnerPassword,
      nombre: 'Test Restaurant Owner',
      role: UserRole.RESTAURANT_OWNER,
    });

  if (ownerRegisterResponse.status !== 201) {
    throw new Error(
      `Error al crear usuario restaurante owner: ${ownerRegisterResponse.status} - ${JSON.stringify(ownerRegisterResponse.body)}`,
    );
  }

  const ownerUser = await userRepository.findOne({ where: { email: restaurantOwnerEmail } });
  if (!ownerUser) {
    throw new Error('Usuario restaurante owner no encontrado después de registro');
  }

  // Confirmar email del owner
  await confirmUserEmail(restaurantOwnerEmail);

  // Login del owner
  const ownerLoginResponse = await request(testApp.getHttpServer()).post('/auth/login').send({
    email: restaurantOwnerEmail,
    password: restaurantOwnerPassword,
  });

  if (ownerLoginResponse.status !== 200) {
    throw new Error(
      `Error al hacer login del owner: ${ownerLoginResponse.status} - ${JSON.stringify(ownerLoginResponse.body)}`,
    );
  }

  const restaurantOwnerToken =
    ownerLoginResponse.body.data?.accessToken || ownerLoginResponse.body.accessToken;

  // Crear restaurante
  const restaurant = restaurantRepository.create({
    nombre: `Restaurante de Prueba ${timestamp}`,
    universityId: savedUniversity.id,
    ownerId: ownerUser.id,
    categorias: ['Pizza', 'Hamburguesas', 'Bebidas'],
    calificacion: 4.5,
    tiempoEntrega: 20,
    activo: true,
  });
  const savedRestaurant = await restaurantRepository.save(restaurant);

  // Crear platos de prueba
  const dishes = [
    {
      nombre: `Pizza Margarita ${timestamp}`,
      descripcion: 'Pizza con queso y tomate',
      precio: 15000,
      categoria: 'Pizza',
      tipoPlato: DishType.SIMPLE,
      restaurantId: savedRestaurant.id,
      activo: true,
    },
    {
      nombre: `Hamburguesa Clásica ${timestamp}`,
      descripcion: 'Hamburguesa con carne, lechuga, tomate',
      precio: 12000,
      categoria: 'Hamburguesas',
      tipoPlato: DishType.FIJO,
      restaurantId: savedRestaurant.id,
      activo: true,
    },
    {
      nombre: `Combo Personalizable ${timestamp}`,
      descripcion: 'Combo que puedes personalizar',
      precio: 20000,
      categoria: 'Combos',
      tipoPlato: DishType.PERSONALIZABLE,
      restaurantId: savedRestaurant.id,
      activo: true,
    },
  ];

  const savedDishes = await dishRepository.save(dishes);
  const dishIds = savedDishes.map((d) => d.id);

  // Crear disponibilidad para todos los platos
  const availabilities = dishIds.map((dishId) =>
    availabilityRepository.create({
      dishId,
      restaurantId: savedRestaurant.id,
      disponible: true,
    }),
  );
  await availabilityRepository.save(availabilities);

  return {
    universityId: savedUniversity.id,
    studentId: studentUser.id,
    studentEmail,
    studentToken,
    restaurantOwnerId: ownerUser.id,
    restaurantOwnerEmail,
    restaurantOwnerToken,
    restaurantId: savedRestaurant.id,
    dishIds,
  };
}

/**
 * Crea una aplicación NestJS para tests
 */
export async function getTestApp(): Promise<{ app: INestApplication; module: TestingModule }> {
  if (testApp && testModule) {
    return { app: testApp, module: testModule };
  }

  // Verificar si hay credenciales de Wompi configuradas
  const wompiPrivateKey = process.env.WOMPI_PRIVATE_KEY;
  const hasWompiCredentials = !!(wompiPrivateKey && wompiPrivateKey.startsWith('prv_test_'));
  const useMocks = !hasWompiCredentials;

  // Crear módulo con mocks si es necesario
  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  // Si no hay credenciales, mockear WompiClient
  if (useMocks) {
    moduleBuilder.overrideProvider(WompiClient).useValue({
      createPaymentSource: jest.fn().mockResolvedValue({
        id: `test_payment_source_${Date.now()}`,
        type: 'CARD',
        status: 'AVAILABLE',
        token: 'test_token',
        created_at: new Date().toISOString(),
        public_data: {
          bin: '411111',
          last_four: '1111',
          exp_month: '12',
          exp_year: '2025',
          card_holder: 'Test User',
          name: 'Test User',
        },
      }),
      createTransaction: jest.fn().mockImplementation((paymentSourceId, amount, reference, customerEmail) => {
        return Promise.resolve({
          id: `test_transaction_${Date.now()}`,
          reference,
          amount_in_cents: Math.round(amount * 100),
          currency: 'COP',
          status: 'APPROVED',
          status_message: 'Transacción aprobada',
          payment_method: {
            type: 'CARD',
            payment_source_id: paymentSourceId,
          },
          created_at: new Date().toISOString(),
        });
      }),
      getTransaction: jest.fn().mockResolvedValue({
        id: 'test_transaction',
        status: 'APPROVED',
      }),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    });
  }

  testModule = await moduleBuilder.compile();
  testApp = testModule.createNestApplication();
  await testApp.init();

  return { app: testApp, module: testModule };
}

/**
 * Cierra la aplicación de test
 */
export async function closeTestApp(): Promise<void> {
  if (testApp) {
    await testApp.close();
    testApp = null;
    testModule = null;
  }
  await closeDataSource();
}

/**
 * Obtiene un token JWT para un usuario
 */
export async function getAuthToken(email: string, password: string): Promise<string> {
  if (!testApp) {
    throw new Error('getTestApp() must be called before getAuthToken()');
  }

  const response = await request(testApp.getHttpServer()).post('/auth/login').send({
    email,
    password,
  });

  if (response.status !== 200) {
    throw new Error(`Error al obtener token: ${response.status} - ${JSON.stringify(response.body)}`);
  }

  return response.body.data?.accessToken || response.body.accessToken;
}

/**
 * Confirma el email de un usuario obteniendo el código desde la BD
 */
export async function confirmUserEmail(email: string): Promise<void> {
  if (!testApp || !testModule) {
    throw new Error('getTestApp() must be called before confirmUserEmail()');
  }

  const userRepository = testModule.get<Repository<User>>(getRepositoryToken(User));
  const user = await userRepository.findOne({ where: { email: email.toLowerCase() } });

  if (!user) {
    throw new Error(`Usuario no encontrado: ${email}`);
  }

  if (!user.verificationCode) {
    // Si ya está verificado o no tiene código, no hacer nada
    if (user.emailVerified) {
      return;
    }
    throw new Error(`Usuario no tiene código de verificación: ${email}`);
  }

  const response = await request(testApp.getHttpServer())
    .post('/auth/confirm-email')
    .send({
      email: email.toLowerCase(),
      code: user.verificationCode,
    });

  if (response.status !== 200) {
    throw new Error(
      `Error al confirmar email: ${response.status} - ${JSON.stringify(response.body)}`,
    );
  }
}
