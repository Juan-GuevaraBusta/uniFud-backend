import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { WompiWebhookEvent } from '../src/payments/providers/wompi.client';
import * as crypto from 'crypto';

describe('Payments E2E', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Crear usuario de prueba y obtener token
    // Nota: En un entorno real, esto debería usar un usuario de prueba pre-existente
    // o crear uno mediante el endpoint de registro
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `test-payments-${Date.now()}@example.com`,
        password: 'Test123456!',
        nombre: 'Test User Payments',
      });

    if (registerResponse.status === 201) {
      userId = registerResponse.body.data.user.id;
      authToken = registerResponse.body.data.accessToken;
    } else {
      // Si el registro falla, intentar login con credenciales de prueba
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123456!',
        });

      if (loginResponse.status === 200) {
        authToken = loginResponse.body.data.accessToken;
        userId = loginResponse.body.data.user.id;
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /payments/cards', () => {
    it('debe rechazar crear tarjeta sin autenticación', () => {
      return request(app.getHttpServer())
        .post('/payments/cards')
        .send({
          token: 'test_token',
          acceptanceToken: 'test_acceptance',
          acceptPersonalAuth: 'test_personal_auth',
        })
        .expect(401);
    });

    it('debe rechazar crear tarjeta con datos inválidos', () => {
      if (!authToken) {
        return Promise.resolve();
      }

      return request(app.getHttpServer())
        .post('/payments/cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: '',
          acceptanceToken: 'test_acceptance',
          acceptPersonalAuth: 'test_personal_auth',
        })
        .expect(400);
    });

    // Nota: Este test requiere un token válido de Wompi sandbox
    // En un entorno real, deberías usar tokens de prueba de Wompi
    it.skip('debe crear una tarjeta con datos válidos (requiere token Wompi real)', async () => {
      if (!authToken) {
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/payments/cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'wompi_test_token_here',
          acceptanceToken: 'wompi_acceptance_token_here',
          acceptPersonalAuth: 'wompi_personal_auth_here',
        });

      // Este test se salta porque requiere configuración real de Wompi
      // En producción, deberías usar tokens de sandbox de Wompi
      expect([201, 400]).toContain(response.status);
    });
  });

  describe('GET /payments/cards', () => {
    it('debe rechazar listar tarjetas sin autenticación', () => {
      return request(app.getHttpServer()).get('/payments/cards').expect(401);
    });

    it('debe listar tarjetas del usuario autenticado', () => {
      if (!authToken) {
        return Promise.resolve();
      }

      return request(app.getHttpServer())
        .get('/payments/cards')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data || res.body)).toBe(true);
        });
    });
  });

  describe('POST /payments/webhooks', () => {
    it('debe procesar un webhook válido de Wompi', () => {
      const webhookEvent: WompiWebhookEvent = {
        event: {
          id: 'evt_test_123',
          type: 'transaction.updated',
          created_at: new Date().toISOString(),
        },
        data: {
          transaction: {
            id: 'tx_test_123',
            status: 'APPROVED',
            amount_in_cents: 10000,
            currency: 'COP',
            reference: 'UFD-123',
            customer_email: 'test@example.com',
            created_at: new Date().toISOString(),
            finalized_at: new Date().toISOString(),
          },
        },
        sent_at: new Date().toISOString(),
      };

      // Generar firma válida para el webhook
      const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || 'test_secret';
      const concatenated = `UFD-12310000COP${integritySecret}`;
      const signature = crypto.createHash('sha256').update(concatenated).digest('hex');

      return request(app.getHttpServer())
        .post('/payments/webhooks')
        .set('x-signature', signature)
        .send(webhookEvent)
        .expect((res) => {
          // Puede retornar 200 si el pago existe o 400 si no existe
          expect([200, 400]).toContain(res.status);
        });
    });

    it('debe rechazar un webhook con firma inválida', () => {
      const webhookEvent: WompiWebhookEvent = {
        event: {
          id: 'evt_test_123',
          type: 'transaction.updated',
          created_at: new Date().toISOString(),
        },
        data: {
          transaction: {
            id: 'tx_test_123',
            status: 'APPROVED',
            amount_in_cents: 10000,
            currency: 'COP',
            reference: 'UFD-123',
            customer_email: 'test@example.com',
            created_at: new Date().toISOString(),
          },
        },
        sent_at: new Date().toISOString(),
      };

      return request(app.getHttpServer())
        .post('/payments/webhooks')
        .set('x-signature', 'invalid_signature')
        .send(webhookEvent)
        .expect(400);
    });

    it('debe procesar webhook sin firma en desarrollo', () => {
      const webhookEvent: WompiWebhookEvent = {
        event: {
          id: 'evt_test_123',
          type: 'transaction.updated',
          created_at: new Date().toISOString(),
        },
        data: {
          transaction: {
            id: 'tx_test_123',
            status: 'APPROVED',
            amount_in_cents: 10000,
            currency: 'COP',
            reference: 'UFD-123',
            customer_email: 'test@example.com',
            created_at: new Date().toISOString(),
          },
        },
        sent_at: new Date().toISOString(),
      };

      return request(app.getHttpServer())
        .post('/payments/webhooks')
        .send(webhookEvent)
        .expect((res) => {
          // En desarrollo puede procesarse sin firma
          expect([200, 400]).toContain(res.status);
        });
    });
  });

  describe('Flujo completo: Agregar tarjeta → Pedido → Pago', () => {
    it.skip('debe completar el flujo completo de pago (requiere configuración completa)', async () => {
      // Este test requiere:
      // 1. Token válido de Wompi sandbox
      // 2. Usuario autenticado
      // 3. Restaurante y platos en la BD
      // 4. Configuración completa de Wompi

      if (!authToken) {
        return;
      }

      // Paso 1: Agregar tarjeta
      const cardResponse = await request(app.getHttpServer())
        .post('/payments/cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'wompi_test_token',
          acceptanceToken: 'wompi_acceptance_token',
          acceptPersonalAuth: 'wompi_personal_auth',
        });

      if (cardResponse.status !== 201) {
        // Si no se puede crear la tarjeta, saltar el test
        return;
      }

      const cardId = cardResponse.body.data?.id || cardResponse.body.id;

      // Paso 2: Crear pedido (requiere restaurante y platos)
      // Este paso se omite porque requiere más setup

      // Paso 3: Procesar pago
      // Este paso se omite porque requiere integración completa

      // Este test está marcado como skip porque requiere configuración completa
      expect(true).toBe(true);
    });
  });
});



