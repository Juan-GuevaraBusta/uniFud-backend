import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationToken, NotificationPlatform } from './entities/notification-token.entity';
import { RegisterTokenDto, UpdateTokenDto } from './dto/register-token.dto';
import { SendNotificationDto, NotificationType } from './dto/send-notification.dto';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { UserRole } from '../users/entities/user.entity';
import { NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let tokenRepository: jest.Mocked<Repository<NotificationToken>>;
  let mockFetch: jest.Mock;

  const mockUserId = 'user-uuid-123';
  const mockUserEmail = 'test@example.com';
  const mockTokenId = 'token-uuid-456';
  const mockDeviceId = 'device-123';
  const mockExpoPushToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

  const mockUser: User = {
    id: mockUserId,
    email: mockUserEmail,
    nombre: 'Test User',
    role: UserRole.STUDENT,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockOwner: User = {
    id: 'owner-uuid-789',
    email: 'owner@restaurant.com',
    nombre: 'Restaurant Owner',
    role: UserRole.RESTAURANT_OWNER,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockRestaurant: Restaurant = {
    id: 'restaurant-uuid-456',
    nombre: 'Test Restaurant',
    ownerId: mockOwner.id,
    owner: mockOwner,
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Restaurant;

  const mockNotificationToken: NotificationToken = {
    id: mockTokenId,
    userId: mockUserId,
    userEmail: mockUserEmail.toLowerCase(),
    expoPushToken: mockExpoPushToken,
    deviceId: mockDeviceId,
    platform: NotificationPlatform.IOS,
    deviceInfo: {
      deviceName: 'Test iPhone',
      modelName: 'iPhone 15 Pro',
      osName: 'iOS',
      osVersion: '18.0',
    },
    configuraciones: {
      pedidosNuevos: true,
      cambiosEstado: true,
      promociones: true,
    },
    activo: true,
    userDevice: `${mockUserEmail.toLowerCase()}#${mockDeviceId}`,
    registeredAt: new Date(),
    lastUsedAt: new Date(),
    user: mockUser,
  } as NotificationToken;

  const mockOrder: Order = {
    id: 'order-uuid-123',
    numeroOrden: '#ABC-123',
    userId: mockUserId,
    restaurantId: mockRestaurant.id,
    status: OrderStatus.PENDIENTE,
    subtotal: 15000,
    tarifaServicio: 750,
    total: 15750,
    items: [],
    fechaPedido: new Date(),
    user: mockUser,
    restaurant: mockRestaurant,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Order;

  const mockRegisterTokenDto: RegisterTokenDto = {
    expoPushToken: mockExpoPushToken,
    deviceId: mockDeviceId,
    platform: NotificationPlatform.IOS,
    deviceInfo: {
      deviceName: 'Test iPhone',
      modelName: 'iPhone 15 Pro',
    },
    configuraciones: {
      pedidosNuevos: true,
      cambiosEstado: true,
      promociones: false,
    },
  };

  const mockUpdateTokenDto: UpdateTokenDto = {
    activo: false,
    configuraciones: {
      pedidosNuevos: false,
      cambiosEstado: true,
      promociones: true,
    },
  };

  const mockSendNotificationDto: SendNotificationDto = {
    recipients: [mockUserEmail],
    type: NotificationType.NUEVO_PEDIDO,
    title: 'Test Notification',
    body: 'This is a test notification',
    data: {
      testKey: 'testValue',
    },
  };

  beforeEach(async () => {
    // Mock global.fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(NotificationToken),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            merge: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    tokenRepository = module.get(getRepositoryToken(NotificationToken));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerToken', () => {
    it('debe registrar nuevo token exitosamente', async () => {
      // Arrange
      tokenRepository.findOne.mockResolvedValue(null);
      tokenRepository.create.mockReturnValue(mockNotificationToken);
      tokenRepository.save.mockResolvedValue(mockNotificationToken);

      // Act
      const result = await service.registerToken(mockUserId, mockUserEmail, mockRegisterTokenDto);

      // Assert
      expect(tokenRepository.findOne).toHaveBeenCalledWith({
        where: { userDevice: `${mockUserEmail.toLowerCase()}#${mockDeviceId}` },
      });
      expect(tokenRepository.create).toHaveBeenCalled();
      expect(tokenRepository.save).toHaveBeenCalled();
      expect(result.id).toBe(mockTokenId);
      expect(result.userDevice).toBe(`${mockUserEmail.toLowerCase()}#${mockDeviceId}`);
    });

    it('debe actualizar token existente (mismo userDevice)', async () => {
      // Arrange
      const existingToken = { ...mockNotificationToken, lastUsedAt: new Date('2024-01-01') };
      const updatedToken = { ...existingToken, lastUsedAt: new Date() };
      tokenRepository.findOne.mockResolvedValue(existingToken);
      tokenRepository.merge.mockReturnValue(updatedToken);
      tokenRepository.save.mockResolvedValue(updatedToken);

      // Act
      const result = await service.registerToken(mockUserId, mockUserEmail, mockRegisterTokenDto);

      // Assert
      expect(tokenRepository.findOne).toHaveBeenCalled();
      expect(tokenRepository.merge).toHaveBeenCalled();
      expect(tokenRepository.save).toHaveBeenCalled();
      expect(result.lastUsedAt).not.toEqual(existingToken.lastUsedAt);
    });

    it('debe hacer merge de configuraciones con defaults', async () => {
      // Arrange
      const dtoWithPartialConfig: RegisterTokenDto = {
        ...mockRegisterTokenDto,
        configuraciones: {
          pedidosNuevos: false,
          cambiosEstado: true,
          promociones: true,
        },
      };
      const tokenWithMergedConfig = {
        ...mockNotificationToken,
        configuraciones: {
          pedidosNuevos: false,
          cambiosEstado: true,
          promociones: true,
        },
      };
      tokenRepository.findOne.mockResolvedValue(null);
      tokenRepository.create.mockReturnValue(tokenWithMergedConfig);
      tokenRepository.save.mockResolvedValue(tokenWithMergedConfig);

      // Act
      const result = await service.registerToken(mockUserId, mockUserEmail, dtoWithPartialConfig);

      // Assert
      expect(result.configuraciones).toHaveProperty('pedidosNuevos', false);
      expect(result.configuraciones).toHaveProperty('cambiosEstado', true);
      expect(result.configuraciones).toHaveProperty('promociones', true);
    });

    it('debe generar userDevice correctamente (email#deviceId)', async () => {
      // Arrange
      tokenRepository.findOne.mockResolvedValue(null);
      tokenRepository.create.mockReturnValue(mockNotificationToken);
      tokenRepository.save.mockResolvedValue(mockNotificationToken);

      // Act
      await service.registerToken(mockUserId, 'Test@Example.COM', mockRegisterTokenDto);

      // Assert
      expect(tokenRepository.findOne).toHaveBeenCalledWith({
        where: { userDevice: 'test@example.com#device-123' },
      });
    });

    it('debe usar configuraciones por defecto si no se proporcionan', async () => {
      // Arrange
      const dtoWithoutConfig: RegisterTokenDto = {
        expoPushToken: mockExpoPushToken,
        deviceId: mockDeviceId,
        platform: NotificationPlatform.IOS,
      };
      tokenRepository.findOne.mockResolvedValue(null);
      tokenRepository.create.mockReturnValue(mockNotificationToken);
      tokenRepository.save.mockResolvedValue(mockNotificationToken);

      // Act
      const result = await service.registerToken(mockUserId, mockUserEmail, dtoWithoutConfig);

      // Assert
      expect(result.configuraciones).toEqual({
        pedidosNuevos: true,
        cambiosEstado: true,
        promociones: true,
      });
    });

    it('debe actualizar lastUsedAt al actualizar token existente', async () => {
      // Arrange
      const oldDate = new Date('2024-01-01');
      const existingToken = { ...mockNotificationToken, lastUsedAt: oldDate };
      const updatedToken = { ...existingToken, lastUsedAt: new Date() };
      tokenRepository.findOne.mockResolvedValue(existingToken);
      tokenRepository.merge.mockReturnValue(updatedToken);
      tokenRepository.save.mockResolvedValue(updatedToken);

      // Act
      const result = await service.registerToken(mockUserId, mockUserEmail, mockRegisterTokenDto);

      // Assert
      expect(tokenRepository.merge).toHaveBeenCalledWith(
        existingToken,
        expect.objectContaining({
          lastUsedAt: expect.any(Date),
        }),
      );
      expect(result.lastUsedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });
  });

  describe('updateToken', () => {
    it('debe actualizar configuraciones exitosamente', async () => {
      // Arrange
      const updatedToken = {
        ...mockNotificationToken,
        configuraciones: mockUpdateTokenDto.configuraciones,
      };
      tokenRepository.findOne.mockResolvedValue(mockNotificationToken);
      tokenRepository.save.mockResolvedValue(updatedToken);

      // Act
      const result = await service.updateToken(mockTokenId, mockUserId, mockUpdateTokenDto);

      // Assert
      expect(tokenRepository.findOne).toHaveBeenCalledWith({ where: { id: mockTokenId } });
      expect(tokenRepository.save).toHaveBeenCalled();
      expect(result.configuraciones).toEqual(mockUpdateTokenDto.configuraciones);
    });

    it('debe cambiar estado activo/inactivo', async () => {
      // Arrange
      const updatedToken = { ...mockNotificationToken, activo: false };
      tokenRepository.findOne.mockResolvedValue(mockNotificationToken);
      tokenRepository.save.mockResolvedValue(updatedToken);

      // Act
      const result = await service.updateToken(mockTokenId, mockUserId, { activo: false });

      // Assert
      expect(result.activo).toBe(false);
    });

    it('debe actualizar lastUsedAt', async () => {
      // Arrange
      const oldDate = new Date('2024-01-01');
      const tokenWithOldDate = { ...mockNotificationToken, lastUsedAt: oldDate };
      const updatedToken = { ...tokenWithOldDate, lastUsedAt: new Date() };
      tokenRepository.findOne.mockResolvedValue(tokenWithOldDate);
      tokenRepository.save.mockResolvedValue(updatedToken);

      // Act
      const result = await service.updateToken(mockTokenId, mockUserId, mockUpdateTokenDto);

      // Assert
      expect(result.lastUsedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('debe hacer merge de configuraciones parciales', async () => {
      // Arrange
      const existingConfig = {
        pedidosNuevos: true,
        cambiosEstado: true,
        promociones: true,
      };
      const tokenWithConfig = { ...mockNotificationToken, configuraciones: existingConfig };
      const partialUpdate: UpdateTokenDto = {
        configuraciones: {
          pedidosNuevos: false,
          cambiosEstado: true,
          promociones: true,
        },
      };
      const updatedToken = {
        ...tokenWithConfig,
        configuraciones: {
          ...existingConfig,
          pedidosNuevos: false,
        },
      };
      tokenRepository.findOne.mockResolvedValue(tokenWithConfig);
      tokenRepository.save.mockResolvedValue(updatedToken);

      // Act
      const result = await service.updateToken(mockTokenId, mockUserId, partialUpdate);

      // Assert
      expect(result.configuraciones.pedidosNuevos).toBe(false);
      expect(result.configuraciones.cambiosEstado).toBe(true); // Mantiene valor existente
    });

    it('debe lanzar NotFoundException cuando el token no existe', async () => {
      // Arrange
      tokenRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateToken(mockTokenId, mockUserId, mockUpdateTokenDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(tokenRepository.save).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException cuando el token pertenece a otro usuario', async () => {
      // Arrange
      const otherUserToken = { ...mockNotificationToken, userId: 'other-user-id' };
      tokenRepository.findOne.mockResolvedValue(otherUserToken);

      // Act & Assert
      await expect(service.updateToken(mockTokenId, mockUserId, mockUpdateTokenDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(tokenRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deactivateToken', () => {
    it('debe desactivar token específico exitosamente', async () => {
      // Arrange
      const deactivatedToken = { ...mockNotificationToken, activo: false };
      tokenRepository.findOne.mockResolvedValue(mockNotificationToken);
      tokenRepository.save.mockResolvedValue(deactivatedToken);

      // Act
      await service.deactivateToken(mockTokenId, mockUserId);

      // Assert
      expect(tokenRepository.findOne).toHaveBeenCalledWith({ where: { id: mockTokenId } });
      expect(tokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          activo: false,
          lastUsedAt: expect.any(Date),
        }),
      );
    });

    it('debe lanzar NotFoundException cuando el token no existe', async () => {
      // Arrange
      tokenRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deactivateToken(mockTokenId, mockUserId)).rejects.toThrow(NotFoundException);
      expect(tokenRepository.save).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException cuando el token pertenece a otro usuario', async () => {
      // Arrange
      const otherUserToken = { ...mockNotificationToken, userId: 'other-user-id' };
      tokenRepository.findOne.mockResolvedValue(otherUserToken);

      // Act & Assert
      await expect(service.deactivateToken(mockTokenId, mockUserId)).rejects.toThrow(NotFoundException);
      expect(tokenRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deactivateUserTokens', () => {
    it('debe desactivar todos los tokens del usuario', async () => {
      // Arrange
      tokenRepository.update.mockResolvedValue({ affected: 3, generatedMaps: [], raw: [] });

      // Act
      const result = await service.deactivateUserTokens(mockUserId);

      // Assert
      expect(tokenRepository.update).toHaveBeenCalledWith(
        { userId: mockUserId },
        { activo: false, lastUsedAt: expect.any(Date) },
      );
      expect(result).toBe(3);
    });

    it('debe retornar número de tokens desactivados', async () => {
      // Arrange
      tokenRepository.update.mockResolvedValue({ affected: 0, generatedMaps: [], raw: [] });

      // Act
      const result = await service.deactivateUserTokens(mockUserId);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('getUserTokens', () => {
    it('debe retornar todos los tokens del usuario ordenados por lastUsedAt DESC', async () => {
      // Arrange
      const tokens = [
        { ...mockNotificationToken, id: 'token-1', lastUsedAt: new Date('2024-01-02') },
        { ...mockNotificationToken, id: 'token-2', lastUsedAt: new Date('2024-01-01') },
      ];
      tokenRepository.find.mockResolvedValue(tokens);

      // Act
      const result = await service.getUserTokens(mockUserId);

      // Assert
      expect(tokenRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { lastUsedAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('token-1');
    });

    it('debe retornar array vacío si no hay tokens', async () => {
      // Arrange
      tokenRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getUserTokens(mockUserId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('sendPushNotification', () => {
    it('debe enviar notificación exitosamente (con tokens activos)', async () => {
      // Arrange
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      const result = await service.sendPushNotification(
        'sender-id',
        UserRole.RESTAURANT_OWNER,
        mockSendNotificationDto,
      );

      // Assert
      expect(tokenRepository.find).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
      expect(result.attempted).toBe(1);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('debe retornar estadísticas correctas (attempted, sent, failed)', async () => {
      // Arrange
      const tokens = [mockNotificationToken, { ...mockNotificationToken, id: 'token-2' }];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }, { status: 'error', message: 'Invalid token' }],
        }),
      });

      // Act
      const result = await service.sendPushNotification(
        'sender-id',
        UserRole.RESTAURANT_OWNER,
        mockSendNotificationDto,
      );

      // Assert
      expect(result.attempted).toBe(2);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('debe hacer chunking de mensajes (más de 50 tokens)', async () => {
      // Arrange
      const tokens = Array.from({ length: 75 }, (_, i) => ({
        ...mockNotificationToken,
        id: `token-${i}`,
        expoPushToken: `ExponentPushToken[token${i}]`,
      }));
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: Array(50).fill({ status: 'ok' }),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: Array(25).fill({ status: 'ok' }),
          }),
        });

      // Act
      const result = await service.sendPushNotification(
        'sender-id',
        UserRole.RESTAURANT_OWNER,
        mockSendNotificationDto,
      );

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.attempted).toBe(75);
      expect(result.sent).toBe(75);
    });

    it('debe lanzar ForbiddenException cuando estudiante intenta enviar', async () => {
      // Act & Assert
      await expect(
        service.sendPushNotification('sender-id', UserRole.STUDENT, mockSendNotificationDto),
      ).rejects.toThrow(ForbiddenException);
      expect(tokenRepository.find).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException cuando no hay tokens activos', async () => {
      // Arrange
      tokenRepository.find.mockResolvedValue([]);

      // Act & Assert
      await expect(
        service.sendPushNotification('sender-id', UserRole.RESTAURANT_OWNER, mockSendNotificationDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe construir mensajes correctamente con todos los campos', async () => {
      // Arrange
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.sendPushNotification('sender-id', UserRole.RESTAURANT_OWNER, mockSendNotificationDto);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0]).toMatchObject({
        to: mockExpoPushToken,
        sound: 'default',
        title: mockSendNotificationDto.title,
        body: mockSendNotificationDto.body,
        data: {
          type: mockSendNotificationDto.type,
          ...mockSendNotificationDto.data,
        },
        channelId: 'default',
        priority: 'high',
      });
    });
  });

  describe('getActiveTokensByEmail', () => {
    it('debe retornar tokens activos por email', async () => {
      // Arrange
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);

      // Act
      const result = await service.getActiveTokensByEmail(mockUserEmail);

      // Assert
      expect(tokenRepository.find).toHaveBeenCalledWith({
        where: {
          userEmail: mockUserEmail.toLowerCase(),
          activo: true,
        },
      });
      expect(result).toEqual(tokens);
    });

    it('debe normalizar email a lowercase', async () => {
      // Arrange
      tokenRepository.find.mockResolvedValue([]);

      // Act
      await service.getActiveTokensByEmail('Test@Example.COM');

      // Assert
      expect(tokenRepository.find).toHaveBeenCalledWith({
        where: {
          userEmail: 'test@example.com',
          activo: true,
        },
      });
    });
  });

  describe('notifyNewOrder', () => {
    it('debe enviar notificación al owner del restaurante', async () => {
      // Arrange
      const orderWithOwner = {
        ...mockOrder,
        restaurant: { ...mockRestaurant, owner: mockOwner },
      };
      const tokens = [{ ...mockNotificationToken, userEmail: mockOwner.email.toLowerCase() }];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyNewOrder(orderWithOwner);

      // Assert
      expect(tokenRepository.find).toHaveBeenCalledWith({
        where: {
          userEmail: In([mockOwner.email.toLowerCase()]),
          activo: true,
        },
        order: { lastUsedAt: 'DESC' },
      });
      expect(mockFetch).toHaveBeenCalled();
    });

    it('debe construir payload correcto (título, body, tipo, data)', async () => {
      // Arrange
      const orderWithOwner = {
        ...mockOrder,
        total: 15750,
        restaurant: { ...mockRestaurant, owner: mockOwner },
      };
      const tokens = [{ ...mockNotificationToken, userEmail: mockOwner.email.toLowerCase() }];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyNewOrder(orderWithOwner);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].title).toBe('🍽️ Nuevo pedido recibido');
      expect(body[0].body).toContain('Pedido #ABC-123');
      // 15750 centavos = $157,5 (formato colombiano con coma decimal)
      expect(body[0].body).toContain('$157');
      expect(body[0].data.type).toBe(NotificationType.NUEVO_PEDIDO);
      expect(body[0].data.pedidoId).toBe(orderWithOwner.id);
      expect(body[0].data.numeroOrden).toBe('#ABC-123');
    });

    it('no debe fallar si no hay owner email', async () => {
      // Arrange
      const orderWithoutOwner = {
        ...mockOrder,
        restaurant: { ...mockRestaurant, owner: null },
      };

      // Act & Assert - No debe lanzar error
      await expect(service.notifyNewOrder(orderWithoutOwner)).resolves.not.toThrow();
      expect(tokenRepository.find).not.toHaveBeenCalled();
    });

    it('no debe fallar si no hay tokens activos (debe retornar silenciosamente)', async () => {
      // Arrange
      const orderWithOwner = {
        ...mockOrder,
        restaurant: { ...mockRestaurant, owner: mockOwner },
      };
      tokenRepository.find.mockResolvedValue([]);

      // Act & Assert - No debe lanzar error
      await expect(service.notifyNewOrder(orderWithOwner)).resolves.not.toThrow();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('notifyOrderStatusChange', () => {
    it('debe enviar notificación para estado ACEPTADO', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.ACEPTADO,
        tiempoEstimado: 30,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].title).toBe('✅ Pedido aceptado');
      expect(body[0].body).toContain('ha sido aceptado');
      expect(body[0].body).toContain('30 minutos');
      expect(body[0].data.type).toBe(NotificationType.PEDIDO_ACEPTADO);
    });

    it('debe enviar notificación para estado PREPARANDO', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.PREPARANDO,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].title).toBe('👩‍🍳 Pedido en preparación');
      expect(body[0].data.type).toBe(NotificationType.PEDIDO_ACEPTADO);
    });

    it('debe enviar notificación para estado LISTO', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.LISTO,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].title).toBe('🎉 ¡Pedido listo!');
      expect(body[0].data.type).toBe(NotificationType.PEDIDO_LISTO);
    });

    it('debe enviar notificación para estado ENTREGADO', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.ENTREGADO,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].title).toBe('📦 Pedido entregado');
      expect(body[0].data.type).toBe(NotificationType.PEDIDO_ENTREGADO);
    });

    it('debe incluir tiempoEstimado en mensaje de ACEPTADO', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.ACEPTADO,
        tiempoEstimado: 45,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].body).toContain('45 minutos');
    });

    it('debe usar tiempoEstimado default (20) si no se proporciona', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.ACEPTADO,
        tiempoEstimado: null,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].body).toContain('20 minutos');
    });

    it('no debe fallar si no hay user email', async () => {
      // Arrange
      const orderWithoutUser = {
        ...mockOrder,
        user: null,
      };

      // Act & Assert
      await expect(service.notifyOrderStatusChange(orderWithoutUser)).resolves.not.toThrow();
      expect(tokenRepository.find).not.toHaveBeenCalled();
    });

    it('no debe fallar si no hay tokens activos', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.ACEPTADO,
        user: mockUser,
      };
      tokenRepository.find.mockResolvedValue([]);

      // Act & Assert
      await expect(service.notifyOrderStatusChange(order)).resolves.not.toThrow();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('notifyOrderCancelled', () => {
    it('debe notificar a usuario y restaurante (si actor no es estudiante)', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        motivoCancelacion: 'Sin ingredientes',
        user: mockUser,
        restaurant: { ...mockRestaurant, owner: mockOwner },
      };
      const tokens = [
        { ...mockNotificationToken, userEmail: mockUser.email.toLowerCase() },
        { ...mockNotificationToken, id: 'token-2', userEmail: mockOwner.email.toLowerCase() },
      ];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }, { status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderCancelled(order, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(tokenRepository.find).toHaveBeenCalledWith({
        where: {
          userEmail: In([mockUser.email.toLowerCase(), mockOwner.email.toLowerCase()]),
          activo: true,
        },
        order: { lastUsedAt: 'DESC' },
      });
    });

    it('debe solo notificar a usuario si actor es estudiante', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        motivoCancelacion: 'Cambio de opinión',
        user: mockUser,
        restaurant: { ...mockRestaurant, owner: mockOwner },
      };
      const tokens = [{ ...mockNotificationToken, userEmail: mockUser.email.toLowerCase() }];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderCancelled(order, UserRole.STUDENT);

      // Assert
      expect(tokenRepository.find).toHaveBeenCalledWith({
        where: {
          userEmail: In([mockUser.email.toLowerCase()]),
          activo: true,
        },
        order: { lastUsedAt: 'DESC' },
      });
      // Verificar que solo se llamó una vez (solo con el email del usuario, no del owner)
      expect(tokenRepository.find).toHaveBeenCalledTimes(1);
    });

    it('debe incluir motivoCancelacion en mensaje', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        motivoCancelacion: 'Sin ingredientes disponibles',
        user: mockUser,
        restaurant: { ...mockRestaurant, owner: mockOwner },
      };
      const tokens = [{ ...mockNotificationToken, userEmail: mockUser.email.toLowerCase() }];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderCancelled(order, UserRole.RESTAURANT_OWNER);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].body).toContain('Sin ingredientes disponibles');
    });

    it('no debe fallar si no hay recipients', async () => {
      // Arrange
      const orderWithoutUsers = {
        ...mockOrder,
        user: null,
        restaurant: { ...mockRestaurant, owner: null },
      };

      // Act & Assert
      await expect(service.notifyOrderCancelled(orderWithoutUsers, UserRole.ADMIN)).resolves.not.toThrow();
      expect(tokenRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('callExpoPushApi (método privado - tests indirectos)', () => {
    it('debe enviar mensajes en chunks de 50', async () => {
      // Arrange
      const tokens = Array.from({ length: 120 }, (_, i) => ({
        ...mockNotificationToken,
        id: `token-${i}`,
        expoPushToken: `ExponentPushToken[token${i}]`,
      }));
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: Array(50).fill({ status: 'ok' }),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: Array(50).fill({ status: 'ok' }),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: Array(20).fill({ status: 'ok' }),
          }),
        });

      // Act
      await service.sendPushNotification('sender-id', UserRole.RESTAURANT_OWNER, mockSendNotificationDto);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[0][1].body).toBeDefined();
      const firstChunk = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(firstChunk).toHaveLength(50);
    });

    it('debe manejar respuesta exitosa de Expo', async () => {
      // Arrange
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      const result = await service.sendPushNotification(
        'sender-id',
        UserRole.RESTAURANT_OWNER,
        mockSendNotificationDto,
      );

      // Assert
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('debe manejar respuesta con errores de Expo', async () => {
      // Arrange
      const tokens = [mockNotificationToken, { ...mockNotificationToken, id: 'token-2' }];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }, { status: 'error', message: 'Invalid token' }],
        }),
      });

      // Act
      const result = await service.sendPushNotification(
        'sender-id',
        UserRole.RESTAURANT_OWNER,
        mockSendNotificationDto,
      );

      // Assert
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('debe manejar error de red/fetch (InternalServerErrorException)', async () => {
      // Arrange
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      // Act & Assert
      await expect(
        service.sendPushNotification('sender-id', UserRole.RESTAURANT_OWNER, mockSendNotificationDto),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe manejar error de fetch (exception)', async () => {
      // Arrange
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(
        service.sendPushNotification('sender-id', UserRole.RESTAURANT_OWNER, mockSendNotificationDto),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deliverNotification (método privado - tests indirectos)', () => {
    it('debe buscar tokens activos por email', async () => {
      // Arrange
      const recipients = ['user1@example.com', 'user2@example.com'];
      const tokens = [
        { ...mockNotificationToken, userEmail: 'user1@example.com' },
        { ...mockNotificationToken, id: 'token-2', userEmail: 'user2@example.com' },
      ];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }, { status: 'ok' }],
        }),
      });

      // Act
      await service.sendPushNotification('sender-id', UserRole.RESTAURANT_OWNER, {
        ...mockSendNotificationDto,
        recipients,
      });

      // Assert
      expect(tokenRepository.find).toHaveBeenCalledWith({
        where: {
          userEmail: In(['user1@example.com', 'user2@example.com']),
          activo: true,
        },
        order: { lastUsedAt: 'DESC' },
      });
    });

    it('debe construir mensajes correctamente', async () => {
      // Arrange
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.sendPushNotification('sender-id', UserRole.RESTAURANT_OWNER, mockSendNotificationDto);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const messages = JSON.parse(fetchCall[1].body);
      expect(messages[0]).toMatchObject({
        to: mockExpoPushToken,
        sound: 'default',
        title: mockSendNotificationDto.title,
        body: mockSendNotificationDto.body,
        data: {
          type: mockSendNotificationDto.type,
          ...mockSendNotificationDto.data,
        },
        channelId: 'default',
        priority: 'high',
      });
    });

    it('debe retornar estadísticas correctas', async () => {
      // Arrange
      const tokens = Array.from({ length: 3 }, (_, i) => ({
        ...mockNotificationToken,
        id: `token-${i}`,
      }));
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }, { status: 'ok' }, { status: 'error' }],
        }),
      });

      // Act
      const result = await service.sendPushNotification(
        'sender-id',
        UserRole.RESTAURANT_OWNER,
        mockSendNotificationDto,
      );

      // Assert
      expect(result.attempted).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('debe retornar {attempted: 0, sent: 0, failed: 0} si no hay tokens', async () => {
      // Arrange
      tokenRepository.find.mockResolvedValue([]);

      // Act - Usar notifyNewOrder que internamente llama a deliverNotification
      const orderWithOwner = {
        ...mockOrder,
        restaurant: { ...mockRestaurant, owner: mockOwner },
      };
      await service.notifyNewOrder(orderWithOwner);

      // Assert - No debe llamar a fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('composeStatusNotification (método privado - tests indirectos)', () => {
    it('debe componer notificación para ACEPTADO', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.ACEPTADO,
        tiempoEstimado: 25,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].title).toBe('✅ Pedido aceptado');
      expect(body[0].body).toContain('ha sido aceptado');
      expect(body[0].body).toContain('25 minutos');
    });

    it('debe componer notificación para PREPARANDO', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.PREPARANDO,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].title).toBe('👩‍🍳 Pedido en preparación');
      expect(body[0].body).toContain('Estamos preparando');
    });

    it('debe componer notificación para LISTO', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.LISTO,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].title).toBe('🎉 ¡Pedido listo!');
      expect(body[0].body).toContain('está listo para recoger');
    });

    it('debe componer notificación para ENTREGADO', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.ENTREGADO,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].title).toBe('📦 Pedido entregado');
      expect(body[0].body).toContain('ha sido entregado');
    });

    it('debe componer notificación default para otros estados', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        status: OrderStatus.PENDIENTE,
        user: mockUser,
      };
      const tokens = [mockNotificationToken];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyOrderStatusChange(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body[0].title).toBe('Actualización de pedido');
      expect(body[0].body).toContain('cambió a pendiente');
      expect(body[0].data.type).toBe(NotificationType.PERSONALIZADA);
    });
  });

  describe('mergePreferences (método privado - tests indirectos)', () => {
    it('debe merge con defaults si no hay configuraciones', async () => {
      // Arrange
      const dtoWithoutConfig: RegisterTokenDto = {
        expoPushToken: mockExpoPushToken,
        deviceId: mockDeviceId,
        platform: NotificationPlatform.IOS,
      };
      const tokenWithDefaults = {
        ...mockNotificationToken,
        configuraciones: {
          pedidosNuevos: true,
          cambiosEstado: true,
          promociones: true,
        },
      };
      tokenRepository.findOne.mockResolvedValue(null);
      tokenRepository.create.mockReturnValue(tokenWithDefaults);
      tokenRepository.save.mockResolvedValue(tokenWithDefaults);

      // Act
      const result = await service.registerToken(mockUserId, mockUserEmail, dtoWithoutConfig);

      // Assert
      expect(result.configuraciones).toEqual({
        pedidosNuevos: true,
        cambiosEstado: true,
        promociones: true,
      });
    });

    it('debe merge con configuraciones existentes', async () => {
      // Arrange
      const existingConfig = {
        pedidosNuevos: true,
        cambiosEstado: false,
        promociones: true,
      };
      const tokenWithConfig = { ...mockNotificationToken, configuraciones: existingConfig };
      const partialUpdate: UpdateTokenDto = {
        configuraciones: {
          pedidosNuevos: true,
          cambiosEstado: true,
          promociones: true,
        },
      };
      const updatedToken = {
        ...tokenWithConfig,
        configuraciones: {
          ...existingConfig,
          cambiosEstado: true,
        },
      };
      tokenRepository.findOne.mockResolvedValue(tokenWithConfig);
      tokenRepository.save.mockResolvedValue(updatedToken);

      // Act
      const result = await service.updateToken(mockTokenId, mockUserId, partialUpdate);

      // Assert
      expect(result.configuraciones.pedidosNuevos).toBe(true); // Mantiene existente
      expect(result.configuraciones.cambiosEstado).toBe(true); // Actualizado
      expect(result.configuraciones.promociones).toBe(true); // Mantiene existente
    });

    it('debe merge con configuraciones nuevas', async () => {
      // Arrange
      const dtoWithNewConfig: RegisterTokenDto = {
        ...mockRegisterTokenDto,
        configuraciones: {
          pedidosNuevos: false,
          cambiosEstado: false,
          promociones: false,
        },
      };
      const tokenWithNewConfig = {
        ...mockNotificationToken,
        configuraciones: {
          pedidosNuevos: false,
          cambiosEstado: false,
          promociones: false,
        },
      };
      tokenRepository.findOne.mockResolvedValue(null);
      tokenRepository.create.mockReturnValue(tokenWithNewConfig);
      tokenRepository.save.mockResolvedValue(tokenWithNewConfig);

      // Act
      const result = await service.registerToken(mockUserId, mockUserEmail, dtoWithNewConfig);

      // Assert
      expect(result.configuraciones).toEqual({
        pedidosNuevos: false,
        cambiosEstado: false,
        promociones: false,
      });
    });
  });

  describe('formatCurrency (método privado - tests indirectos)', () => {
    it('debe formatear centavos a formato colombiano', async () => {
      // Arrange
      const order = {
        ...mockOrder,
        total: 15750,
        restaurant: { ...mockRestaurant, owner: mockOwner },
      };
      const tokens = [{ ...mockNotificationToken, userEmail: mockOwner.email.toLowerCase() }];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyNewOrder(order);

      // Assert
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      // El formato colombiano usa coma como separador decimal: 15750 centavos = $157,5
      expect(body[0].body).toContain('$157');
    });

    it('debe manejar diferentes valores', async () => {
      // Arrange
      const order1 = {
        ...mockOrder,
        total: 1000,
        restaurant: { ...mockRestaurant, owner: mockOwner },
      };
      const order2 = {
        ...mockOrder,
        total: 1000000,
        restaurant: { ...mockRestaurant, owner: mockOwner },
      };
      const tokens = [{ ...mockNotificationToken, userEmail: mockOwner.email.toLowerCase() }];
      tokenRepository.find.mockResolvedValue(tokens);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }],
        }),
      });

      // Act
      await service.notifyNewOrder(order1);
      await service.notifyNewOrder(order2);

      // Assert
      const body1 = JSON.parse(mockFetch.mock.calls[0][1].body);
      const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);
      // 1000 centavos = $10, 1000000 centavos = $10.000
      expect(body1[0].body).toContain('$10');
      expect(body2[0].body).toContain('$10');
    });
  });

  describe('toResponse (método privado - tests indirectos)', () => {
    it('debe convertir entidad a DTO correctamente', async () => {
      // Arrange
      const activeToken = { ...mockNotificationToken, activo: true };
      tokenRepository.findOne.mockResolvedValue(null);
      tokenRepository.create.mockReturnValue(activeToken);
      tokenRepository.save.mockResolvedValue(activeToken);

      // Act
      const result = await service.registerToken(mockUserId, mockUserEmail, mockRegisterTokenDto);

      // Assert
      expect(result).toMatchObject({
        id: mockTokenId,
        userId: mockUserId,
        userEmail: mockUserEmail.toLowerCase(),
        expoPushToken: mockExpoPushToken,
        deviceId: mockDeviceId,
        platform: NotificationPlatform.IOS,
        activo: true,
        userDevice: `${mockUserEmail.toLowerCase()}#${mockDeviceId}`,
      });
      expect(result.registeredAt).toBeInstanceOf(Date);
      expect(result.lastUsedAt).toBeInstanceOf(Date);
    });

    it('debe usar defaults si configuraciones es null', async () => {
      // Arrange
      const tokenWithoutConfig = {
        ...mockNotificationToken,
        configuraciones: null,
      };
      tokenRepository.findOne.mockResolvedValue(null);
      tokenRepository.create.mockReturnValue(tokenWithoutConfig);
      tokenRepository.save.mockResolvedValue(tokenWithoutConfig);

      // Act
      const result = await service.registerToken(mockUserId, mockUserEmail, mockRegisterTokenDto);

      // Assert - El método toResponse debe usar defaults
      // Esto se prueba indirectamente a través de registerToken
      expect(result.configuraciones).toBeDefined();
    });
  });
});
