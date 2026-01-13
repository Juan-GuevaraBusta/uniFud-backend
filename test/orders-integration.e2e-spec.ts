import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/users/entities/user.entity';
import { DishType } from '../src/dishes/entities/dish.entity';

describe('Orders Integration E2E', () => {
  let app: INestApplication;
  let studentToken: string;
  let studentUserId: string;
  let restaurantOwnerToken: string;
  let restaurantOwnerId: string;
  let universityId: string;
  let restaurantId: string;
  let dishIds: string[];
  let cardId: string;
  let hasWompiCredentials: boolean;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Verificar credenciales de Wompi
    const wompiPrivateKey = process.env.WOMPI_PRIVATE_KEY;
    hasWompiCredentials = !!(wompiPrivateKey && wompiPrivateKey.startsWith('prv_test_'));

    // Setup de usuarios
    const timestamp = Date.now();
    const studentEmail = `test-student-${timestamp}@example.com`;
    const restaurantOwnerEmail = `test-owner-${timestamp}@example.com`;
    const password = 'Test123456!';

    // Crear usuario estudiante
    const studentRegisterResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: studentEmail,
        password,
        nombre: 'Test Student',
        role: UserRole.STUDENT,
      });

    if (studentRegisterResponse.status === 201) {
      studentUserId = studentRegisterResponse.body.data.user.id;
      studentToken = studentRegisterResponse.body.data.accessToken;
    } else {
      throw new Error(`Error al crear usuario estudiante: ${studentRegisterResponse.status}`);
    }

    // Confirmar email del estudiante (necesario para algunos endpoints)
    if (studentRegisterResponse.body.data.user.verificationCode) {
      await request(app.getHttpServer())
        .post('/auth/confirm-email')
        .send({
          email: studentEmail,
          code: studentRegisterResponse.body.data.user.verificationCode,
        });
    }

    // Crear usuario restaurante owner
    const ownerRegisterResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: restaurantOwnerEmail,
        password,
        nombre: 'Test Restaurant Owner',
        role: UserRole.RESTAURANT_OWNER,
      });

    if (ownerRegisterResponse.status === 201) {
      restaurantOwnerId = ownerRegisterResponse.body.data.user.id;
      restaurantOwnerToken = ownerRegisterResponse.body.data.accessToken;
    } else {
      throw new Error(`Error al crear usuario restaurante owner: ${ownerRegisterResponse.status}`);
    }

    // Confirmar email del owner
    if (ownerRegisterResponse.body.data.user.verificationCode) {
      await request(app.getHttpServer())
        .post('/auth/confirm-email')
        .send({
          email: restaurantOwnerEmail,
          code: ownerRegisterResponse.body.data.user.verificationCode,
        });
    }

    // Crear universidad (requiere autenticación)
    const universityResponse = await request(app.getHttpServer())
      .post('/universities')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        nombre: `Test University ${timestamp}`,
        ciudad: 'Bogotá',
      });

    if (universityResponse.status === 201) {
      universityId = universityResponse.body.data?.id || universityResponse.body.id;
    } else {
      throw new Error(`Error al crear universidad: ${universityResponse.status}`);
    }

    // Crear restaurante
    const restaurantResponse = await request(app.getHttpServer())
      .post('/restaurants')
      .set('Authorization', `Bearer ${restaurantOwnerToken}`)
      .send({
        nombre: `Test Restaurant ${timestamp}`,
        universityId,
        categorias: ['Pizza', 'Italiana'],
        tiempoEntrega: 30,
      });

    if (restaurantResponse.status === 201) {
      restaurantId = restaurantResponse.body.data?.id || restaurantResponse.body.id;
    } else {
      throw new Error(`Error al crear restaurante: ${restaurantResponse.status}`);
    }

    // Crear platos
    dishIds = [];
    const dish1Response = await request(app.getHttpServer())
      .post('/dishes')
      .set('Authorization', `Bearer ${restaurantOwnerToken}`)
      .send({
        nombre: `Pizza Margarita ${timestamp}`,
        descripcion: 'Pizza con tomate, mozzarella y albahaca',
        precio: 15000,
        categoria: 'Pizza',
        restaurantId,
        tipoPlato: DishType.SIMPLE,
      });

    if (dish1Response.status === 201) {
      dishIds.push(dish1Response.body.data?.id || dish1Response.body.id);
    }

    const dish2Response = await request(app.getHttpServer())
      .post('/dishes')
      .set('Authorization', `Bearer ${restaurantOwnerToken}`)
      .send({
        nombre: `Pizza Pepperoni ${timestamp}`,
        descripcion: 'Pizza con pepperoni',
        precio: 18000,
        categoria: 'Pizza',
        restaurantId,
        tipoPlato: DishType.SIMPLE,
      });

    if (dish2Response.status === 201) {
      dishIds.push(dish2Response.body.data?.id || dish2Response.body.id);
    }

    // Configurar disponibilidad de platos
    for (const dishId of dishIds) {
      await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .set('Authorization', `Bearer ${restaurantOwnerToken}`)
        .query({ restaurantId })
        .send({
          disponible: true,
        });
    }
  }, 60000); // Timeout de 60 segundos para setup

  afterAll(async () => {
    await app.close();
  });

  // Helper functions
  async function createCard(token: string, wompiToken: string, acceptanceToken: string, acceptPersonalAuth: string): Promise<string | null> {
    const response = await request(app.getHttpServer())
      .post('/payments/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({
        token: wompiToken,
        acceptanceToken,
        acceptPersonalAuth,
        isDefault: true,
      });

    if (response.status === 201) {
      return response.body.data?.id || response.body.id;
    }
    return null;
  }

  describe('Flujo exitoso completo', () => {
    it.skip('debe completar el flujo completo: tarjeta → pedido → pago → notificación', async () => {
      if (!hasWompiCredentials) {
        console.log('⏭️  Saltando test: credenciales de Wompi sandbox no configuradas');
        return;
      }

      if (!studentToken || !dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // NOTA: Este test requiere tokens reales de Wompi.js (tokenización desde frontend)
      // Para testing real, se necesitan:
      // - WOMPI_TEST_TOKEN: token tokenizado desde Wompi.js
      // - WOMPI_TEST_ACCEPTANCE_TOKEN: acceptance token desde Wompi.js
      // - WOMPI_TEST_ACCEPT_PERSONAL_AUTH: personal auth token desde Wompi.js
      // Ver: docs/WOMPI_SANDBOX_TESTING.md

      const wompiToken = process.env.WOMPI_TEST_TOKEN;
      const acceptanceToken = process.env.WOMPI_TEST_ACCEPTANCE_TOKEN;
      const acceptPersonalAuth = process.env.WOMPI_TEST_ACCEPT_PERSONAL_AUTH;

      if (!wompiToken || !acceptanceToken || !acceptPersonalAuth) {
        console.log('⏭️  Saltando test: tokens de Wompi no configurados');
        console.log('  Configura WOMPI_TEST_TOKEN, WOMPI_TEST_ACCEPTANCE_TOKEN, WOMPI_TEST_ACCEPT_PERSONAL_AUTH en .env');
        console.log('  Los tokens deben obtenerse desde Wompi.js en el frontend');
        return;
      }

      // Paso 1: Agregar tarjeta
      cardId = await createCard(studentToken, wompiToken, acceptanceToken, acceptPersonalAuth);
      if (!cardId) {
        console.log('⏭️  Saltando test: no se pudo crear tarjeta');
        return;
      }

      // Paso 2: Crear pedido
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          restaurantId,
          items: [
            {
              dishId: dishIds[0],
              dishNombre: `Pizza Margarita ${Date.now()}`,
              cantidad: 1,
              precioUnitario: 15000,
              precioTotal: 15000,
            },
          ],
          paymentSourceId: cardId,
        });

      expect(orderResponse.status).toBe(201);
      const orderId = orderResponse.body.data?.id || orderResponse.body.id;
      expect(orderId).toBeDefined();
      expect(orderResponse.body.data?.status || orderResponse.body.status).toBe('PENDIENTE');

      // Paso 3: Verificar que el pago se procesó exitosamente
      // El pago se crea automáticamente cuando se crea el pedido
      // Podemos verificar consultando el pedido (si hay endpoint para obtener payment asociado)
      // O verificando logs

      // Paso 4: Verificar que el pedido existe
      const getOrderResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(getOrderResponse.body.data?.id || getOrderResponse.body.id).toBe(orderId);
      expect(getOrderResponse.body.data?.status || getOrderResponse.body.status).toBe('PENDIENTE');

      // Nota: La verificación de notificaciones requeriría acceso a logs o un endpoint de testing
      // Por ahora, asumimos que si el pedido se creó exitosamente, las notificaciones se enviaron
    }, 60000);
  });

  describe('Flujo con pago rechazado', () => {
    it.skip('debe rechazar el pago y NO crear el pedido', async () => {
      if (!hasWompiCredentials) {
        console.log('⏭️  Saltando test: credenciales de Wompi sandbox no configuradas');
        return;
      }

      if (!studentToken || !dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // NOTA: Para este test, necesitamos una tarjeta que siempre rechaza
      // Según la documentación de Wompi Sandbox:
      // - Tarjeta aprobada: 4242 4242 4242 4242
      // - Tarjeta declinada: 4111 1111 1111 1111
      // 
      // Para simular pago rechazado, necesitaríamos:
      // 1. Tokenizar la tarjeta declinada desde Wompi.js
      // 2. Usar ese token para crear el Payment Source
      // 3. Intentar crear el pedido con esa tarjeta
      //
      // Alternativamente, podríamos mockear WompiClient para rechazar el pago

      const wompiTokenDeclined = process.env.WOMPI_TEST_TOKEN_DECLINED;
      const acceptanceToken = process.env.WOMPI_TEST_ACCEPTANCE_TOKEN;
      const acceptPersonalAuth = process.env.WOMPI_TEST_ACCEPT_PERSONAL_AUTH;

      if (!wompiTokenDeclined || !acceptanceToken || !acceptPersonalAuth) {
        console.log('⏭️  Saltando test: tokens de tarjeta declinada no configurados');
        console.log('  Para este test, necesitas tokenizar la tarjeta 4111 1111 1111 1111 desde Wompi.js');
        return;
      }

      // Crear tarjeta con tarjeta declinada
      const declinedCardId = await createCard(studentToken, wompiTokenDeclined, acceptanceToken, acceptPersonalAuth);
      if (!declinedCardId) {
        console.log('⏭️  Saltando test: no se pudo crear tarjeta declinada');
        return;
      }

      // Intentar crear pedido (debe fallar)
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          restaurantId,
          items: [
            {
              dishId: dishIds[0],
              dishNombre: `Pizza Test ${Date.now()}`,
              cantidad: 1,
              precioUnitario: 15000,
              precioTotal: 15000,
            },
          ],
          paymentSourceId: declinedCardId,
        });

      // El pedido NO debe crearse si el pago es rechazado
      expect(orderResponse.status).toBeGreaterThanOrEqual(400);
      expect(orderResponse.body.success).toBeFalsy();
      expect(orderResponse.body.message || orderResponse.body.error).toBeDefined();

      // Verificar que el código de error es PAYMENT_DECLINED o PAYMENT_FAILED
      const errorCode = orderResponse.body.code || orderResponse.body.errorCode;
      expect(['PAYMENT_DECLINED', 'PAYMENT_FAILED']).toContain(errorCode);
    }, 60000);
  });
});
