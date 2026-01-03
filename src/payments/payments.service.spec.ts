import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { WompiClient, WompiTransaction } from './providers/wompi.client';
import { UserCardsService } from './user-cards.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserCard } from './entities/user-card.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: Repository<Payment>;
  let wompiClient: WompiClient;
  let userCardsService: UserCardsService;
  let usersService: UsersService;

  const mockUser: User = {
    id: 'user_123',
    email: 'test@example.com',
    password: 'hashed_password',
    nombre: 'Test User',
    role: 'student' as any,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockUserCard: UserCard = {
    id: 'card_123',
    userId: 'user_123',
    wompiPaymentSourceId: 'ps_test_123',
    cardLastFour: '1234',
    cardBrand: 'VISA',
    expMonth: 12,
    expYear: 2025,
    isDefault: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserCard;

  const mockTransaction: WompiTransaction = {
    id: 'tx_test_123',
    status: 'APPROVED',
    amount_in_cents: 10000,
    currency: 'COP',
    reference: 'UFD-123',
    customer_email: 'test@example.com',
    created_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: WompiClient,
          useValue: {
            createTransaction: jest.fn(),
            verifyWebhookSignature: jest.fn(),
          },
        },
        {
          provide: UserCardsService,
          useValue: {
            getCardById: jest.fn(),
            getDefaultCard: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    wompiClient = module.get<WompiClient>(WompiClient);
    userCardsService = module.get<UserCardsService>(UserCardsService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processOrderPayment', () => {
    it('debe procesar un pago exitosamente con tarjeta default', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(userCardsService, 'getDefaultCard').mockResolvedValue(mockUserCard);
      jest.spyOn(wompiClient, 'createTransaction').mockResolvedValue(mockTransaction);
      jest.spyOn(paymentRepository, 'create').mockReturnValue({
        id: 'payment_123',
        userId: 'user_123',
        wompiTransactionId: 'tx_test_123',
        reference: 'UFD-123',
        amountInCents: 10000,
        currency: 'COP',
        status: PaymentStatus.APPROVED,
        paymentSourceId: 'ps_test_123',
      } as Payment);
      jest.spyOn(paymentRepository, 'save').mockResolvedValue({
        id: 'payment_123',
        status: PaymentStatus.APPROVED,
      } as Payment);

      const result = await service.processOrderPayment('user_123', 100);

      expect(result).toEqual({
        transactionId: 'tx_test_123',
        status: 'APPROVED',
        reference: 'UFD-123',
        amountInCents: 10000,
      });
      expect(usersService.findOne).toHaveBeenCalledWith('user_123');
      expect(userCardsService.getDefaultCard).toHaveBeenCalledWith('user_123');
      expect(wompiClient.createTransaction).toHaveBeenCalled();
    });

    it('debe procesar un pago con paymentSourceId específico', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(userCardsService, 'getCardById').mockResolvedValue({
        ...mockUserCard,
        wompiPaymentSourceId: 'ps_specific_123',
      } as any);
      jest.spyOn(wompiClient, 'createTransaction').mockResolvedValue(mockTransaction);
      jest.spyOn(paymentRepository, 'create').mockReturnValue({} as Payment);
      jest.spyOn(paymentRepository, 'save').mockResolvedValue({
        status: PaymentStatus.APPROVED,
      } as Payment);

      await service.processOrderPayment('user_123', 100, 'card_123');

      expect(userCardsService.getCardById).toHaveBeenCalledWith('card_123', 'user_123');
      expect(userCardsService.getDefaultCard).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      await expect(service.processOrderPayment('invalid_user', 100)).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si no hay tarjeta default', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(userCardsService, 'getDefaultCard').mockResolvedValue(null);

      await expect(service.processOrderPayment('user_123', 100)).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si el pago no es aprobado', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(userCardsService, 'getDefaultCard').mockResolvedValue(mockUserCard);
      jest.spyOn(wompiClient, 'createTransaction').mockResolvedValue({
        ...mockTransaction,
        status: 'DECLINED',
        status_message: 'Tarjeta rechazada',
      });
      jest.spyOn(paymentRepository, 'create').mockReturnValue({
        status: PaymentStatus.DECLINED,
      } as Payment);
      jest.spyOn(paymentRepository, 'save').mockResolvedValue({
        status: PaymentStatus.DECLINED,
      } as Payment);

      await expect(service.processOrderPayment('user_123', 100)).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    const mockWebhookEvent = {
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
          finalized_at: '2024-01-01T01:00:00Z',
        },
      },
      sent_at: '2024-01-01T00:00:00Z',
    };

    it('debe manejar un webhook válido y actualizar el pago', async () => {
      const mockPayment = {
        id: 'payment_123',
        wompiTransactionId: 'tx_test_123',
        status: PaymentStatus.PENDING,
        finalizedAt: null,
        save: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(wompiClient, 'verifyWebhookSignature').mockReturnValue(true);
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(mockPayment as any);

      await service.handleWebhook(mockWebhookEvent as any, 'valid_signature');

      expect(mockPayment.status).toBe(PaymentStatus.APPROVED);
      expect(mockPayment.finalizedAt).toBeInstanceOf(Date);
      expect(mockPayment.save).toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si la firma es inválida', async () => {
      jest.spyOn(wompiClient, 'verifyWebhookSignature').mockReturnValue(false);

      await expect(service.handleWebhook(mockWebhookEvent as any, 'invalid_signature')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe retornar sin error si el pago no existe', async () => {
      jest.spyOn(wompiClient, 'verifyWebhookSignature').mockReturnValue(true);
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(null);

      await expect(service.handleWebhook(mockWebhookEvent as any, 'valid_signature')).resolves.not.toThrow();
    });
  });

  describe('generatePaymentReference', () => {
    it('debe generar referencia desde número de orden con formato #ABC-123', () => {
      const result = (service as any).generatePaymentReference('#ABC-123');
      expect(result).toBe('UFD-123');
    });

    it('debe generar referencia desde UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = (service as any).generatePaymentReference(uuid);
      expect(result).toMatch(/^UFD-\d+$/);
    });

    it('debe generar referencia con timestamp si no hay orderNumber', () => {
      const result = (service as any).generatePaymentReference();
      expect(result).toMatch(/^UFD-\d+$/);
    });
  });

  describe('mapWompiStatusToPaymentStatus', () => {
    it('debe mapear estados de Wompi correctamente', () => {
      const mapStatus = (service as any).mapWompiStatusToPaymentStatus.bind(service);

      expect(mapStatus('APPROVED')).toBe(PaymentStatus.APPROVED);
      expect(mapStatus('DECLINED')).toBe(PaymentStatus.DECLINED);
      expect(mapStatus('PENDING')).toBe(PaymentStatus.PENDING);
      expect(mapStatus('VOIDED')).toBe(PaymentStatus.VOIDED);
      expect(mapStatus('UNKNOWN')).toBe(PaymentStatus.ERROR);
    });
  });

  describe('getPaymentByTransactionId', () => {
    it('debe obtener un pago por transaction ID', async () => {
      const mockPayment = { id: 'payment_123', wompiTransactionId: 'tx_test_123' } as Payment;
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(mockPayment);

      const result = await service.getPaymentByTransactionId('tx_test_123');

      expect(result).toEqual(mockPayment);
      expect(paymentRepository.findOne).toHaveBeenCalledWith({
        where: { wompiTransactionId: 'tx_test_123' },
      });
    });
  });

  describe('updatePaymentOrderId', () => {
    it('debe actualizar el orderId de un pago', async () => {
      jest.spyOn(paymentRepository, 'update').mockResolvedValue({ affected: 1 } as any);

      await service.updatePaymentOrderId('tx_test_123', 'order_123');

      expect(paymentRepository.update).toHaveBeenCalledWith(
        { wompiTransactionId: 'tx_test_123' },
        { orderId: 'order_123' },
      );
    });
  });
});

