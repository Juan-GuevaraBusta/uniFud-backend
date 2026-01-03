import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { WompiClient, WompiPaymentSource, WompiTransaction, WompiWebhookEvent } from './wompi.client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WompiClient', () => {
  let client: WompiClient;
  let configService: ConfigService;
  let mockAxiosInstance: any;

  beforeEach(async () => {
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    };

    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WompiClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                WOMPI_PUBLIC_KEY: 'pub_test_123',
                WOMPI_PRIVATE_KEY: 'prv_test_123',
                WOMPI_INTEGRITY_SECRET: 'test_secret_123',
                WOMPI_API_URL: 'https://sandbox.wompi.co',
              };
              return config[key] || '';
            }),
          },
        },
      ],
    }).compile();

    client = module.get<WompiClient>(WompiClient);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentSource', () => {
    it('debe crear un Payment Source exitosamente', async () => {
      const mockPaymentSource: WompiPaymentSource = {
        id: 'ps_test_123',
        status: 'AVAILABLE',
        type: 'CARD',
        public_data: {
          last_four: '1234',
          bin: '411111',
          exp_month: '12',
          exp_year: '2025',
          card_holder: 'John Doe',
        },
        customer_email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: { data: mockPaymentSource },
      });

      const result = await client.createPaymentSource(
        'token_123',
        'acceptance_token_123',
        'accept_personal_auth_123',
        'test@example.com',
      );

      expect(result).toEqual(mockPaymentSource);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/payment_sources', {
        type: 'CARD',
        token: 'token_123',
        customer_email: 'test@example.com',
        acceptance_token: 'acceptance_token_123',
        accept_personal_auth: 'accept_personal_auth_123',
      });
    });

    it('debe lanzar BadRequestException cuando falla la creación', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          data: { message: 'Token inválido' },
        },
      });

      await expect(
        client.createPaymentSource('invalid_token', 'acceptance_token', 'accept_personal_auth', 'test@example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createTransaction', () => {
    it('debe crear una transacción exitosamente', async () => {
      const mockTransaction: WompiTransaction = {
        id: 'tx_test_123',
        status: 'APPROVED',
        amount_in_cents: 10000,
        currency: 'COP',
        reference: 'UFD-123',
        customer_email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: { data: mockTransaction },
      });

      const result = await client.createTransaction('ps_test_123', 100, 'UFD-123', 'test@example.com');

      expect(result).toEqual(mockTransaction);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/transactions', {
        amount_in_cents: 10000,
        currency: 'COP',
        customer_email: 'test@example.com',
        payment_method: {
          type: 'CARD',
          payment_source_id: 'ps_test_123',
        },
        reference: 'UFD-123',
      });
    });

    it('debe convertir el monto a centavos correctamente', async () => {
      const mockTransaction: WompiTransaction = {
        id: 'tx_test_123',
        status: 'APPROVED',
        amount_in_cents: 50000,
        currency: 'COP',
        reference: 'UFD-123',
        customer_email: 'test@example.com',
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: { data: mockTransaction },
      });

      await client.createTransaction('ps_test_123', 500, 'UFD-123', 'test@example.com');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/transactions',
        expect.objectContaining({
          amount_in_cents: 50000,
        }),
      );
    });

    it('debe lanzar BadRequestException cuando falla la creación', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          data: { message: 'Payment Source no encontrado' },
        },
      });

      await expect(
        client.createTransaction('invalid_ps', 100, 'UFD-123', 'test@example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTransaction', () => {
    it('debe obtener una transacción exitosamente', async () => {
      const mockTransaction: WompiTransaction = {
        id: 'tx_test_123',
        status: 'APPROVED',
        amount_in_cents: 10000,
        currency: 'COP',
        reference: 'UFD-123',
        customer_email: 'test@example.com',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockTransaction },
      });

      const result = await client.getTransaction('tx_test_123');

      expect(result).toEqual(mockTransaction);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/transactions/tx_test_123');
    });

    it('debe lanzar BadRequestException cuando falla la consulta', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        message: 'Transacción no encontrada',
      });

      await expect(client.getTransaction('invalid_tx')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('debe verificar correctamente una firma válida', () => {
      const webhookEvent: WompiWebhookEvent = {
        event: {
          id: 'evt_123',
          type: 'transaction.updated',
          created_at: '2024-01-01T00:00:00Z',
        },
        data: {
          transaction: {
            id: 'tx_test_123',
            status: 'APPROVED',
            amount_in_cents: 10000,
            currency: 'COP',
            reference: 'UFD-123',
            customer_email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
          },
        },
        sent_at: '2024-01-01T00:00:00Z',
      };

      const crypto = require('crypto');
      const concatenated = `UFD-12310000COPtest_secret_123`;
      const expectedSignature = crypto.createHash('sha256').update(concatenated).digest('hex');

      const result = client.verifyWebhookSignature(webhookEvent, expectedSignature);

      expect(result).toBe(true);
    });

    it('debe rechazar una firma inválida', () => {
      const webhookEvent: WompiWebhookEvent = {
        event: {
          id: 'evt_123',
          type: 'transaction.updated',
          created_at: '2024-01-01T00:00:00Z',
        },
        data: {
          transaction: {
            id: 'tx_test_123',
            status: 'APPROVED',
            amount_in_cents: 10000,
            currency: 'COP',
            reference: 'UFD-123',
            customer_email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
          },
        },
        sent_at: '2024-01-01T00:00:00Z',
      };

      const result = client.verifyWebhookSignature(webhookEvent, 'invalid_signature');

      expect(result).toBe(false);
    });

    it('debe retornar false si no hay Integrity Secret configurado', () => {
      const moduleWithoutSecret = Test.createTestingModule({
        providers: [
          WompiClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ''),
            },
          },
        ],
      }).compile();

      const clientWithoutSecret = moduleWithoutSecret.then(m => m.get<WompiClient>(WompiClient));

      const webhookEvent: WompiWebhookEvent = {
        event: {
          id: 'evt_123',
          type: 'transaction.updated',
          created_at: '2024-01-01T00:00:00Z',
        },
        data: {
          transaction: {
            id: 'tx_test_123',
            status: 'APPROVED',
            amount_in_cents: 10000,
            currency: 'COP',
            reference: 'UFD-123',
            customer_email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
          },
        },
        sent_at: '2024-01-01T00:00:00Z',
      };

      return clientWithoutSecret.then(c => {
        const result = c.verifyWebhookSignature(webhookEvent, 'any_signature');
        expect(result).toBe(false);
      });
    });
  });
});

