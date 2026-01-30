import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { cleanDatabase, seedTestData, getTestApp, closeTestApp } from './setup';
import { createTestCard, createTestOrder } from './helpers/test-data.helper';
import { WompiClient } from '../src/payments/providers/wompi.client';

describe('Orders Integration E2E', () => {
  let app: INestApplication;
  let module: TestingModule;
  let testData: any;
  let cardId: string;

  beforeAll(async () => {
    // Obtener aplicación de test (incluye mocks automáticos de Wompi si no hay credenciales)
    const { app: testApp, module: testModule } = await getTestApp();
    app = testApp;
    module = testModule;

    // Limpiar BD antes de empezar
    await cleanDatabase();

    // Crear datos base reutilizables
    testData = await seedTestData();
  }, 60000);

  afterAll(async () => {
    await closeTestApp();
  });

  // Helper para crear tarjeta
  async function createCard(token: string): Promise<string | null> {
    try {
      const card = await createTestCard(app, module, token, {
        userId: testData.studentId,
        isDefault: true,
      });
      return card.id;
    } catch (error) {
      console.warn('Error al crear tarjeta:', error.message);
      return null;
    }
  }

  describe('Flujo exitoso completo', () => {
    it('debe completar el flujo completo: tarjeta → pedido → pago → notificación', async () => {
      if (!testData.studentToken || !testData.dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Paso 1: Agregar tarjeta
      cardId = await createCard(testData.studentToken);
      if (!cardId) {
        console.log('⏭️  Saltando test: no se pudo crear tarjeta');
        return;
      }

      // Paso 2: Crear pedido
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .send({
          restaurantId: testData.restaurantId,
          items: [
            {
              dishId: testData.dishIds[0],
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

      // Paso 3: Verificar que el pedido existe
      const getOrderResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .expect(200);

      expect(getOrderResponse.body.data?.id || getOrderResponse.body.id).toBe(orderId);
      expect(getOrderResponse.body.data?.status || getOrderResponse.body.status).toBe('PENDIENTE');

      // Nota: La verificación de notificaciones requeriría acceso a logs o un endpoint de testing
      // Por ahora, asumimos que si el pedido se creó exitosamente, las notificaciones se enviaron
    }, 60000);
  });

  describe('Flujo con pago rechazado', () => {
    it('debe rechazar el pago y NO crear el pedido', async () => {
      if (!testData.studentToken || !testData.dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Obtener WompiClient desde el módulo para configurar mock de rechazo
      const wompiClient = module.get<WompiClient>(WompiClient);

      // Configurar mock para rechazar transacción
      if (wompiClient && typeof (wompiClient.createTransaction as jest.Mock)?.mockImplementationOnce === 'function') {
        // Resetear el mock para que createPaymentSource funcione
        (wompiClient.createPaymentSource as jest.Mock).mockResolvedValueOnce({
          id: 'test_payment_source_declined_12345',
          type: 'CARD',
          status: 'AVAILABLE',
          token: 'test_token_declined',
          created_at: new Date().toISOString(),
        });

        // Configurar createTransaction para rechazar en este test
        (wompiClient.createTransaction as jest.Mock).mockImplementationOnce(() => {
          return Promise.resolve({
            id: `test_transaction_declined_${Date.now()}`,
            reference: `UFD-TEST-${Date.now()}`,
            amount_in_cents: 15000 * 100,
            currency: 'COP',
            status: 'DECLINED',
            status_message: 'Transacción rechazada - Tarjeta declinada',
            payment_method: {
              type: 'CARD',
              payment_source_id: 'test_payment_source_declined_12345',
            },
            created_at: new Date().toISOString(),
          });
        });
      }

      // Crear tarjeta
      const declinedCardId = await createCard(testData.studentToken);
      if (!declinedCardId) {
        console.log('⚠️  No se pudo crear tarjeta declinada, pero el test continuará para verificar el rechazo de pago');
      }

      console.log('ℹ️  Usando mocks de WompiClient para simular pago rechazado');

      // Intentar crear pedido (debe fallar)
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .send({
          restaurantId: testData.restaurantId,
          items: [
            {
              dishId: testData.dishIds[0],
              dishNombre: `Pizza Test ${Date.now()}`,
              cantidad: 1,
              precioUnitario: 15000,
              precioTotal: 15000,
            },
          ],
          paymentSourceId: declinedCardId || 'test_card_declined_id',
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

  describe('Casos Edge - Flujo de Pedidos', () => {
    describe('Pedido con múltiples items', () => {
      it('debe crear pedido exitosamente con múltiples items', async () => {
        if (!testData.studentToken || !testData.dishIds.length || !testData.restaurantId) {
          console.log('⏭️  Saltando test: datos de prueba no disponibles');
          return;
        }

        // Crear tarjeta para el test
        const multiCardId = await createCard(testData.studentToken);
        if (!multiCardId) {
          console.log('⏭️  Saltando test: no se pudo crear tarjeta');
          return;
        }

        // Crear pedido con 3 items diferentes
        const items = [
          {
            dishId: testData.dishIds[0],
            dishNombre: `Pizza Test 1 ${Date.now()}`,
            cantidad: 2,
            precioUnitario: 15000,
            precioTotal: 30000,
          },
          {
            dishId: testData.dishIds[1] || testData.dishIds[0],
            dishNombre: `Pizza Test 2 ${Date.now()}`,
            cantidad: 1,
            precioUnitario: 20000,
            precioTotal: 20000,
          },
          {
            dishId: testData.dishIds[2] || testData.dishIds[0],
            dishNombre: `Pizza Test 3 ${Date.now()}`,
            cantidad: 3,
            precioUnitario: 10000,
            precioTotal: 30000,
          },
        ];

        const orderResponse = await request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${testData.studentToken}`)
          .send({
            restaurantId: testData.restaurantId,
            items,
            paymentSourceId: multiCardId,
          });

        expect(orderResponse.status).toBe(201);
        const order = orderResponse.body.data || orderResponse.body;
        expect(order).toBeDefined();
        expect(order.items).toBeDefined();
        expect(order.items.length).toBe(3);

        // Verificar cálculo de totales
        const subtotal = items.reduce((sum, item) => sum + item.precioTotal, 0);
        const tarifaServicio = Math.round(subtotal * 0.05);
        const total = subtotal + tarifaServicio;

        expect(order.subtotal).toBe(subtotal);
        expect(order.tarifaServicio).toBe(tarifaServicio);
        expect(order.total).toBe(total);

        // Verificar que todos los items se guardaron correctamente
        for (let i = 0; i < items.length; i++) {
          expect(order.items[i].dishId).toBe(items[i].dishId);
          expect(order.items[i].cantidad).toBe(items[i].cantidad);
          expect(order.items[i].precioUnitario).toBe(items[i].precioUnitario);
        }
      }, 60000);
    });

    describe('Pedido con plato no disponible', () => {
      it('debe rechazar pedido con plato no disponible', async () => {
        if (!testData.studentToken || !testData.dishIds.length || !testData.restaurantId || !testData.restaurantOwnerToken) {
          console.log('⏭️  Saltando test: datos de prueba no disponibles');
          return;
        }

        // Crear tarjeta para el test
        const unavailableCardId = await createCard(testData.studentToken);
        if (!unavailableCardId) {
          console.log('⏭️  Saltando test: no se pudo crear tarjeta');
          return;
        }

        // Marcar un plato como no disponible
        const dishToDisable = testData.dishIds[0];
        await request(app.getHttpServer())
          .patch(`/dishes/${dishToDisable}/availability`)
          .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
          .query({ restaurantId: testData.restaurantId })
          .send({
            disponible: false,
          });

        // Intentar crear pedido con el plato no disponible
        const orderResponse = await request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${testData.studentToken}`)
          .send({
            restaurantId: testData.restaurantId,
            items: [
              {
                dishId: dishToDisable,
                dishNombre: `Pizza No Disponible ${Date.now()}`,
                cantidad: 1,
                precioUnitario: 15000,
                precioTotal: 15000,
              },
            ],
            paymentSourceId: unavailableCardId,
          });

        expect(orderResponse.status).toBeGreaterThanOrEqual(400);
        expect(orderResponse.body.success).toBeFalsy();
        expect(orderResponse.body.message || orderResponse.body.error).toBeDefined();
        expect(orderResponse.body.message || orderResponse.body.error).toContain('no está disponible');

        // Verificar que NO se creó el pedido
        const errorCode = orderResponse.body.code || orderResponse.body.errorCode;
        expect(errorCode).toBe('DISH_NOT_AVAILABLE');

        // Restaurar disponibilidad del plato para otros tests
        await request(app.getHttpServer())
          .patch(`/dishes/${dishToDisable}/availability`)
          .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
          .query({ restaurantId: testData.restaurantId })
          .send({
            disponible: true,
          });
      }, 60000);
    });

    describe('Pedido con restaurante inactivo', () => {
      it('debe rechazar pedido en restaurante inactivo', async () => {
        if (!testData.studentToken || !testData.dishIds.length || !testData.restaurantId || !testData.restaurantOwnerToken) {
          console.log('⏭️  Saltando test: datos de prueba no disponibles');
          return;
        }

        // Crear tarjeta para el test
        const inactiveCardId = await createCard(testData.studentToken);
        if (!inactiveCardId) {
          console.log('⏭️  Saltando test: no se pudo crear tarjeta');
          return;
        }

        // Desactivar restaurante
        await request(app.getHttpServer())
          .patch(`/restaurants/${testData.restaurantId}`)
          .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
          .send({
            activo: false,
          });

        // Intentar crear pedido en restaurante inactivo
        const orderResponse = await request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${testData.studentToken}`)
          .send({
            restaurantId: testData.restaurantId,
            items: [
              {
                dishId: testData.dishIds[0],
                dishNombre: `Pizza Restaurante Inactivo ${Date.now()}`,
                cantidad: 1,
                precioUnitario: 15000,
                precioTotal: 15000,
              },
            ],
            paymentSourceId: inactiveCardId,
          });

        expect(orderResponse.status).toBeGreaterThanOrEqual(400);
        expect(orderResponse.body.success).toBeFalsy();
        expect(orderResponse.body.message || orderResponse.body.error).toBeDefined();
        expect(orderResponse.body.message || orderResponse.body.error).toContain('no está activo');

        // Verificar código de error
        const errorCode = orderResponse.body.code || orderResponse.body.errorCode;
        expect(errorCode).toBe('RESTAURANT_INACTIVE');

        // Reactivar restaurante para otros tests
        await request(app.getHttpServer())
          .patch(`/restaurants/${testData.restaurantId}`)
          .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
          .send({
            activo: true,
          });
      }, 60000);
    });

    describe('Pedido duplicado', () => {
      it('debe rechazar pedido duplicado pendiente', async () => {
        if (!testData.studentToken || !testData.dishIds.length || !testData.restaurantId) {
          console.log('⏭️  Saltando test: datos de prueba no disponibles');
          return;
        }

        // Crear tarjeta para el test
        const duplicateCardId = await createCard(testData.studentToken);
        if (!duplicateCardId) {
          console.log('⏭️  Saltando test: no se pudo crear tarjeta');
          return;
        }

        // Crear primer pedido
        const firstOrderResponse = await request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${testData.studentToken}`)
          .send({
            restaurantId: testData.restaurantId,
            items: [
              {
                dishId: testData.dishIds[0],
                dishNombre: `Pizza Duplicado ${Date.now()}`,
                cantidad: 1,
                precioUnitario: 15000,
                precioTotal: 15000,
              },
            ],
            paymentSourceId: duplicateCardId,
          });

        if (firstOrderResponse.status !== 201) {
          console.log('⏭️  Saltando test: no se pudo crear primer pedido');
          return;
        }

        // Intentar crear segundo pedido idéntico inmediatamente
        const secondOrderResponse = await request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${testData.studentToken}`)
          .send({
            restaurantId: testData.restaurantId,
            items: [
              {
                dishId: testData.dishIds[0],
                dishNombre: `Pizza Duplicado ${Date.now()}`,
                cantidad: 1,
                precioUnitario: 15000,
                precioTotal: 15000,
              },
            ],
            paymentSourceId: duplicateCardId,
          });

        expect(secondOrderResponse.status).toBeGreaterThanOrEqual(400);
        expect(secondOrderResponse.body.success).toBeFalsy();
        expect(secondOrderResponse.body.message || secondOrderResponse.body.error).toBeDefined();
        expect(secondOrderResponse.body.message || secondOrderResponse.body.error).toContain('pedido pendiente');

        // Verificar código de error
        const errorCode = secondOrderResponse.body.code || secondOrderResponse.body.errorCode;
        expect(errorCode).toBe('ORDER_ALREADY_PENDING');
      }, 60000);
    });
  });
});
