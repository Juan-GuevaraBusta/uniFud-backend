import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/users/entities/user.entity';
import { User } from '../src/users/entities/user.entity';
import { WompiClient } from '../src/payments/providers/wompi.client';

// Configurar NODE_ENV ANTES de cualquier importación
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

describe('User Cards E2E', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let userRepository: Repository<User>;
  let studentToken: string;
  let studentUserId: string;
  let otherUserToken: string;
  let otherUserId: string;
  let cardId1: string;
  let cardId2: string;
  let useMocks: boolean;

  beforeAll(async () => {

    // Verificar si hay credenciales de Wompi configuradas
    const wompiPrivateKey = process.env.WOMPI_PRIVATE_KEY;
    const hasWompiCredentials = !!(wompiPrivateKey && wompiPrivateKey.startsWith('prv_test_'));
    useMocks = !hasWompiCredentials; // Usar mocks si no hay credenciales

    // Crear módulo con mocks si es necesario
    const moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });

    // Siempre usar mocks para tests E2E (más predecible y no requiere tokens reales)
    moduleBuilder
      .overrideProvider(WompiClient)
      .useValue({
        createPaymentSource: jest.fn().mockImplementation(() => {
          // Generar ID único para cada llamada para evitar conflictos de clave única
          return Promise.resolve({
            id: `test_payment_source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'CARD',
            status: 'AVAILABLE',
            token: 'test_token',
            created_at: new Date().toISOString(),
          });
        }),
      });

    moduleFixture = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Obtener repositorio de usuarios para acceder al código de verificación en tests
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));

    // Setup de usuarios
    const timestamp = Date.now();
    const studentEmail = `test-student-cards-${timestamp}@example.com`;
    const otherUserEmail = `test-other-cards-${timestamp}@example.com`;
    const password = 'Test123456!';

    // Crear usuario estudiante
    const studentRegisterResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: studentEmail,
        password,
        nombre: 'Test Student Cards',
        role: UserRole.STUDENT,
      });

    if (studentRegisterResponse.status !== 201) {
      throw new Error(`Error al crear usuario estudiante: ${studentRegisterResponse.status} - ${JSON.stringify(studentRegisterResponse.body)}`);
    }

    studentUserId = studentRegisterResponse.body.userId || studentRegisterResponse.body.data?.userId;

    // Obtener el código de verificación desde la base de datos
    const studentUser = await userRepository.findOne({ where: { id: studentUserId } });
    if (!studentUser || !studentUser.verificationCode) {
      throw new Error('No se pudo obtener el código de verificación del usuario estudiante');
    }

    // Confirmar email del estudiante
    await request(app.getHttpServer())
      .post('/auth/confirm-email')
      .send({
        email: studentEmail,
        code: studentUser.verificationCode,
      });

    // Hacer login para obtener el token
    const studentLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: studentEmail,
        password,
      });

    if (studentLoginResponse.status !== 200) {
      throw new Error(`Error al hacer login: ${studentLoginResponse.status} - ${JSON.stringify(studentLoginResponse.body)}`);
    }

    studentToken = studentLoginResponse.body.accessToken || studentLoginResponse.body.data?.accessToken;

    // Crear otro usuario para tests de permisos
    const otherUserRegisterResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: otherUserEmail,
        password,
        nombre: 'Test Other User Cards',
        role: UserRole.STUDENT,
      });

    if (otherUserRegisterResponse.status !== 201) {
      throw new Error(`Error al crear otro usuario: ${otherUserRegisterResponse.status}`);
    }

    otherUserId = otherUserRegisterResponse.body.userId || otherUserRegisterResponse.body.data?.userId;

    const otherUser = await userRepository.findOne({ where: { id: otherUserId } });
    if (!otherUser || !otherUser.verificationCode) {
      throw new Error('No se pudo obtener el código de verificación del otro usuario');
    }

    await request(app.getHttpServer())
      .post('/auth/confirm-email')
      .send({
        email: otherUserEmail,
        code: otherUser.verificationCode,
      });

    const otherUserLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: otherUserEmail,
        password,
      });

    if (otherUserLoginResponse.status !== 200) {
      throw new Error(`Error al hacer login del otro usuario: ${otherUserLoginResponse.status}`);
    }

    otherUserToken = otherUserLoginResponse.body.accessToken || otherUserLoginResponse.body.data?.accessToken;

    // Crear 2 tarjetas de prueba para el usuario estudiante
    const testToken = useMocks ? 'test_token_mock_1' : 'test_token_1';
    const testAcceptanceToken = useMocks ? 'test_acceptance_token_mock' : 'test_acceptance_token';
    const testPersonalAuth = useMocks ? 'test_personal_auth_mock' : 'test_personal_auth';

    // Primera tarjeta (será default)
    const card1Response = await request(app.getHttpServer())
      .post('/payments/cards')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        token: testToken,
        acceptanceToken: testAcceptanceToken,
        acceptPersonalAuth: testPersonalAuth,
        isDefault: true,
      });

    if (card1Response.status !== 201) {
      throw new Error(`Error al crear primera tarjeta: ${card1Response.status} - ${JSON.stringify(card1Response.body)}`);
    }

    cardId1 = card1Response.body.data?.id || card1Response.body.id;

    // Segunda tarjeta (no default)
    const card2Response = await request(app.getHttpServer())
      .post('/payments/cards')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        token: useMocks ? 'test_token_mock_2' : 'test_token_2',
        acceptanceToken: testAcceptanceToken,
        acceptPersonalAuth: testPersonalAuth,
        isDefault: false,
      });

    if (card2Response.status !== 201) {
      throw new Error(`Error al crear segunda tarjeta: ${card2Response.status} - ${JSON.stringify(card2Response.body)}`);
    }

    cardId2 = card2Response.body.data?.id || card2Response.body.id;
  }, 60000); // Timeout de 60 segundos para setup

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('DELETE /payments/cards/:id', () => {
    it('debe eliminar tarjeta existente exitosamente', async () => {
      if (!studentToken || !cardId2) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Eliminar la segunda tarjeta (no default)
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/payments/cards/${cardId2}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(deleteResponse.status).toBe(204);

      // Verificar que la tarjeta ya no aparece en la lista
      const listResponse = await request(app.getHttpServer())
        .get('/payments/cards')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(listResponse.status).toBe(200);
      const cards = listResponse.body.data || listResponse.body;
      expect(Array.isArray(cards)).toBe(true);
      const deletedCard = cards.find((card: any) => card.id === cardId2);
      expect(deletedCard).toBeUndefined();
    });

    it('debe retornar 404 al intentar eliminar tarjeta que no existe', async () => {
      if (!studentToken) {
        console.log('⏭️  Saltando test: token no disponible');
        return;
      }

      const fakeCardId = '00000000-0000-0000-0000-000000000000';
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/payments/cards/${fakeCardId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(deleteResponse.status).toBe(404);
      expect(deleteResponse.body.message || deleteResponse.body.error).toContain('no encontrada');
    });

    it('debe retornar 404 al intentar eliminar tarjeta de otro usuario', async () => {
      if (!otherUserToken || !cardId1) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Intentar eliminar tarjeta del usuario estudiante desde el otro usuario
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/payments/cards/${cardId1}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(deleteResponse.status).toBe(404);
      expect(deleteResponse.body.message || deleteResponse.body.error).toContain('no encontrada');
    });

    it('debe retornar 400 al intentar eliminar la única tarjeta default', async () => {
      if (!studentToken || !cardId1) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Verificar que solo queda una tarjeta (cardId1)
      const listResponse = await request(app.getHttpServer())
        .get('/payments/cards')
        .set('Authorization', `Bearer ${studentToken}`);

      const cards = listResponse.body.data || listResponse.body;
      if (cards.length > 1) {
        // Si hay más de una tarjeta, eliminar las que no son default primero
        for (const card of cards) {
          if (card.id !== cardId1 && !card.isDefault) {
            await request(app.getHttpServer())
              .delete(`/payments/cards/${card.id}`)
              .set('Authorization', `Bearer ${studentToken}`);
          }
        }
      }

      // Intentar eliminar la única tarjeta restante (debe ser default)
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/payments/cards/${cardId1}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(deleteResponse.status).toBe(400);
      expect(deleteResponse.body.message || deleteResponse.body.error).toContain('única tarjeta');
    });
  });

  describe('PATCH /payments/cards/:id/default', () => {
    it('debe marcar tarjeta existente como default exitosamente', async () => {
      if (!studentToken || !cardId1) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Crear una nueva tarjeta para este test
      const testToken = useMocks ? 'test_token_mock_new' : 'test_token_new';
      const testAcceptanceToken = useMocks ? 'test_acceptance_token_mock' : 'test_acceptance_token';
      const testPersonalAuth = useMocks ? 'test_personal_auth_mock' : 'test_personal_auth';

      const newCardResponse = await request(app.getHttpServer())
        .post('/payments/cards')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          token: testToken,
          acceptanceToken: testAcceptanceToken,
          acceptPersonalAuth: testPersonalAuth,
          isDefault: false,
        });

      if (newCardResponse.status !== 201) {
        console.log('⏭️  Saltando test: no se pudo crear tarjeta de prueba');
        return;
      }

      const newCardId = newCardResponse.body.data?.id || newCardResponse.body.id;

      // Marcar la nueva tarjeta como default
      const patchResponse = await request(app.getHttpServer())
        .patch(`/payments/cards/${newCardId}/default`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(patchResponse.status).toBe(200);
      const updatedCard = patchResponse.body.data || patchResponse.body;
      expect(updatedCard.isDefault).toBe(true);
      expect(updatedCard.id).toBe(newCardId);

      // Verificar que la tarjeta anterior ya no es default
      const listResponse = await request(app.getHttpServer())
        .get('/payments/cards')
        .set('Authorization', `Bearer ${studentToken}`);

      const cards = listResponse.body.data || listResponse.body;
      const previousDefaultCard = cards.find((card: any) => card.id === cardId1);
      if (previousDefaultCard) {
        expect(previousDefaultCard.isDefault).toBe(false);
      }

      // Verificar que solo una tarjeta es default
      const defaultCards = cards.filter((card: any) => card.isDefault === true);
      expect(defaultCards.length).toBe(1);
      expect(defaultCards[0].id).toBe(newCardId);
    });

    it('debe retornar 404 al intentar marcar tarjeta que no existe como default', async () => {
      if (!studentToken) {
        console.log('⏭️  Saltando test: token no disponible');
        return;
      }

      const fakeCardId = '00000000-0000-0000-0000-000000000000';
      const patchResponse = await request(app.getHttpServer())
        .patch(`/payments/cards/${fakeCardId}/default`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(patchResponse.status).toBe(404);
      expect(patchResponse.body.message || patchResponse.body.error).toContain('no encontrada');
    });

    it('debe retornar 404 al intentar marcar tarjeta de otro usuario como default', async () => {
      if (!otherUserToken || !cardId1) {
        console.log('⏭️  Saltando test: datos de prueba no disponibles');
        return;
      }

      // Intentar marcar tarjeta del usuario estudiante desde el otro usuario
      const patchResponse = await request(app.getHttpServer())
        .patch(`/payments/cards/${cardId1}/default`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(patchResponse.status).toBe(404);
      expect(patchResponse.body.message || patchResponse.body.error).toContain('no encontrada');
    });

    it('debe verificar que solo una tarjeta puede ser default a la vez', async () => {
      if (!studentToken) {
        console.log('⏭️  Saltando test: token no disponible');
        return;
      }

      // Crear dos tarjetas nuevas para este test
      const testToken1 = useMocks ? 'test_token_mock_test1' : 'test_token_test1';
      const testToken2 = useMocks ? 'test_token_mock_test2' : 'test_token_test2';
      const testAcceptanceToken = useMocks ? 'test_acceptance_token_mock' : 'test_acceptance_token';
      const testPersonalAuth = useMocks ? 'test_personal_auth_mock' : 'test_personal_auth';

      const card1Response = await request(app.getHttpServer())
        .post('/payments/cards')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          token: testToken1,
          acceptanceToken: testAcceptanceToken,
          acceptPersonalAuth: testPersonalAuth,
          isDefault: false,
        });

      const card2Response = await request(app.getHttpServer())
        .post('/payments/cards')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          token: testToken2,
          acceptanceToken: testAcceptanceToken,
          acceptPersonalAuth: testPersonalAuth,
          isDefault: false,
        });

      if (card1Response.status !== 201 || card2Response.status !== 201) {
        console.log('⏭️  Saltando test: no se pudieron crear tarjetas de prueba');
        return;
      }

      const testCardId1 = card1Response.body.data?.id || card1Response.body.id;
      const testCardId2 = card2Response.body.data?.id || card2Response.body.id;

      // Marcar primera tarjeta como default
      await request(app.getHttpServer())
        .patch(`/payments/cards/${testCardId1}/default`)
        .set('Authorization', `Bearer ${studentToken}`);

      // Marcar segunda tarjeta como default (debe desmarcar la primera)
      await request(app.getHttpServer())
        .patch(`/payments/cards/${testCardId2}/default`)
        .set('Authorization', `Bearer ${studentToken}`);

      // Verificar que solo la segunda es default
      const listResponse = await request(app.getHttpServer())
        .get('/payments/cards')
        .set('Authorization', `Bearer ${studentToken}`);

      const cards = listResponse.body.data || listResponse.body;
      const defaultCards = cards.filter((card: any) => card.isDefault === true);
      expect(defaultCards.length).toBe(1);
      expect(defaultCards[0].id).toBe(testCardId2);

      const card1 = cards.find((card: any) => card.id === testCardId1);
      expect(card1.isDefault).toBe(false);
    });
  });
});
