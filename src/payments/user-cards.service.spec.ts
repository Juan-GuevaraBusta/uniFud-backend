import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserCardsService } from './user-cards.service';
import { UserCard } from './entities/user-card.entity';
import { WompiClient, WompiPaymentSource } from './providers/wompi.client';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { CreateUserCardDto } from './dto/create-user-card.dto';

describe('UserCardsService', () => {
  let service: UserCardsService;
  let userCardsRepository: Repository<UserCard>;
  let wompiClient: WompiClient;
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

  const mockUserCard: UserCard = {
    id: 'card_123',
    userId: 'user_123',
    wompiPaymentSourceId: 'ps_test_123',
    cardLastFour: '1234',
    cardBrand: 'VISA',
    cardHolderName: 'John Doe',
    expMonth: 12,
    expYear: 2025,
    isDefault: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserCard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserCardsService,
        {
          provide: getRepositoryToken(UserCard),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: WompiClient,
          useValue: {
            createPaymentSource: jest.fn(),
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

    service = module.get<UserCardsService>(UserCardsService);
    userCardsRepository = module.get<Repository<UserCard>>(getRepositoryToken(UserCard));
    wompiClient = module.get<WompiClient>(WompiClient);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCard', () => {
    const createCardDto: CreateUserCardDto = {
      token: 'token_123',
      acceptanceToken: 'acceptance_token_123',
      acceptPersonalAuth: 'accept_personal_auth_123',
      isDefault: false,
    };

    it('debe crear una tarjeta exitosamente', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(wompiClient, 'createPaymentSource').mockResolvedValue(mockPaymentSource);
      jest.spyOn(userCardsRepository, 'count').mockResolvedValue(0);
      jest.spyOn(userCardsRepository, 'update').mockResolvedValue({ affected: 0 } as any);
      jest.spyOn(userCardsRepository, 'create').mockReturnValue(mockUserCard);
      jest.spyOn(userCardsRepository, 'save').mockResolvedValue(mockUserCard);

      const result = await service.createCard('user_123', createCardDto);

      expect(result).toHaveProperty('id', 'card_123');
      expect(result).toHaveProperty('cardLastFour', '1234');
      expect(result).toHaveProperty('cardBrand', 'VISA');
      expect(result.isDefault).toBe(true);
      expect(wompiClient.createPaymentSource).toHaveBeenCalled();
      expect(userCardsRepository.save).toHaveBeenCalled();
    });

    it('debe marcar la primera tarjeta como default automáticamente', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(wompiClient, 'createPaymentSource').mockResolvedValue(mockPaymentSource);
      jest.spyOn(userCardsRepository, 'count').mockResolvedValue(0);
      jest.spyOn(userCardsRepository, 'update').mockResolvedValue({ affected: 0 } as any);
      jest.spyOn(userCardsRepository, 'create').mockReturnValue({
        ...mockUserCard,
        isDefault: true,
      } as UserCard);
      jest.spyOn(userCardsRepository, 'save').mockResolvedValue({
        ...mockUserCard,
        isDefault: true,
      } as UserCard);

      const result = await service.createCard('user_123', createCardDto);

      expect(result.isDefault).toBe(true);
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      await expect(service.createCard('invalid_user', createCardDto)).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si el Payment Source no está disponible', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(wompiClient, 'createPaymentSource').mockResolvedValue({
        ...mockPaymentSource,
        status: 'UNAVAILABLE',
      });

      await expect(service.createCard('user_123', createCardDto)).rejects.toThrow(BadRequestException);
    });

    it('debe desmarcar otras tarjetas cuando se marca una como default', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(wompiClient, 'createPaymentSource').mockResolvedValue(mockPaymentSource);
      jest.spyOn(userCardsRepository, 'count').mockResolvedValue(1);
      jest.spyOn(userCardsRepository, 'update').mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(userCardsRepository, 'create').mockReturnValue({
        ...mockUserCard,
        isDefault: true,
      } as UserCard);
      jest.spyOn(userCardsRepository, 'save').mockResolvedValue({
        ...mockUserCard,
        isDefault: true,
      } as UserCard);

      await service.createCard('user_123', { ...createCardDto, isDefault: true });

      expect(userCardsRepository.update).toHaveBeenCalledWith(
        { userId: 'user_123', isDefault: true, isActive: true },
        { isDefault: false },
      );
    });
  });

  describe('getUserCards', () => {
    it('debe retornar todas las tarjetas activas del usuario', async () => {
      const mockCards = [mockUserCard, { ...mockUserCard, id: 'card_456', isDefault: false }] as UserCard[];
      jest.spyOn(userCardsRepository, 'find').mockResolvedValue(mockCards);

      const result = await service.getUserCards('user_123');

      expect(result).toHaveLength(2);
      expect(userCardsRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user_123', isActive: true },
        order: { isDefault: 'DESC', createdAt: 'DESC' },
      });
    });
  });

  describe('getCardById', () => {
    it('debe retornar una tarjeta específica', async () => {
      jest.spyOn(userCardsRepository, 'findOne').mockResolvedValue(mockUserCard);

      const result = await service.getCardById('card_123', 'user_123');

      expect(result).toHaveProperty('id', 'card_123');
      expect(userCardsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'card_123', userId: 'user_123', isActive: true },
      });
    });

    it('debe lanzar NotFoundException si la tarjeta no existe', async () => {
      jest.spyOn(userCardsRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getCardById('invalid_card', 'user_123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setDefaultCard', () => {
    it('debe marcar una tarjeta como default', async () => {
      jest.spyOn(userCardsRepository, 'findOne').mockResolvedValue(mockUserCard);
      jest.spyOn(userCardsRepository, 'update').mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(userCardsRepository, 'save').mockResolvedValue({
        ...mockUserCard,
        isDefault: true,
      } as UserCard);

      const result = await service.setDefaultCard('card_123', 'user_123');

      expect(result.isDefault).toBe(true);
      expect(userCardsRepository.update).toHaveBeenCalledWith(
        { userId: 'user_123', isDefault: true, isActive: true },
        { isDefault: false },
      );
    });

    it('debe lanzar NotFoundException si la tarjeta no existe', async () => {
      jest.spyOn(userCardsRepository, 'findOne').mockResolvedValue(null);

      await expect(service.setDefaultCard('invalid_card', 'user_123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCard', () => {
    it('debe eliminar una tarjeta (soft delete)', async () => {
      jest.spyOn(userCardsRepository, 'findOne').mockResolvedValue({
        ...mockUserCard,
        isDefault: false,
      } as UserCard);
      jest.spyOn(userCardsRepository, 'save').mockResolvedValue({
        ...mockUserCard,
        isActive: false,
      } as UserCard);

      await service.deleteCard('card_123', 'user_123');

      expect(userCardsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('debe lanzar BadRequestException si intenta eliminar la única tarjeta', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };

      jest.spyOn(userCardsRepository, 'findOne').mockResolvedValue({
        ...mockUserCard,
        isDefault: true,
      } as UserCard);
      jest.spyOn(userCardsRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await expect(service.deleteCard('card_123', 'user_123')).rejects.toThrow(BadRequestException);
    });

    it('debe marcar otra tarjeta como default si elimina la default', async () => {
      const otherCard = { ...mockUserCard, id: 'card_456', isDefault: false };
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getOne: jest.fn().mockResolvedValue(otherCard),
      };

      jest.spyOn(userCardsRepository, 'findOne').mockResolvedValue({
        ...mockUserCard,
        isDefault: true,
      } as UserCard);
      jest.spyOn(userCardsRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(userCardsRepository, 'save').mockResolvedValue({} as UserCard);

      await service.deleteCard('card_123', 'user_123');

      expect(userCardsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true }),
      );
    });
  });

  describe('getDefaultCard', () => {
    it('debe retornar la tarjeta default del usuario', async () => {
      jest.spyOn(userCardsRepository, 'findOne').mockResolvedValue(mockUserCard);

      const result = await service.getDefaultCard('user_123');

      expect(result).toEqual(mockUserCard);
      expect(userCardsRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user_123', isDefault: true, isActive: true },
      });
    });

    it('debe retornar null si no hay tarjeta default', async () => {
      jest.spyOn(userCardsRepository, 'findOne').mockResolvedValue(null);

      const result = await service.getDefaultCard('user_123');

      expect(result).toBeNull();
    });
  });

  describe('mapCardBrand', () => {
    it('debe mapear BIN de Visa correctamente', () => {
      const mapBrand = (service as any).mapCardBrand.bind(service);
      expect(mapBrand('411111')).toBe('VISA');
      expect(mapBrand('4')).toBe('VISA');
    });

    it('debe mapear BIN de Mastercard correctamente', () => {
      const mapBrand = (service as any).mapCardBrand.bind(service);
      expect(mapBrand('511111')).toBe('MASTERCARD');
      expect(mapBrand('555555')).toBe('MASTERCARD');
      expect(mapBrand('222100')).toBe('MASTERCARD');
      expect(mapBrand('272000')).toBe('MASTERCARD');
    });

    it('debe mapear BIN de American Express correctamente', () => {
      const mapBrand = (service as any).mapCardBrand.bind(service);
      expect(mapBrand('341111')).toBe('AMEX');
      expect(mapBrand('371111')).toBe('AMEX');
    });

    it('debe retornar UNKNOWN para BINs desconocidos', () => {
      const mapBrand = (service as any).mapCardBrand.bind(service);
      expect(mapBrand('999999')).toBe('UNKNOWN');
      expect(mapBrand('')).toBe('UNKNOWN');
      expect(mapBrand(undefined)).toBe('UNKNOWN');
    });
  });
});

