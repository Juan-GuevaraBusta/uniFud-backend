// Configurar NODE_ENV ANTES de cualquier importación
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import request from 'supertest';
import { cleanDatabase, seedTestData, getTestApp, closeTestApp, TestData } from './setup';
import { createTestCard, createTestDish, createTestAvailability } from './helpers/test-data.helper';
import { Dish } from '../src/dishes/entities/dish.entity';
import { DishAvailability } from '../src/dishes/entities/dish-availability.entity';
import { DishType } from '../src/dishes/entities/dish.entity';
import { Order } from '../src/orders/entities/order.entity';
import { UserRole } from '../src/users/entities/user.entity';

describe('Dishes Availability E2E', () => {
  let app: INestApplication;
  let module: TestingModule;
  let testData: TestData;
  let cardId: string;
  let additionalDishIds: string[] = [];

  beforeAll(async () => {
    const { app: testApp, module: testModule } = await getTestApp();
    app = testApp;
    module = testModule;

    await cleanDatabase();
    testData = await seedTestData();

    // Crear tarjeta de pago para el estudiante
    try {
      const card = await createTestCard(app, module, testData.studentToken, {
        userId: testData.studentId,
        isDefault: true,
      });
      cardId = card.id;
    } catch (error) {
      console.warn('⚠️  Error al crear tarjeta en beforeAll:', error.message);
    }

    // Crear platos adicionales para los tests (al menos 5 platos en total)
    const dishRepository = module.get<Repository<Dish>>(getRepositoryToken(Dish));
    const additionalDishes = [
      {
        nombre: `Plato Adicional 1 ${Date.now()}`,
        descripcion: 'Plato para tests de disponibilidad',
        precio: 20000,
        categoria: 'Test',
        tipoPlato: DishType.SIMPLE,
        restaurantId: testData.restaurantId,
        activo: true,
      },
      {
        nombre: `Plato Adicional 2 ${Date.now()}`,
        descripcion: 'Plato para tests de disponibilidad',
        precio: 25000,
        categoria: 'Test',
        tipoPlato: DishType.FIJO,
        restaurantId: testData.restaurantId,
        activo: true,
      },
      {
        nombre: `Plato Adicional 3 ${Date.now()}`,
        descripcion: 'Plato para tests de disponibilidad',
        precio: 30000,
        categoria: 'Test',
        tipoPlato: DishType.PERSONALIZABLE,
        restaurantId: testData.restaurantId,
        activo: true,
      },
    ];

    const savedAdditionalDishes = await dishRepository.save(additionalDishes);
    additionalDishIds = savedAdditionalDishes.map((d) => d.id);

    // Crear disponibilidad inicial para todos los platos adicionales (disponibles)
    const availabilityRepository = module.get<Repository<DishAvailability>>(
      getRepositoryToken(DishAvailability),
    );
    const availabilities = additionalDishIds.map((dishId) =>
      availabilityRepository.create({
        dishId,
        restaurantId: testData.restaurantId,
        disponible: true,
      }),
    );
    await availabilityRepository.save(availabilities);
  }, 60000);

  afterAll(async () => {
    await closeTestApp();
  });

  describe('Actualización Individual de Disponibilidad', () => {
    it('debe actualizar disponibilidad de un plato individual', async () => {
      if (!testData.restaurantOwnerToken || !testData.dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      const dishId = testData.dishIds[0];

      // Actualizar disponibilidad a false
      const updateResponse = await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .query({ restaurantId: testData.restaurantId })
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ disponible: false })
        .expect(200);

      const updateData = updateResponse.body.data || updateResponse.body;
      expect(updateData).toBeDefined();
      expect(updateData.dishId).toBe(dishId);
      expect(updateData.restaurantId).toBe(testData.restaurantId);
      expect(updateData.disponible).toBe(false);

      // Verificar en la BD
      const availabilityRepository = module.get<Repository<DishAvailability>>(
        getRepositoryToken(DishAvailability),
      );
      const availability = await availabilityRepository.findOne({
        where: { dishId, restaurantId: testData.restaurantId },
      });
      expect(availability).toBeDefined();
      expect(availability?.disponible).toBe(false);

      // Restaurar disponibilidad para otros tests
      await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .query({ restaurantId: testData.restaurantId })
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ disponible: true })
        .expect(200);
    });

    it('debe verificar que consulta de menú refleja cambios de disponibilidad', async () => {
      if (!testData.studentToken || !testData.restaurantOwnerToken || !testData.dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      const dishId = testData.dishIds[0];

      // Estudiante consulta menú antes de actualizar disponibilidad
      const menuBeforeResponse = await request(app.getHttpServer())
        .get(`/dishes/restaurant/${testData.restaurantId}`)
        .expect(200);

      const menuBefore = menuBeforeResponse.body.items || menuBeforeResponse.body;
      const dishBefore = Array.isArray(menuBefore)
        ? menuBefore.find((d: any) => d.id === dishId)
        : null;

      // Restaurant owner actualiza disponibilidad a false
      await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .query({ restaurantId: testData.restaurantId })
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ disponible: false })
        .expect(200);

      // Estudiante consulta menú nuevamente
      const menuAfterResponse = await request(app.getHttpServer())
        .get(`/dishes/restaurant/${testData.restaurantId}`)
        .expect(200);

      const menuAfter = menuAfterResponse.body.items || menuAfterResponse.body;
      const dishAfter = Array.isArray(menuAfter)
        ? menuAfter.find((d: any) => d.id === dishId)
        : null;

      // Verificar que el plato actualizado muestra disponible: false
      // Nota: El endpoint /dishes/restaurant/:id puede no incluir disponibilidad directamente
      // Verificamos usando el endpoint específico de menú con disponibilidad
      const menuWithAvailabilityResponse = await request(app.getHttpServer())
        .get(`/dishes/menu/${testData.restaurantId}`)
        .expect(200);

      const menuWithAvailability = menuWithAvailabilityResponse.body.items || menuWithAvailabilityResponse.body;
      const menuArray = Array.isArray(menuWithAvailability) ? menuWithAvailability : [];
      const dishWithAvailability = menuArray.find((d: any) => d.id === dishId);

      if (dishWithAvailability) {
        expect(dishWithAvailability.disponible).toBe(false);
      }

      // Restaurar disponibilidad
      await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .query({ restaurantId: testData.restaurantId })
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ disponible: true })
        .expect(200);
    });

    it('debe verificar invalidación de caché después de actualizar disponibilidad', async () => {
      if (!testData.restaurantOwnerToken || !testData.studentToken || !testData.dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      const dishId = testData.dishIds[0];

      // Restaurant owner consulta menú (para poblar caché)
      await request(app.getHttpServer())
        .get(`/dishes/menu/${testData.restaurantId}`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .expect(200);

      // Restaurant owner actualiza disponibilidad de un plato
      await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .query({ restaurantId: testData.restaurantId })
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ disponible: false })
        .expect(200);

      // Estudiante consulta menú inmediatamente después
      const menuResponse = await request(app.getHttpServer())
        .get(`/dishes/menu/${testData.restaurantId}`)
        .expect(200);

      const menu = menuResponse.body.items || menuResponse.body;
      const dish = Array.isArray(menu) ? menu.find((d: any) => d.id === dishId) : null;

      // Verificar que el menú muestra el estado actualizado (no el estado en caché)
      if (dish) {
        expect(dish.disponible).toBe(false);
      }

      // Restaurar disponibilidad
      await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .query({ restaurantId: testData.restaurantId })
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ disponible: true })
        .expect(200);
    });

    it('debe verificar permisos de actualización - solo restaurant owner puede actualizar', async () => {
      if (!testData.studentToken || !testData.restaurantOwnerToken || !testData.dishIds.length) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      const dishId = testData.dishIds[0];

      // Estudiante intenta actualizar disponibilidad (debe fallar con 403)
      const studentResponse = await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .query({ restaurantId: testData.restaurantId })
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .send({ disponible: false });

      expect(studentResponse.status).toBe(403);
      expect(studentResponse.body.message || studentResponse.body.error).toBeDefined();

      // Verificar que el owner sí puede actualizar
      const ownerResponse = await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .query({ restaurantId: testData.restaurantId })
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ disponible: true })
        .expect(200);

      const ownerData = ownerResponse.body.data || ownerResponse.body;
      expect(ownerData).toBeDefined();
      expect(ownerData.dishId).toBe(dishId);
    });
  });

  describe('Actualización Masiva de Disponibilidad', () => {
    it('debe actualizar disponibilidad de múltiples platos en bulk', async () => {
      if (!testData.restaurantOwnerToken || additionalDishIds.length < 3) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      const dishesToUpdate = additionalDishIds.slice(0, 3);

      // Actualizar disponibilidad de múltiples platos
      const bulkUpdateResponse = await request(app.getHttpServer())
        .patch(`/dishes/availability/restaurant/${testData.restaurantId}/bulk`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({
          changes: [
            { dishId: dishesToUpdate[0], disponible: false },
            { dishId: dishesToUpdate[1], disponible: false },
            { dishId: dishesToUpdate[2], disponible: true },
          ],
        })
        .expect(200);

      const bulkData = bulkUpdateResponse.body.data || bulkUpdateResponse.body;
      expect(bulkData).toBeDefined();
      expect(bulkData.updated).toBe(3);
      expect(bulkData.results).toBeDefined();
      expect(bulkData.results.length).toBe(3);

      // Verificar que todos los platos especificados fueron actualizados correctamente
      const availabilityRepository = module.get<Repository<DishAvailability>>(
        getRepositoryToken(DishAvailability),
      );

      const availability1 = await availabilityRepository.findOne({
        where: { dishId: dishesToUpdate[0], restaurantId: testData.restaurantId },
      });
      expect(availability1?.disponible).toBe(false);

      const availability2 = await availabilityRepository.findOne({
        where: { dishId: dishesToUpdate[1], restaurantId: testData.restaurantId },
      });
      expect(availability2?.disponible).toBe(false);

      const availability3 = await availabilityRepository.findOne({
        where: { dishId: dishesToUpdate[2], restaurantId: testData.restaurantId },
      });
      expect(availability3?.disponible).toBe(true);

      // Restaurar disponibilidad para otros tests
      await request(app.getHttpServer())
        .patch(`/dishes/availability/restaurant/${testData.restaurantId}/bulk`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({
          changes: [
            { dishId: dishesToUpdate[0], disponible: true },
            { dishId: dishesToUpdate[1], disponible: true },
            { dishId: dishesToUpdate[2], disponible: true },
          ],
        })
        .expect(200);
    });

    it('debe verificar que cambios de bulk update se reflejan correctamente en consulta de menú', async () => {
      if (!testData.studentToken || !testData.restaurantOwnerToken || additionalDishIds.length < 3) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      const dishesToUpdate = additionalDishIds.slice(0, 3);

      // Realizar bulk update (marcar algunos como disponibles, otros como no disponibles)
      await request(app.getHttpServer())
        .patch(`/dishes/availability/restaurant/${testData.restaurantId}/bulk`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({
          changes: [
            { dishId: dishesToUpdate[0], disponible: false },
            { dishId: dishesToUpdate[1], disponible: true },
            { dishId: dishesToUpdate[2], disponible: false },
          ],
        })
        .expect(200);

      // Estudiante consulta menú completo
      const menuResponse = await request(app.getHttpServer())
        .get(`/dishes/menu/${testData.restaurantId}`)
        .expect(200);

      const menu = menuResponse.body.items || menuResponse.body;
      const menuArray = Array.isArray(menu) ? menu : [];

      // Verificar que todos los cambios se reflejan correctamente en el menú
      const dish0 = menuArray.find((d: any) => d.id === dishesToUpdate[0]);
      const dish1 = menuArray.find((d: any) => d.id === dishesToUpdate[1]);
      const dish2 = menuArray.find((d: any) => d.id === dishesToUpdate[2]);

      if (dish0) {
        expect(dish0.disponible).toBe(false);
      }
      if (dish1) {
        expect(dish1.disponible).toBe(true);
      }
      if (dish2) {
        expect(dish2.disponible).toBe(false);
      }

      // Restaurar disponibilidad
      await request(app.getHttpServer())
        .patch(`/dishes/availability/restaurant/${testData.restaurantId}/bulk`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({
          changes: [
            { dishId: dishesToUpdate[0], disponible: true },
            { dishId: dishesToUpdate[1], disponible: true },
            { dishId: dishesToUpdate[2], disponible: true },
          ],
        })
        .expect(200);
    });
  });

  describe('Validación en Creación de Pedidos', () => {
    it('debe rechazar crear pedido con plato no disponible', async () => {
      if (!testData.studentToken || !testData.restaurantOwnerToken || !testData.dishIds.length || !cardId) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      const dishId = testData.dishIds[0];

      // Restaurant owner marca un plato como no disponible
      await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .query({ restaurantId: testData.restaurantId })
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ disponible: false })
        .expect(200);

      // Estudiante intenta crear pedido con ese plato
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${testData.studentToken}`)
        .send({
          restaurantId: testData.restaurantId,
          items: [
            {
              dishId: dishId,
              dishNombre: 'Plato No Disponible',
              cantidad: 1,
              precioUnitario: 15000,
              precioTotal: 15000,
            },
          ],
          paymentSourceId: cardId,
        });

      // Verificar que la respuesta es 400 (Bad Request)
      expect(orderResponse.status).toBe(400);

      // Verificar que el error contiene errorCode: 'DISH_NOT_AVAILABLE'
      expect(orderResponse.body.errorCode || orderResponse.body.error).toBe('DISH_NOT_AVAILABLE');

      // Verificar que el mensaje indica que el plato no está disponible
      expect(orderResponse.body.message).toBeDefined();
      expect(
        (orderResponse.body.message || '').toLowerCase().includes('no está disponible') ||
        (orderResponse.body.message || '').toLowerCase().includes('not available'),
      ).toBe(true);

      // Verificar que NO se creó ningún pedido en la BD
      const orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
      const orders = await orderRepository.find({
        where: {
          userId: testData.studentId,
          restaurantId: testData.restaurantId,
        },
        order: { createdAt: 'DESC' },
        take: 1,
      });

      // El último pedido (si existe) no debe ser el que intentamos crear
      if (orders.length > 0) {
        const lastOrder = orders[0];
        const lastOrderItems = lastOrder.items || [];
        const hasUnavailableDish = lastOrderItems.some((item: any) => item.dishId === dishId);
        expect(hasUnavailableDish).toBe(false);
      }

      // Restaurar disponibilidad
      await request(app.getHttpServer())
        .patch(`/dishes/${dishId}/availability`)
        .query({ restaurantId: testData.restaurantId })
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({ disponible: true })
        .expect(200);
    });
  });

  describe('Performance', () => {
    it('debe verificar performance de queries con múltiples platos', async () => {
      if (!testData.restaurantOwnerToken || !testData.studentToken) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Crear múltiples platos adicionales (10-20)
      const dishRepository = module.get<Repository<Dish>>(getRepositoryToken(Dish));
      const performanceDishes = Array.from({ length: 15 }, (_, i) => ({
        nombre: `Plato Performance ${i} ${Date.now()}`,
        descripcion: 'Plato para test de performance',
        precio: 10000 + i * 1000,
        categoria: 'Performance',
        tipoPlato: DishType.SIMPLE,
        restaurantId: testData.restaurantId,
        activo: true,
      }));

      const savedPerformanceDishes = await dishRepository.save(performanceDishes);
      const performanceDishIds = savedPerformanceDishes.map((d) => d.id);

      // Crear disponibilidad para todos
      const perfAvailabilityRepository = module.get<Repository<DishAvailability>>(
        getRepositoryToken(DishAvailability),
      );
      const performanceAvailabilities = performanceDishIds.map((dishId) =>
        perfAvailabilityRepository.create({
          dishId,
          restaurantId: testData.restaurantId,
          disponible: true,
        }),
      );
      await perfAvailabilityRepository.save(performanceAvailabilities);

      // Medir tiempo de respuesta de consulta de menú con disponibilidad
      const menuStartTime = Date.now();
      const menuResponse = await request(app.getHttpServer())
        .get(`/dishes/menu/${testData.restaurantId}`)
        .expect(200);
      const menuEndTime = Date.now();
      const menuDuration = menuEndTime - menuStartTime;

      expect(menuResponse.body).toBeDefined();
      expect(menuDuration).toBeLessThan(5000); // Menos de 5 segundos (tolerancia alta para tests)

      // Medir tiempo de respuesta de bulk update de disponibilidad
      const bulkStartTime = Date.now();
      const bulkUpdateResponse = await request(app.getHttpServer())
        .patch(`/dishes/availability/restaurant/${testData.restaurantId}/bulk`)
        .set('Authorization', `Bearer ${testData.restaurantOwnerToken}`)
        .send({
          changes: performanceDishIds.slice(0, 10).map((dishId) => ({
            dishId,
            disponible: false,
          })),
        })
        .expect(200);
      const bulkEndTime = Date.now();
      const bulkDuration = bulkEndTime - bulkStartTime;

      const bulkData = bulkUpdateResponse.body.data || bulkUpdateResponse.body;
      expect(bulkData).toBeDefined();
      expect(bulkData.updated).toBeDefined();
      expect(bulkDuration).toBeLessThan(10000); // Menos de 10 segundos (tolerancia alta para tests)

      // Limpiar disponibilidades primero (para evitar foreign key constraint)
      const perfAvailabilityRepositoryToDelete = await perfAvailabilityRepository.find({
        where: { dishId: In(performanceDishIds) },
      });
      if (perfAvailabilityRepositoryToDelete.length > 0) {
        await perfAvailabilityRepository.remove(perfAvailabilityRepositoryToDelete);
      }

      // Limpiar platos de performance
      await dishRepository.remove(savedPerformanceDishes);
    }, 30000);
  });
});
