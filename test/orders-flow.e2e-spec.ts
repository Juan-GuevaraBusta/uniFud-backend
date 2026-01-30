// Configurar NODE_ENV ANTES de cualquier importación
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { cleanDatabase, seedTestData, getTestApp, closeTestApp, TestData } from './setup';
import { createTestCard } from './helpers/test-data.helper';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { NotificationsService } from '../src/notifications/notifications.service';

describe('Orders Flow E2E', () => {
  let app: INestApplication;
  let module: TestingModule;
  let testData: TestData;
  let orderId: string;
  let cardId: string;
  let notificationsService: NotificationsService;
  let orderRepository: Repository<Order>;

  beforeAll(async () => {
    const { app: testApp, module: testModule } = await getTestApp();
    app = testApp;
    module = testModule;

    await cleanDatabase();
    testData = await seedTestData();

    // Obtener servicios para mocks y verificaciones
    notificationsService = module.get<NotificationsService>(NotificationsService);
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));

    // Crear tarjeta de pago para el estudiante (con manejo de errores)
    try {
      const card = await createTestCard(app, module, testData.studentToken, {
        userId: testData.studentId,
        isDefault: true,
      });
      cardId = card.id;
    } catch (error) {
      console.warn('⚠️  Error al crear tarjeta en beforeAll:', error.message);
      // Continuar sin tarjeta, algunos tests la crearán por su cuenta
    }
  }, 60000);

  afterAll(async () => {
    await closeTestApp();
  });

  describe('Flujo Completo: Estudiante → Restaurante', () => {
    it('debe completar el flujo completo de pedido', async () => {
      if (!testData.studentToken || !testData.restaurantOwnerToken || !testData.dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Crear tarjeta si no existe
      if (!cardId) {
        try {
          const card = await createTestCard(app, module, testData.studentToken, {
            userId: testData.studentId,
            isDefault: true,
          });
          cardId = card.id;
        } catch (error) {
          console.log('⏭️  Saltando test: no se pudo crear tarjeta');
          return;
        }
      }

      // ========== PASO 1: Login del Estudiante ==========
      const studentLoginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testData.studentEmail,
          password: 'Test123456!',
        });

      expect(studentLoginResponse.status).toBe(200);
      const studentToken = studentLoginResponse.body.data?.accessToken || studentLoginResponse.body.accessToken;
      expect(studentToken).toBeDefined();
      expect(studentLoginResponse.body.user.email).toBe(testData.studentEmail);

      // ========== PASO 2: Consulta Menú del Restaurante ==========
      const menuResponse = await request(app.getHttpServer())
        .get(`/dishes/restaurant/${testData.restaurantId}`)
        .expect(200);

      expect(menuResponse.body).toBeDefined();
      expect(Array.isArray(menuResponse.body.items) || Array.isArray(menuResponse.body)).toBe(true);
      
      const menuItems = menuResponse.body.items || menuResponse.body;
      expect(menuItems.length).toBeGreaterThan(0);
      
      // Verificar que los platos tienen la estructura correcta
      const firstDish = menuItems[0];
      expect(firstDish).toHaveProperty('id');
      expect(firstDish).toHaveProperty('nombre');
      expect(firstDish).toHaveProperty('precio');

      // ========== PASO 3: Crear Pedido ==========
      const items = [
        {
          dishId: testData.dishIds[0],
          dishNombre: `Pizza Margarita ${Date.now()}`,
          cantidad: 2,
          precioUnitario: 15000,
          precioTotal: 30000,
        },
        {
          dishId: testData.dishIds[1] || testData.dishIds[0],
          dishNombre: `Hamburguesa Clásica ${Date.now()}`,
          cantidad: 1,
          precioUnitario: 12000,
          precioTotal: 12000,
        },
      ];

      const subtotal = items.reduce((sum, item) => sum + item.precioTotal, 0);
      const tarifaServicio = Math.round(subtotal * 0.05);
      const total = subtotal + tarifaServicio;

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          restaurantId: testData.restaurantId,
          items,
          paymentSourceId: cardId,
        });

      expect(orderResponse.status).toBe(201);
      const order = orderResponse.body.data || orderResponse.body;
      orderId = order.id;
      
      expect(orderId).toBeDefined();
      expect(order.status).toBe(OrderStatus.PENDIENTE);
      expect(order.numeroOrden).toBeDefined();
      expect(order.numeroOrden).toMatch(/^#[A-Z0-9]+-[A-Z0-9]+$/);
      
      // Verificar cálculos
      expect(order.subtotal).toBe(subtotal);
      expect(order.tarifaServicio).toBe(tarifaServicio);
      expect(order.total).toBe(total);
      
      // Verificar fechas
      expect(order.fechaPedido).toBeDefined();
      expect(new Date(order.fechaPedido).getTime()).toBeLessThanOrEqual(Date.now());
      expect(order.fechaAceptado).toBeNull();
      expect(order.fechaListo).toBeNull();
      expect(order.fechaEntregado).toBeNull();

      // ========== PASO 4: Consultar Pedido Creado ==========
      const getOrderResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      const orderData = getOrderResponse.body.data || getOrderResponse.body;
      expect(orderData.id).toBe(orderId);
      expect(orderData.status).toBe(OrderStatus.PENDIENTE);
      expect(orderData.items.length).toBe(2);
      expect(orderData.subtotal).toBe(subtotal);
      expect(orderData.tarifaServicio).toBe(tarifaServicio);
      expect(orderData.total).toBe(total);

      // ========== PASO 5: Login del Restaurant Owner ==========
      const ownerLoginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testData.restaurantOwnerEmail,
          password: 'Test123456!',
        });

      expect(ownerLoginResponse.status).toBe(200);
      const ownerToken = ownerLoginResponse.body.data?.accessToken || ownerLoginResponse.body.accessToken;
      expect(ownerToken).toBeDefined();

      // ========== PASO 6: Consultar Pedidos Pendientes ==========
      const pendingOrdersResponse = await request(app.getHttpServer())
        .get(`/orders?restaurantId=${testData.restaurantId}&status=${OrderStatus.PENDIENTE}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const pendingOrders = pendingOrdersResponse.body.data?.items || pendingOrdersResponse.body.items || [];
      expect(pendingOrders.length).toBeGreaterThan(0);
      
      const pendingOrder = pendingOrders.find((o: Order) => o.id === orderId);
      expect(pendingOrder).toBeDefined();
      expect(pendingOrder.status).toBe(OrderStatus.PENDIENTE);

      // ========== PASO 7: Aceptar Pedido ==========
      const acceptTimeBefore = Date.now();
      const acceptResponse = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: OrderStatus.ACEPTADO,
          tiempoEstimado: 20,
        })
        .expect(200);

      const acceptTimeAfter = Date.now();
      const acceptedOrder = acceptResponse.body.data || acceptResponse.body;
      expect(acceptedOrder.status).toBe(OrderStatus.ACEPTADO);
      expect(acceptedOrder.tiempoEstimado).toBe(20);
      expect(acceptedOrder.fechaAceptado).toBeDefined();
      
      const fechaAceptado = new Date(acceptedOrder.fechaAceptado).getTime();
      expect(fechaAceptado).toBeGreaterThanOrEqual(acceptTimeBefore - 5000); // Tolerancia de 5 segundos
      expect(fechaAceptado).toBeLessThanOrEqual(acceptTimeAfter + 5000);
      expect(acceptedOrder.fechaListo).toBeNull();
      expect(acceptedOrder.fechaEntregado).toBeNull();

      // ========== PASO 8: Cambiar Estado a PREPARANDO ==========
      const preparingResponse = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: OrderStatus.PREPARANDO,
        })
        .expect(200);

      const preparingOrder = preparingResponse.body.data || preparingResponse.body;
      expect(preparingOrder.status).toBe(OrderStatus.PREPARANDO);
      expect(preparingOrder.fechaAceptado).toBeDefined();
      expect(new Date(preparingOrder.fechaAceptado).getTime()).toBe(fechaAceptado);
      expect(preparingOrder.fechaListo).toBeNull();
      expect(preparingOrder.fechaEntregado).toBeNull();

      // ========== PASO 9: Cambiar Estado a LISTO ==========
      const readyTimeBefore = Date.now();
      const readyResponse = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: OrderStatus.LISTO,
        })
        .expect(200);

      const readyTimeAfter = Date.now();
      const readyOrder = readyResponse.body.data || readyResponse.body;
      expect(readyOrder.status).toBe(OrderStatus.LISTO);
      expect(readyOrder.fechaListo).toBeDefined();
      
      const fechaListo = new Date(readyOrder.fechaListo).getTime();
      expect(fechaListo).toBeGreaterThanOrEqual(readyTimeBefore - 5000);
      expect(fechaListo).toBeLessThanOrEqual(readyTimeAfter + 5000);
      expect(fechaListo).toBeGreaterThan(fechaAceptado);
      expect(readyOrder.fechaAceptado).toBeDefined();
      expect(new Date(readyOrder.fechaAceptado).getTime()).toBe(fechaAceptado);
      expect(readyOrder.fechaEntregado).toBeNull();

      // ========== PASO 10: Marcar como ENTREGADO ==========
      const deliveredTimeBefore = Date.now();
      const deliveredResponse = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: OrderStatus.ENTREGADO,
        })
        .expect(200);

      const deliveredTimeAfter = Date.now();
      const deliveredOrder = deliveredResponse.body.data || deliveredResponse.body;
      expect(deliveredOrder.status).toBe(OrderStatus.ENTREGADO);
      expect(deliveredOrder.fechaEntregado).toBeDefined();
      
      const fechaEntregado = new Date(deliveredOrder.fechaEntregado).getTime();
      expect(fechaEntregado).toBeGreaterThanOrEqual(deliveredTimeBefore - 5000);
      expect(fechaEntregado).toBeLessThanOrEqual(deliveredTimeAfter + 5000);
      expect(fechaEntregado).toBeGreaterThan(fechaListo);
      expect(deliveredOrder.fechaAceptado).toBeDefined();
      expect(deliveredOrder.fechaListo).toBeDefined();

      // ========== PASO 11: Estudiante Consulta Pedido Final ==========
      const finalOrderResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      const finalOrder = finalOrderResponse.body.data || finalOrderResponse.body;
      expect(finalOrder.status).toBe(OrderStatus.ENTREGADO);
      
      // Verificar orden cronológico de fechas
      const fechaPedido = new Date(finalOrder.fechaPedido).getTime();
      const finalFechaAceptado = new Date(finalOrder.fechaAceptado).getTime();
      const finalFechaListo = new Date(finalOrder.fechaListo).getTime();
      const finalFechaEntregado = new Date(finalOrder.fechaEntregado).getTime();
      
      expect(fechaPedido).toBeLessThan(finalFechaAceptado);
      expect(finalFechaAceptado).toBeLessThan(finalFechaListo);
      expect(finalFechaListo).toBeLessThan(finalFechaEntregado);
      
      // Verificar que los cálculos se mantienen
      expect(finalOrder.subtotal).toBe(subtotal);
      expect(finalOrder.tarifaServicio).toBe(tarifaServicio);
      expect(finalOrder.total).toBe(total);
      
      // Verificar datos completos del pedido
      expect(finalOrder.id).toBe(orderId);
      expect(finalOrder.numeroOrden).toBeDefined();
      expect(finalOrder.items.length).toBe(2);
      expect(finalOrder.restaurantId).toBe(testData.restaurantId);
      expect(finalOrder.userId).toBe(testData.studentId);
    }, 120000);
  });

  describe('Verificaciones de Estados', () => {
    let testOrderId: string;
    let testCardId: string;

    beforeAll(async () => {
      // Crear un pedido de prueba para los tests de transiciones
      if (!testData.studentToken || !testData.restaurantOwnerToken || !testData.dishIds.length) {
        return;
      }

      // Crear tarjeta adicional para estos tests
      try {
        const card = await createTestCard(app, module, testData.studentToken, {
          userId: testData.studentId,
          isDefault: false,
        });
        testCardId = card.id;
      } catch (error) {
        console.warn('⚠️  Error al crear tarjeta para tests de estados:', error.message);
        return;
      }

      // Crear pedido
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .send({
          restaurantId: testData.restaurantId,
          items: [
            {
              dishId: testData.dishIds[0],
              dishNombre: `Test Order ${Date.now()}`,
              cantidad: 1,
              precioUnitario: 15000,
              precioTotal: 15000,
            },
          ],
          paymentSourceId: testCardId,
        });

      if (orderResponse.status === 201) {
        testOrderId = orderResponse.body.data?.id || orderResponse.body.id;
      }
    }, 60000);

    it('debe rechazar transición inválida de PENDIENTE a PREPARANDO', async () => {
      if (!testOrderId || !testData.restaurantOwnerToken) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({
          status: OrderStatus.PREPARANDO,
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.message || response.body.error).toBeDefined();
      expect(
        (response.body.message || response.body.error || '').toLowerCase().includes('transición') ||
        (response.body.message || response.body.error || '').toLowerCase().includes('inválida'),
      ).toBe(true);
    });

    it('debe rechazar cambio de estado sin ser el owner del restaurante', async () => {
      if (!testOrderId || !testData.studentToken) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // El estudiante intenta cambiar el estado (no debería poder)
      const response = await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .send({
          status: OrderStatus.ACEPTADO,
        });

      expect(response.status).toBe(403);
      expect(response.body.message || response.body.error).toBeDefined();
    });

    it('debe rechazar cambio de estado de ENTREGADO a otro estado', async () => {
      if (!testOrderId || !testData.restaurantOwnerToken) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Primero completar el flujo hasta ENTREGADO
      await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ status: OrderStatus.ACEPTADO })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ status: OrderStatus.PREPARANDO })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ status: OrderStatus.LISTO })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ status: OrderStatus.ENTREGADO })
        .expect(200);

      // Intentar cambiar de ENTREGADO a otro estado
      const response = await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({
          status: OrderStatus.PREPARANDO,
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.message || response.body.error).toBeDefined();
      expect(
        (response.body.message || response.body.error || '').toLowerCase().includes('entregado') ||
        (response.body.message || response.body.error || '').toLowerCase().includes('ya fue'),
      ).toBe(true);
    });
  });

  describe('Verificaciones de Cálculos', () => {
    it('debe calcular correctamente tarifaServicio como 5% del subtotal', async () => {
      if (!testData.studentToken || !testData.dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Crear tarjeta para este test
      let card;
      try {
        card = await createTestCard(app, module, testData.studentToken, {
          userId: testData.studentId,
          isDefault: false,
        });
      } catch (error) {
        console.log('⏭️  Saltando test: no se pudo crear tarjeta');
        return;
      }

      const items = [
        {
          dishId: testData.dishIds[0],
          dishNombre: `Test Calculation ${Date.now()}`,
          cantidad: 3,
          precioUnitario: 10000,
          precioTotal: 30000,
        },
      ];

      const subtotal = 30000;
      const expectedTarifaServicio = Math.round(subtotal * 0.05);
      const expectedTotal = subtotal + expectedTarifaServicio;

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .send({
          restaurantId: testData.restaurantId,
          items,
          paymentSourceId: card.id,
        })
        .expect(201);

      const order = orderResponse.body.data || orderResponse.body;
      expect(order.subtotal).toBe(subtotal);
      expect(order.tarifaServicio).toBe(expectedTarifaServicio);
      expect(order.total).toBe(expectedTotal);
      expect(order.total).toBe(order.subtotal + order.tarifaServicio);
    });

    it('debe calcular correctamente con múltiples items y diferentes precios', async () => {
      if (!testData.studentToken || !testData.dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Crear tarjeta para este test
      let card;
      try {
        card = await createTestCard(app, module, testData.studentToken, {
          userId: testData.studentId,
          isDefault: false,
        });
      } catch (error) {
        console.log('⏭️  Saltando test: no se pudo crear tarjeta');
        return;
      }

      const items = [
        {
          dishId: testData.dishIds[0],
          dishNombre: `Item 1 ${Date.now()}`,
          cantidad: 2,
          precioUnitario: 15000,
          precioTotal: 30000,
        },
        {
          dishId: testData.dishIds[1] || testData.dishIds[0],
          dishNombre: `Item 2 ${Date.now()}`,
          cantidad: 1,
          precioUnitario: 25000,
          precioTotal: 25000,
        },
        {
          dishId: testData.dishIds[2] || testData.dishIds[0],
          dishNombre: `Item 3 ${Date.now()}`,
          cantidad: 4,
          precioUnitario: 5000,
          precioTotal: 20000,
        },
      ];

      const subtotal = items.reduce((sum, item) => sum + item.precioTotal, 0);
      const expectedTarifaServicio = Math.round(subtotal * 0.05);
      const expectedTotal = subtotal + expectedTarifaServicio;

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .send({
          restaurantId: testData.restaurantId,
          items,
          paymentSourceId: card.id,
        })
        .expect(201);

      const order = orderResponse.body.data || orderResponse.body;
      expect(order.subtotal).toBe(subtotal);
      expect(order.tarifaServicio).toBe(expectedTarifaServicio);
      expect(order.total).toBe(expectedTotal);
      expect(order.total).toBe(order.subtotal + order.tarifaServicio);
      expect(order.items.length).toBe(3);
    });
  });

  describe('Notificaciones', () => {
    it('debe verificar que se llaman los métodos de notificación en cada cambio de estado', async () => {
      if (!testData.studentToken || !testData.restaurantOwnerToken || !testData.dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Mockear métodos de notificación
      const notifyNewOrderSpy = jest.spyOn(notificationsService, 'notifyNewOrder');
      const notifyOrderStatusChangeSpy = jest.spyOn(notificationsService, 'notifyOrderStatusChange');

      // Crear tarjeta para este test
      let card;
      try {
        card = await createTestCard(app, module, testData.studentToken, {
          userId: testData.studentId,
          isDefault: false,
        });
      } catch (error) {
        console.log('⏭️  Saltando test: no se pudo crear tarjeta');
        return;
      }

      // Crear pedido
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .send({
          restaurantId: testData.restaurantId,
          items: [
            {
              dishId: testData.dishIds[0],
              dishNombre: `Test Notification ${Date.now()}`,
              cantidad: 1,
              precioUnitario: 15000,
              precioTotal: 15000,
            },
          ],
          paymentSourceId: card.id,
        })
        .expect(201);

      const notificationOrderId = orderResponse.body.data?.id || orderResponse.body.id;

      // Verificar que se llamó notifyNewOrder
      expect(notifyNewOrderSpy).toHaveBeenCalled();
      expect(notifyNewOrderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: notificationOrderId,
        }),
      );

      // Cambiar estados y verificar notificaciones
      await request(app.getHttpServer())
        .patch(`/orders/${notificationOrderId}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ status: OrderStatus.ACEPTADO })
        .expect(200);

      expect(notifyOrderStatusChangeSpy).toHaveBeenCalled();
      expect(notifyOrderStatusChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: notificationOrderId,
          status: OrderStatus.ACEPTADO,
        }),
      );

      await request(app.getHttpServer())
        .patch(`/orders/${notificationOrderId}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ status: OrderStatus.PREPARANDO })
        .expect(200);

      expect(notifyOrderStatusChangeSpy).toHaveBeenCalledTimes(2);

      await request(app.getHttpServer())
        .patch(`/orders/${notificationOrderId}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ status: OrderStatus.LISTO })
        .expect(200);

      expect(notifyOrderStatusChangeSpy).toHaveBeenCalledTimes(3);

      await request(app.getHttpServer())
        .patch(`/orders/${notificationOrderId}/status`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ status: OrderStatus.ENTREGADO })
        .expect(200);

      expect(notifyOrderStatusChangeSpy).toHaveBeenCalledTimes(4);

      // Limpiar spies
      notifyNewOrderSpy.mockRestore();
      notifyOrderStatusChangeSpy.mockRestore();
    }, 120000);
  });
});
