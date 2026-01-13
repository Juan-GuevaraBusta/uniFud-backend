import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WompiClient, WompiTransaction, WompiWebhookEvent } from '../src/payments/providers/wompi.client';
import * as crypto from 'crypto';

/**
 * Tests de Integración Real con Wompi Sandbox
 * 
 * IMPORTANTE: Estos tests requieren credenciales válidas de Wompi Sandbox configuradas en .env
 * - WOMPI_API_URL=https://sandbox.wompi.co
 * - WOMPI_PUBLIC_KEY=pub_test_xxxxx
 * - WOMPI_PRIVATE_KEY=prv_test_xxxxx
 * - WOMPI_INTEGRITY_SECRET=test_integrity_xxxxx
 * 
 * Estos tests hacen llamadas REALES a la API de Wompi Sandbox.
 * Para ejecutarlos: npm run test:e2e -- wompi-integration.spec.ts
 */

describe('Wompi Integration (Sandbox)', () => {
  let wompiClient: WompiClient;
  let configService: ConfigService;
  let hasValidCredentials: boolean;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        WompiClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => process.env[key] || ''),
          },
        },
      ],
    }).compile();

    wompiClient = module.get<WompiClient>(WompiClient);
    configService = module.get<ConfigService>(ConfigService);

    // Verificar si hay credenciales válidas configuradas
    const apiUrl = process.env.WOMPI_API_URL || '';
    const privateKey = process.env.WOMPI_PRIVATE_KEY || '';
    
    hasValidCredentials = 
      apiUrl.includes('sandbox') && 
      privateKey.startsWith('prv_test_') &&
      privateKey.length > 20;
  });

  describe('verifyWebhookSignature', () => {
    it('debe verificar correctamente la firma de un webhook válido', () => {
      // Usar el mismo integrity secret que el cliente (desde process.env)
      const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || 'test_secret_123';
      
      // Crear payload de webhook simulado
      const transaction = {
        reference: 'TEST-123',
        amount_in_cents: 10000,
        currency: 'COP',
      };

      const payload: WompiWebhookEvent = {
        event: {
          id: 'evt_123',
          type: 'transaction.updated',
          created_at: '2024-01-01T00:00:00Z',
        },
        data: {
          transaction: {
            id: 'tx_test_123',
            status: 'APPROVED',
            reference: transaction.reference,
            amount_in_cents: transaction.amount_in_cents,
            currency: transaction.currency,
            created_at: '2024-01-01T00:00:00Z',
          } as any,
        },
        sent_at: '2024-01-01T00:00:01Z',
      };

      // Calcular firma esperada (mismo algoritmo que WompiClient)
      // La firma se calcula como: reference + amount_in_cents + currency + integrity_secret
      const concatenated = `${transaction.reference}${transaction.amount_in_cents}${transaction.currency}${integritySecret}`;
      const expectedSignature = crypto
        .createHash('sha256')
        .update(concatenated)
        .digest('hex');

      // Verificar firma - el cliente debe usar el mismo integrity secret
      // Si el cliente no tiene integrity secret configurado, retornará false
      const isValid = wompiClient.verifyWebhookSignature(payload, expectedSignature);

      // Si no hay integrity secret configurado en el ambiente, el test puede fallar
      // En ese caso, verificamos que el método funciona correctamente (retorna false cuando no hay secret)
      if (!process.env.WOMPI_INTEGRITY_SECRET) {
        expect(isValid).toBe(false); // Sin secret, debe retornar false
      } else {
        expect(isValid).toBe(true); // Con secret correcto, debe retornar true
      }
    });

    it('debe rechazar una firma inválida', () => {
      const payload: WompiWebhookEvent = {
        event: {
          id: 'evt_123',
          type: 'transaction.updated',
          created_at: '2024-01-01T00:00:00Z',
        },
        data: {
          transaction: {
            id: 'tx_test_123',
            status: 'APPROVED',
            reference: 'TEST-123',
            amount_in_cents: 10000,
            currency: 'COP',
            created_at: '2024-01-01T00:00:00Z',
          } as any,
        },
        sent_at: '2024-01-01T00:00:01Z',
      };

      const invalidSignature = 'invalid_signature_123';

      const isValid = wompiClient.verifyWebhookSignature(payload, invalidSignature);

      expect(isValid).toBe(false);
    });

    it('debe retornar false si no hay integrity secret configurado', async () => {
      // Crear un cliente temporal sin integrity secret
      const tempModule: TestingModule = await Test.createTestingModule({
        providers: [
          WompiClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'WOMPI_INTEGRITY_SECRET') return '';
                return process.env[key] || '';
              }),
            },
          },
        ],
      }).compile();

      const tempClient = tempModule.get<WompiClient>(WompiClient);

      const payload: WompiWebhookEvent = {
        event: {
          id: 'evt_123',
          type: 'transaction.updated',
          created_at: '2024-01-01T00:00:00Z',
        },
        data: {
          transaction: {
            id: 'tx_test_123',
            status: 'APPROVED',
            reference: 'TEST-123',
            amount_in_cents: 10000,
            currency: 'COP',
            created_at: '2024-01-01T00:00:00Z',
          } as any,
        },
        sent_at: '2024-01-01T00:00:01Z',
      };

      const isValid = tempClient.verifyWebhookSignature(payload, 'any_signature');

      expect(isValid).toBe(false);
    });
  });

  describe('getTransaction (Real API Call)', () => {
    it.skip('debe consultar una transacción existente en Wompi (requiere transacción real)', async () => {
      if (!hasValidCredentials) {
        console.log('⏭️  Saltando test: credenciales de Wompi no configuradas');
        return;
      }

      // Este test requiere un transaction ID real de Wompi sandbox
      // Se puede obtener creando una transacción manualmente o desde el dashboard
      const realTransactionId = process.env.WOMPI_TEST_TRANSACTION_ID;

      if (!realTransactionId) {
        console.log('⏭️  Saltando test: WOMPI_TEST_TRANSACTION_ID no configurado');
        console.log('  Para ejecutar este test, crea una transacción en Wompi sandbox y configura WOMPI_TEST_TRANSACTION_ID');
        return;
      }

      const transaction = await wompiClient.getTransaction(realTransactionId);

      expect(transaction).toBeDefined();
      expect(transaction.id).toBe(realTransactionId);
      expect(transaction.status).toBeDefined();
      expect(['APPROVED', 'PENDING', 'DECLINED', 'ERROR']).toContain(transaction.status);
    }, 30000);

    it('debe lanzar error al consultar una transacción inexistente (test con credenciales reales)', async () => {
      if (!hasValidCredentials) {
        console.log('⏭️  Saltando test: credenciales de Wompi no configuradas');
        return;
      }

      const nonExistentTransactionId = `tx_test_nonexistent_${Date.now()}`;

      await expect(
        wompiClient.getTransaction(nonExistentTransactionId)
      ).rejects.toThrow();
    }, 30000);
  });

  describe('createTransaction (Real API Call)', () => {
    it.skip('debe crear una transacción exitosa (requiere Payment Source válido)', async () => {
      if (!hasValidCredentials) {
        console.log('⏭️  Saltando test: credenciales de Wompi no configuradas');
        return;
      }

      // Este test requiere un Payment Source ID real de Wompi sandbox
      // Se puede obtener creando un Payment Source manualmente
      const realPaymentSourceId = process.env.WOMPI_TEST_PAYMENT_SOURCE_ID;

      if (!realPaymentSourceId) {
        console.log('⏭️  Saltando test: WOMPI_TEST_PAYMENT_SOURCE_ID no configurado');
        console.log('  Para ejecutar este test, crea un Payment Source en Wompi sandbox y configura WOMPI_TEST_PAYMENT_SOURCE_ID');
        return;
      }

      const reference = `TEST-UFD-${Date.now()}`;
      const amount = 100; // 100 COP = 10000 centavos
      const customerEmail = 'test@example.com';

      const transaction = await wompiClient.createTransaction(
        realPaymentSourceId,
        amount,
        reference,
        customerEmail
      );

      expect(transaction).toBeDefined();
      expect(transaction.id).toBeDefined();
      expect(transaction.reference).toBe(reference);
      expect(transaction.amount_in_cents).toBe(amount * 100);
      expect(transaction.status).toBeDefined();
    }, 30000);
  });
});
