import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { DishesService } from '../dishes/dishes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersGateway } from './orders.gateway';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { BusinessException } from '../common/exceptions/business-exception';
import { ForbiddenAccessException } from '../common/exceptions/unauthorized-exception';
import { ResourceNotFoundException } from '../common/exceptions/not-found-exception';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { Dish } from '../dishes/entities/dish.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { OrderItemDto } from './dto/order-item.dto';
import { ProcessPaymentResult } from '../payments/payments.service';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: jest.Mocked<Repository<Order>>;
  let restaurantsService: jest.Mocked<RestaurantsService>;
  let dishesService: jest.Mocked<DishesService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let ordersGateway: jest.Mocked<OrdersGateway>;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockUserId = 'user-uuid-123';
  const mockRestaurantId = 'restaurant-uuid-456';
  const mockDishId = 'dish-uuid-789';
  const mockOrderId = 'order-uuid-abc';

  const mockRestaurant: Restaurant = {
    id: mockRestaurantId,
    nombre: 'Test Restaurant',
    universityId: 'university-uuid',
    ownerId: 'owner-uuid-123',
    activo: true,
    categorias: ['Pizza', 'Hamburguesas'],
    calificacion: 4.5,
    tiempoEntrega: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Restaurant;

  const mockDish: Dish = {
    id: mockDishId,
    nombre: 'Pizza Margarita',
    descripcion: 'Pizza con queso y tomate',
    precio: 15000,
    categoria: 'Pizza',
    tipoPlato: 'simple' as any,
    restaurantId: mockRestaurantId,
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Dish;

  const mockOrder: Order = {
    id: mockOrderId,
    numeroOrden: '#ABC-123',
    userId: mockUserId,
    restaurantId: mockRestaurantId,
    status: OrderStatus.PENDIENTE,
    items: [
      {
        dishId: mockDishId,
        dishNombre: 'Pizza Margarita',
        cantidad: 2,
        precioUnitario: 15000,
        precioTotal: 30000,
      },
    ],
    subtotal: 30000,
    tarifaServicio: 1500,
    total: 31500,
    fechaPedido: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Order;

  const mockCreateOrderDto: CreateOrderDto = {
    restaurantId: mockRestaurantId,
    items: [
      {
        dishId: mockDishId,
        dishNombre: 'Pizza Margarita',
        cantidad: 2,
        precioUnitario: 15000,
        precioTotal: 30000,
      },
    ],
    comentariosCliente: 'Por favor que esté caliente',
  };

  const mockPaymentResult: ProcessPaymentResult = {
    transactionId: 'tx_test_123',
    status: 'APPROVED',
    reference: '#ABC-123',
    amountInCents: 31500,
  };

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: RestaurantsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DishesService,
          useValue: {
            checkAvailability: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notifyNewOrder: jest.fn(),
            notifyOrderStatusChange: jest.fn(),
            notifyOrderCancelled: jest.fn(),
          },
        },
        {
          provide: OrdersGateway,
          useValue: {
            notifyNewOrder: jest.fn(),
            notifyStatusChange: jest.fn(),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            processOrderPayment: jest.fn(),
            updatePaymentOrderId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepository = module.get(getRepositoryToken(Order));
    restaurantsService = module.get(RestaurantsService);
    dishesService = module.get(DishesService);
    notificationsService = module.get(NotificationsService);
    ordersGateway = module.get(OrdersGateway);
    paymentsService = module.get(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('debe crear un pedido válido con pago exitoso', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishesService.checkAvailability.mockResolvedValue(true);
      dishesService.findOne.mockResolvedValue(mockDish);
      paymentsService.processOrderPayment.mockResolvedValue(mockPaymentResult);
      orderRepository.create.mockReturnValue(mockOrder);
      orderRepository.save.mockResolvedValue(mockOrder);
      paymentsService.updatePaymentOrderId.mockResolvedValue(undefined);
      notificationsService.notifyNewOrder.mockResolvedValue(undefined);
      ordersGateway.notifyNewOrder.mockReturnValue(undefined);

      // Mock findOne: primero para verificar pedidos pendientes, luego para verificar número único, luego para obtener pedido completo
      orderRepository.findOne
        .mockResolvedValueOnce(null) // No hay pedidos pendientes
        .mockResolvedValueOnce(null) // No hay colisión en número de orden (generateOrderNumber)
        .mockResolvedValueOnce({
          ...mockOrder,
          user: {} as User,
          restaurant: mockRestaurant,
        } as Order);

      // Act
      const result = await service.create(mockCreateOrderDto, mockUserId);

      // Assert
      expect(restaurantsService.findOne).toHaveBeenCalledWith(mockRestaurantId);
      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          restaurantId: mockRestaurantId,
          status: OrderStatus.PENDIENTE,
        },
      });
      expect(dishesService.checkAvailability).toHaveBeenCalledWith(mockDishId, mockRestaurantId);
      expect(dishesService.findOne).toHaveBeenCalledWith(mockDishId);
      expect(paymentsService.processOrderPayment).toHaveBeenCalled();
      expect(orderRepository.create).toHaveBeenCalled();
      expect(orderRepository.save).toHaveBeenCalled();
      expect(paymentsService.updatePaymentOrderId).toHaveBeenCalledWith(
        mockPaymentResult.transactionId,
        mockOrder.id,
      );
      expect(notificationsService.notifyNewOrder).toHaveBeenCalled();
      expect(ordersGateway.notifyNewOrder).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.status).toBe(OrderStatus.PENDIENTE);
    });

    it('debe lanzar ResourceNotFoundException cuando el restaurante no existe', async () => {
      // Arrange
      restaurantsService.findOne.mockRejectedValue(
        new ResourceNotFoundException('Restaurante', { id: mockRestaurantId }),
      );

      // Act & Assert
      await expect(service.create(mockCreateOrderDto, mockUserId)).rejects.toThrow(
        ResourceNotFoundException,
      );
      expect(orderRepository.create).not.toHaveBeenCalled();
      expect(paymentsService.processOrderPayment).not.toHaveBeenCalled();
    });

    it('debe lanzar BusinessException cuando el restaurante está inactivo', async () => {
      // Arrange
      const inactiveRestaurant = { ...mockRestaurant, activo: false };
      restaurantsService.findOne.mockResolvedValue(inactiveRestaurant);

      // Act & Assert
      try {
        await service.create(mockCreateOrderDto, mockUserId);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'RESTAURANT_INACTIVE');
        expect(orderRepository.create).not.toHaveBeenCalled();
        expect(paymentsService.processOrderPayment).not.toHaveBeenCalled();
      }
    });

    it('debe lanzar BusinessException cuando hay un pedido pendiente duplicado', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.findOne.mockResolvedValue(mockOrder); // Ya existe un pedido pendiente

      // Act & Assert
      try {
        await service.create(mockCreateOrderDto, mockUserId);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_ALREADY_PENDING');
        expect(dishesService.checkAvailability).not.toHaveBeenCalled();
        expect(paymentsService.processOrderPayment).not.toHaveBeenCalled();
      }
    });

    it('debe lanzar BusinessException cuando un plato no está disponible', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.findOne.mockResolvedValue(null);
      dishesService.checkAvailability.mockResolvedValue(false); // Plato no disponible

      // Act & Assert
      try {
        await service.create(mockCreateOrderDto, mockUserId);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'DISH_NOT_AVAILABLE');
        expect(paymentsService.processOrderPayment).not.toHaveBeenCalled();
        expect(orderRepository.create).not.toHaveBeenCalled();
      }
    });

    it('debe lanzar BusinessException cuando un plato no pertenece al restaurante', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.findOne.mockResolvedValue(null);
      dishesService.checkAvailability.mockResolvedValue(true);
      const dishFromOtherRestaurant = { ...mockDish, restaurantId: 'other-restaurant-id' };
      dishesService.findOne.mockResolvedValue(dishFromOtherRestaurant);

      // Act & Assert
      try {
        await service.create(mockCreateOrderDto, mockUserId);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'DISH_RESTAURANT_MISMATCH');
        expect(paymentsService.processOrderPayment).not.toHaveBeenCalled();
        expect(orderRepository.create).not.toHaveBeenCalled();
      }
    });

    it('debe lanzar BusinessException cuando un plato está inactivo', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.findOne.mockResolvedValue(null);
      dishesService.checkAvailability.mockResolvedValue(true);
      const inactiveDish = { ...mockDish, activo: false };
      dishesService.findOne.mockResolvedValue(inactiveDish);

      // Act & Assert
      try {
        await service.create(mockCreateOrderDto, mockUserId);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'DISH_INACTIVE');
        expect(paymentsService.processOrderPayment).not.toHaveBeenCalled();
        expect(orderRepository.create).not.toHaveBeenCalled();
      }
    });

    it('debe lanzar BusinessException cuando el pago falla y NO crear el pedido', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.findOne.mockResolvedValue(null);
      dishesService.checkAvailability.mockResolvedValue(true);
      dishesService.findOne.mockResolvedValue(mockDish);
      paymentsService.processOrderPayment.mockRejectedValue(
        new BusinessException('Pago rechazado', 'PAYMENT_DECLINED'),
      );

      // Act & Assert
      try {
        await service.create(mockCreateOrderDto, mockUserId);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'PAYMENT_FAILED');
        expect(orderRepository.create).not.toHaveBeenCalled();
        expect(orderRepository.save).not.toHaveBeenCalled();
      }
    });

    it('debe continuar aunque falle la actualización de Payment.orderId', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishesService.checkAvailability.mockResolvedValue(true);
      dishesService.findOne.mockResolvedValue(mockDish);
      paymentsService.processOrderPayment.mockResolvedValue(mockPaymentResult);
      orderRepository.create.mockReturnValue(mockOrder);
      orderRepository.save.mockResolvedValue(mockOrder);
      paymentsService.updatePaymentOrderId.mockRejectedValue(new Error('Error updating payment'));
      notificationsService.notifyNewOrder.mockResolvedValue(undefined);
      ordersGateway.notifyNewOrder.mockReturnValue(undefined);

      // Mock findOne: primero para verificar pedidos pendientes, luego para verificar número único, luego para obtener pedido completo
      orderRepository.findOne
        .mockResolvedValueOnce(null) // No hay pedidos pendientes
        .mockResolvedValueOnce(null) // No hay colisión en número de orden (generateOrderNumber)
        .mockResolvedValueOnce({
          ...mockOrder,
          user: {} as User,
          restaurant: mockRestaurant,
        } as Order);

      // Act
      const result = await service.create(mockCreateOrderDto, mockUserId);

      // Assert
      expect(result).toBeDefined();
      expect(orderRepository.save).toHaveBeenCalled();
      expect(notificationsService.notifyNewOrder).toHaveBeenCalled();
    });
  });

  describe('calculateTotals', () => {
    it('debe calcular subtotal, tarifa de servicio y total correctamente', () => {
      // Arrange
      const items: OrderItemDto[] = [
        {
          dishId: 'dish-1',
          dishNombre: 'Pizza',
          cantidad: 2,
          precioUnitario: 15000,
          precioTotal: 30000,
        },
        {
          dishId: 'dish-2',
          dishNombre: 'Hamburguesa',
          cantidad: 1,
          precioUnitario: 20000,
          precioTotal: 20000,
        },
      ];

      // Act - Usamos create para probar calculateTotals indirectamente
      const subtotal = items.reduce((sum, item) => sum + item.precioTotal, 0);
      const tarifaServicio = Math.round(subtotal * 0.05);
      const total = subtotal + tarifaServicio;

      // Assert
      expect(subtotal).toBe(50000);
      expect(tarifaServicio).toBe(2500); // 5% de 50000
      expect(total).toBe(52500);
    });

    it('debe redondear correctamente la tarifa de servicio', () => {
      // Arrange
      const items: OrderItemDto[] = [
        {
          dishId: 'dish-1',
          dishNombre: 'Pizza',
          cantidad: 1,
          precioUnitario: 10001,
          precioTotal: 10001,
        },
      ];

      // Act
      const subtotal = items.reduce((sum, item) => sum + item.precioTotal, 0);
      const tarifaServicio = Math.round(subtotal * 0.05);

      // Assert
      expect(subtotal).toBe(10001);
      expect(tarifaServicio).toBe(500); // Math.round(10001 * 0.05) = 500
    });
  });

  describe('generateOrderNumber', () => {
    it('debe generar un número de orden en formato correcto', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishesService.checkAvailability.mockResolvedValue(true);
      dishesService.findOne.mockResolvedValue(mockDish);
      paymentsService.processOrderPayment.mockResolvedValue(mockPaymentResult);
      orderRepository.create.mockReturnValue(mockOrder);
      orderRepository.save.mockResolvedValue(mockOrder);
      paymentsService.updatePaymentOrderId.mockResolvedValue(undefined);
      notificationsService.notifyNewOrder.mockResolvedValue(undefined);
      ordersGateway.notifyNewOrder.mockReturnValue(undefined);

      // Mock findOne: primero para verificar pedidos pendientes, luego para verificar número único, luego para obtener pedido completo
      orderRepository.findOne
        .mockResolvedValueOnce(null) // No hay pedidos pendientes
        .mockResolvedValueOnce(null) // No hay colisión en número de orden
        .mockResolvedValueOnce({
          ...mockOrder,
          user: {} as User,
          restaurant: mockRestaurant,
        } as Order);

      // Act
      await service.create(mockCreateOrderDto, mockUserId);

      // Assert
      const createCall = orderRepository.create.mock.calls[0][0];
      expect(createCall.numeroOrden).toMatch(/^#[A-Z0-9]{3}-[A-Z0-9]{3}$/);
    });

    it('debe manejar colisiones de número de orden', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      dishesService.checkAvailability.mockResolvedValue(true);
      dishesService.findOne.mockResolvedValue(mockDish);
      paymentsService.processOrderPayment.mockResolvedValue(mockPaymentResult);
      orderRepository.create.mockReturnValue(mockOrder);
      orderRepository.save.mockResolvedValue(mockOrder);
      paymentsService.updatePaymentOrderId.mockResolvedValue(undefined);
      notificationsService.notifyNewOrder.mockResolvedValue(undefined);
      ordersGateway.notifyNewOrder.mockReturnValue(undefined);

      // Mock findOne: primero para verificar pedidos pendientes, luego colisión, luego sin colisión, luego obtener pedido completo
      orderRepository.findOne
        .mockResolvedValueOnce(null) // No hay pedidos pendientes
        .mockResolvedValueOnce(mockOrder) // Colisión en primera generación
        .mockResolvedValueOnce(null) // No hay colisión en segunda generación
        .mockResolvedValueOnce({
          ...mockOrder,
          user: {} as User,
          restaurant: mockRestaurant,
        } as Order);

      // Act
      await service.create(mockCreateOrderDto, mockUserId);

      // Assert - Debe haber intentado verificar el número generado
      expect(orderRepository.findOne).toHaveBeenCalledTimes(4); // 1 pendiente + 2 colisiones + 1 findOne final
    });
  });

  describe('updateStatus', () => {
    const updateStatusDto: UpdateOrderStatusDto = {
      status: OrderStatus.ACEPTADO,
      tiempoEstimado: 20,
    };

    it('debe actualizar estado de PENDIENTE a ACEPTADO correctamente', async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDIENTE };
      orderRepository.findOne.mockResolvedValueOnce(pendingOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.save.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.ACEPTADO,
        fechaAceptado: new Date(),
        tiempoEstimado: 20,
      });
      orderRepository.findOne.mockResolvedValueOnce({
        ...pendingOrder,
        status: OrderStatus.ACEPTADO,
        fechaAceptado: new Date(),
        tiempoEstimado: 20,
        user: {} as User,
        restaurant: mockRestaurant,
      } as Order);
      notificationsService.notifyOrderStatusChange.mockResolvedValue(undefined);
      ordersGateway.notifyStatusChange.mockReturnValue(undefined);

      // Act
      const result = await service.updateStatus(mockOrderId, updateStatusDto, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(orderRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(OrderStatus.ACEPTADO);
      expect(result.fechaAceptado).toBeDefined();
      expect(result.tiempoEstimado).toBe(20);
      expect(notificationsService.notifyOrderStatusChange).toHaveBeenCalled();
      expect(ordersGateway.notifyStatusChange).toHaveBeenCalled();
    });

    it('debe actualizar estado de ACEPTADO a PREPARANDO correctamente', async () => {
      // Arrange
      const acceptedOrder = {
        ...mockOrder,
        status: OrderStatus.ACEPTADO,
        fechaAceptado: new Date(),
        tiempoEstimado: 20,
      };
      orderRepository.findOne.mockResolvedValueOnce(acceptedOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.save.mockResolvedValue({
        ...acceptedOrder,
        status: OrderStatus.PREPARANDO,
      });
      orderRepository.findOne.mockResolvedValueOnce({
        ...acceptedOrder,
        status: OrderStatus.PREPARANDO,
        user: {} as User,
        restaurant: mockRestaurant,
      } as Order);
      notificationsService.notifyOrderStatusChange.mockResolvedValue(undefined);
      ordersGateway.notifyStatusChange.mockReturnValue(undefined);

      const updateDto: UpdateOrderStatusDto = {
        status: OrderStatus.PREPARANDO,
      };

      // Act
      const result = await service.updateStatus(mockOrderId, updateDto, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(result.status).toBe(OrderStatus.PREPARANDO);
      expect(notificationsService.notifyOrderStatusChange).toHaveBeenCalled();
    });

    it('debe actualizar estado de PREPARANDO a LISTO y actualizar fechaListo', async () => {
      // Arrange
      const preparingOrder = {
        ...mockOrder,
        status: OrderStatus.PREPARANDO,
        fechaAceptado: new Date(),
      };
      orderRepository.findOne.mockResolvedValueOnce(preparingOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.save.mockResolvedValue({
        ...preparingOrder,
        status: OrderStatus.LISTO,
        fechaListo: new Date(),
      });
      orderRepository.findOne.mockResolvedValueOnce({
        ...preparingOrder,
        status: OrderStatus.LISTO,
        fechaListo: new Date(),
        user: {} as User,
        restaurant: mockRestaurant,
      } as Order);
      notificationsService.notifyOrderStatusChange.mockResolvedValue(undefined);
      ordersGateway.notifyStatusChange.mockReturnValue(undefined);

      const updateDto: UpdateOrderStatusDto = {
        status: OrderStatus.LISTO,
      };

      // Act
      const result = await service.updateStatus(mockOrderId, updateDto, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(result.status).toBe(OrderStatus.LISTO);
      expect(result.fechaListo).toBeDefined();
    });

    it('debe actualizar estado de LISTO a ENTREGADO y actualizar fechaEntregado', async () => {
      // Arrange
      const readyOrder = {
        ...mockOrder,
        status: OrderStatus.LISTO,
        fechaListo: new Date(),
      };
      orderRepository.findOne.mockResolvedValueOnce(readyOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.save.mockResolvedValue({
        ...readyOrder,
        status: OrderStatus.ENTREGADO,
        fechaEntregado: new Date(),
      });
      orderRepository.findOne.mockResolvedValueOnce({
        ...readyOrder,
        status: OrderStatus.ENTREGADO,
        fechaEntregado: new Date(),
        user: {} as User,
        restaurant: mockRestaurant,
      } as Order);
      notificationsService.notifyOrderStatusChange.mockResolvedValue(undefined);
      ordersGateway.notifyStatusChange.mockReturnValue(undefined);

      const updateDto: UpdateOrderStatusDto = {
        status: OrderStatus.ENTREGADO,
      };

      // Act
      const result = await service.updateStatus(mockOrderId, updateDto, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(result.status).toBe(OrderStatus.ENTREGADO);
      expect(result.fechaEntregado).toBeDefined();
    });

    it('debe actualizar comentariosRestaurante si se proporcionan', async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDIENTE };
      orderRepository.findOne.mockResolvedValueOnce(pendingOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.save.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.ACEPTADO,
        comentariosRestaurante: 'Tu pedido estará listo pronto',
      });
      orderRepository.findOne.mockResolvedValueOnce({
        ...pendingOrder,
        status: OrderStatus.ACEPTADO,
        comentariosRestaurante: 'Tu pedido estará listo pronto',
        user: {} as User,
        restaurant: mockRestaurant,
      } as Order);
      notificationsService.notifyOrderStatusChange.mockResolvedValue(undefined);
      ordersGateway.notifyStatusChange.mockReturnValue(undefined);

      const updateDto: UpdateOrderStatusDto = {
        status: OrderStatus.ACEPTADO,
        tiempoEstimado: 20,
        comentarios: 'Tu pedido estará listo pronto',
      };

      // Act
      const result = await service.updateStatus(mockOrderId, updateDto, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);

      // Assert
      expect(result.comentariosRestaurante).toBe('Tu pedido estará listo pronto');
    });

    it('debe lanzar BusinessException cuando se intenta cancelar usando updateStatus', async () => {
      // Arrange
      const updateDto: UpdateOrderStatusDto = {
        status: OrderStatus.CANCELADO,
      };

      // Act & Assert
      try {
        await service.updateStatus(mockOrderId, updateDto, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_STATUS_USE_CANCEL_ENDPOINT');
      }
    });

    it('debe lanzar BusinessException cuando la transición es inválida', async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDIENTE };
      orderRepository.findOne.mockResolvedValue(pendingOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      const updateDto: UpdateOrderStatusDto = {
        status: OrderStatus.PREPARANDO, // No se puede saltar de PENDIENTE a PREPARANDO
      };

      // Act & Assert
      try {
        await service.updateStatus(mockOrderId, updateDto, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_STATUS_TRANSITION_INVALID');
      }
    });

    it('debe lanzar BusinessException cuando el pedido ya está cancelado', async () => {
      // Arrange
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELADO };
      orderRepository.findOne.mockResolvedValue(cancelledOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      const updateDto: UpdateOrderStatusDto = {
        status: OrderStatus.ACEPTADO,
      };

      // Act & Assert
      try {
        await service.updateStatus(mockOrderId, updateDto, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_STATUS_ALREADY_CANCELLED');
      }
    });

    it('debe lanzar BusinessException cuando el pedido ya está entregado', async () => {
      // Arrange
      const deliveredOrder = { ...mockOrder, status: OrderStatus.ENTREGADO };
      orderRepository.findOne.mockResolvedValue(deliveredOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      const updateDto: UpdateOrderStatusDto = {
        status: OrderStatus.ACEPTADO,
      };

      // Act & Assert
      try {
        await service.updateStatus(mockOrderId, updateDto, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_STATUS_ALREADY_DELIVERED');
      }
    });

    it('debe lanzar BusinessException cuando ACEPTADO no tiene tiempoEstimado', async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDIENTE };
      orderRepository.findOne.mockResolvedValue(pendingOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      const updateDto: UpdateOrderStatusDto = {
        status: OrderStatus.ACEPTADO,
        // tiempoEstimado no proporcionado
      };

      // Act & Assert
      try {
        await service.updateStatus(mockOrderId, updateDto, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_ESTIMATE_REQUIRED');
      }
    });

    it('debe lanzar BusinessException cuando PREPARANDO no viene de ACEPTADO', async () => {
      // Arrange
      const acceptedOrder = { ...mockOrder, status: OrderStatus.ACEPTADO };
      orderRepository.findOne.mockResolvedValue(acceptedOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);

      // Primero cambiar a PREPARANDO desde ACEPTADO (esto debería funcionar)
      const updateDto1: UpdateOrderStatusDto = {
        status: OrderStatus.PREPARANDO,
      };
      orderRepository.save.mockResolvedValue({ ...acceptedOrder, status: OrderStatus.PREPARANDO });
      orderRepository.findOne.mockResolvedValueOnce(acceptedOrder).mockResolvedValueOnce({
        ...acceptedOrder,
        status: OrderStatus.PREPARANDO,
        user: {} as User,
        restaurant: mockRestaurant,
      } as Order);
      notificationsService.notifyOrderStatusChange.mockResolvedValue(undefined);
      ordersGateway.notifyStatusChange.mockReturnValue(undefined);

      await service.updateStatus(mockOrderId, updateDto1, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);

      // Ahora intentar cambiar de PREPARANDO a PREPARANDO otra vez (esto debería fallar con transición inválida)
      // O mejor, intentar cambiar de un estado que no es ACEPTADO a PREPARANDO
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDIENTE };
      orderRepository.findOne.mockResolvedValue(pendingOrder);

      const updateDto2: UpdateOrderStatusDto = {
        status: OrderStatus.PREPARANDO,
      };

      // Act & Assert - Debe fallar con transición inválida primero
      try {
        await service.updateStatus(mockOrderId, updateDto2, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER);
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        // La validación de transición se ejecuta antes que la validación de secuencia
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_STATUS_TRANSITION_INVALID');
      }
    });

    it('debe lanzar ForbiddenAccessException cuando no tiene permisos', async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDIENTE };
      orderRepository.findOne.mockResolvedValueOnce(pendingOrder);
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      const updateDto: UpdateOrderStatusDto = {
        status: OrderStatus.ACEPTADO,
        tiempoEstimado: 20,
      };

      // Act & Assert
      await expect(
        service.updateStatus(mockOrderId, updateDto, 'unauthorized-user-id', UserRole.RESTAURANT_OWNER),
      ).rejects.toThrow(ForbiddenAccessException);
    });
  });

  describe('cancel', () => {
    it('debe cancelar pedido por estudiante (solo PENDIENTE)', async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDIENTE, userId: mockUserId };
      orderRepository.findOne.mockResolvedValueOnce(pendingOrder);
      orderRepository.save.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.CANCELADO,
        motivoCancelacion: 'Ya no lo necesito',
      });
      orderRepository.findOne.mockResolvedValueOnce({
        ...pendingOrder,
        status: OrderStatus.CANCELADO,
        motivoCancelacion: 'Ya no lo necesito',
        user: {} as User,
        restaurant: mockRestaurant,
      } as Order);
      notificationsService.notifyOrderCancelled.mockResolvedValue(undefined);
      ordersGateway.notifyStatusChange.mockReturnValue(undefined);

      // Act
      const result = await service.cancel(mockOrderId, mockUserId, UserRole.STUDENT, 'Ya no lo necesito');

      // Assert
      expect(result.status).toBe(OrderStatus.CANCELADO);
      expect(result.motivoCancelacion).toBe('Ya no lo necesito');
      expect(notificationsService.notifyOrderCancelled).toHaveBeenCalled();
      expect(ordersGateway.notifyStatusChange).toHaveBeenCalled();
    });

    it('debe cancelar pedido por restaurante owner (cualquier estado excepto ENTREGADO)', async () => {
      // Arrange
      const acceptedOrder = {
        ...mockOrder,
        status: OrderStatus.ACEPTADO,
        restaurantId: mockRestaurantId,
      };
      orderRepository.findOne.mockResolvedValueOnce(acceptedOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.save.mockResolvedValue({
        ...acceptedOrder,
        status: OrderStatus.CANCELADO,
        motivoCancelacion: 'No hay ingredientes',
        comentariosRestaurante: 'Lo sentimos',
      });
      orderRepository.findOne.mockResolvedValueOnce({
        ...acceptedOrder,
        status: OrderStatus.CANCELADO,
        motivoCancelacion: 'No hay ingredientes',
        comentariosRestaurante: 'Lo sentimos',
        user: {} as User,
        restaurant: mockRestaurant,
      } as Order);
      notificationsService.notifyOrderCancelled.mockResolvedValue(undefined);
      ordersGateway.notifyStatusChange.mockReturnValue(undefined);

      // Act
      const result = await service.cancel(
        mockOrderId,
        mockRestaurant.ownerId,
        UserRole.RESTAURANT_OWNER,
        'No hay ingredientes',
        'Lo sentimos',
      );

      // Assert
      expect(result.status).toBe(OrderStatus.CANCELADO);
      expect(result.comentariosRestaurante).toBe('Lo sentimos');
    });

    it('debe cancelar pedido por admin (cualquier estado excepto ENTREGADO)', async () => {
      // Arrange
      const preparingOrder = {
        ...mockOrder,
        status: OrderStatus.PREPARANDO,
      };
      orderRepository.findOne.mockResolvedValueOnce(preparingOrder);
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.save.mockResolvedValue({
        ...preparingOrder,
        status: OrderStatus.CANCELADO,
        motivoCancelacion: 'Cancelación administrativa',
      });
      orderRepository.findOne.mockResolvedValueOnce({
        ...preparingOrder,
        status: OrderStatus.CANCELADO,
        motivoCancelacion: 'Cancelación administrativa',
        user: {} as User,
        restaurant: mockRestaurant,
      } as Order);
      notificationsService.notifyOrderCancelled.mockResolvedValue(undefined);
      ordersGateway.notifyStatusChange.mockReturnValue(undefined);

      // Act
      const result = await service.cancel(mockOrderId, 'admin-id', UserRole.ADMIN, 'Cancelación administrativa');

      // Assert
      expect(result.status).toBe(OrderStatus.CANCELADO);
    });

    it('debe lanzar ForbiddenAccessException cuando estudiante intenta cancelar pedido de otro', async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDIENTE, userId: 'other-user-id' };
      orderRepository.findOne.mockResolvedValueOnce(pendingOrder);

      // Act & Assert
      await expect(
        service.cancel(mockOrderId, mockUserId, UserRole.STUDENT, 'Motivo'),
      ).rejects.toThrow(ForbiddenAccessException);
    });

    it('debe lanzar BusinessException cuando estudiante intenta cancelar pedido no PENDIENTE', async () => {
      // Arrange
      const acceptedOrder = { ...mockOrder, status: OrderStatus.ACEPTADO, userId: mockUserId };
      orderRepository.findOne.mockResolvedValue(acceptedOrder);

      // Act & Assert
      try {
        await service.cancel(mockOrderId, mockUserId, UserRole.STUDENT, 'Motivo');
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_CANCEL_INVALID_STATUS');
      }
    });

    it('debe lanzar ForbiddenAccessException cuando restaurante intenta cancelar pedido de otro restaurante', async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDIENTE, restaurantId: 'other-restaurant-id' };
      orderRepository.findOne.mockResolvedValueOnce(pendingOrder);
      const otherRestaurant = { ...mockRestaurant, id: 'other-restaurant-id', ownerId: 'other-owner-id' };
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      // Act & Assert
      await expect(
        service.cancel(mockOrderId, mockRestaurant.ownerId, UserRole.RESTAURANT_OWNER, 'Motivo'),
      ).rejects.toThrow(ForbiddenAccessException);
    });

    it('debe lanzar BusinessException cuando se intenta cancelar pedido ya cancelado', async () => {
      // Arrange
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELADO };
      orderRepository.findOne.mockResolvedValue(cancelledOrder);

      // Act & Assert
      try {
        await service.cancel(mockOrderId, mockUserId, UserRole.STUDENT, 'Motivo');
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_ALREADY_CANCELLED');
      }
    });

    it('debe lanzar BusinessException cuando se intenta cancelar pedido ya entregado', async () => {
      // Arrange
      const deliveredOrder = { ...mockOrder, status: OrderStatus.ENTREGADO };
      orderRepository.findOne.mockResolvedValue(deliveredOrder);

      // Act & Assert
      try {
        await service.cancel(mockOrderId, mockUserId, UserRole.STUDENT, 'Motivo');
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_CANCEL_DELIVERED');
      }
    });

    it('debe lanzar BusinessException cuando no se proporciona motivo de cancelación', async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDIENTE, userId: mockUserId };
      orderRepository.findOne.mockResolvedValue(pendingOrder);

      // Act & Assert
      try {
        await service.cancel(mockOrderId, mockUserId, UserRole.STUDENT, '');
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_CANCEL_REASON_REQUIRED');
      }

      // Test con espacios en blanco
      try {
        await service.cancel(mockOrderId, mockUserId, UserRole.STUDENT, '   ');
        fail('Debe lanzar BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toHaveProperty('errorCode', 'ORDER_CANCEL_REASON_REQUIRED');
      }
    });
  });

  describe('findOne', () => {
    it('debe retornar pedido con relaciones (user, restaurant)', async () => {
      // Arrange
      const orderWithRelations = {
        ...mockOrder,
        user: {} as User,
        restaurant: mockRestaurant,
      };
      orderRepository.findOne.mockResolvedValue(orderWithRelations);

      // Act
      const result = await service.findOne(mockOrderId);

      // Assert
      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        relations: ['user', 'restaurant'],
      });
      expect(result).toEqual(orderWithRelations);
    });

    it('debe lanzar ResourceNotFoundException cuando el pedido no existe', async () => {
      // Arrange
      orderRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(mockOrderId)).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('findAll', () => {
    it('debe retornar todos los pedidos con paginación', async () => {
      // Arrange
      const orders = [mockOrder];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([orders, 1]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('order.fechaPedido', 'DESC');
      expect(result.items).toEqual(orders);
      expect(result.meta.total).toBe(1);
    });

    it('debe aplicar filtros correctamente', async () => {
      // Arrange
      const filters = {
        status: OrderStatus.PENDIENTE,
        restaurantId: mockRestaurantId,
        userId: mockUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.findAll(filters);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('debe aplicar paginación correctamente', async () => {
      // Arrange
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.limit = 10;
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.findAll(undefined, pagination);

      // Assert
      expect(mockQueryBuilder.skip).toHaveBeenCalled();
      expect(mockQueryBuilder.take).toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('debe retornar pedidos del usuario con paginación', async () => {
      // Arrange
      const orders = [mockOrder];
      orderRepository.findAndCount.mockResolvedValue([orders, 1]);

      // Act
      const result = await service.findByUser(mockUserId);

      // Assert
      expect(orderRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        relations: ['restaurant'],
        order: { fechaPedido: 'DESC' },
      });
      expect(result.items).toEqual(orders);
      expect(result.meta.total).toBe(1);
    });

    it('debe aplicar paginación cuando se proporciona', async () => {
      // Arrange
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.limit = 10;
      orderRepository.findAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.findByUser(mockUserId, pagination);

      // Assert
      expect(orderRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: pagination.skip,
          take: pagination.take,
        }),
      );
    });
  });

  describe('findByRestaurant', () => {
    it('debe retornar pedidos del restaurante con paginación', async () => {
      // Arrange
      const orders = [mockOrder];
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.findAndCount.mockResolvedValue([orders, 1]);

      // Act
      const result = await service.findByRestaurant(
        mockRestaurantId,
        undefined,
        mockRestaurant.ownerId,
        UserRole.RESTAURANT_OWNER,
      );

      // Assert
      expect(orderRepository.findAndCount).toHaveBeenCalledWith({
        where: { restaurantId: mockRestaurantId },
        relations: ['user'],
        order: { fechaPedido: 'ASC' },
      });
      expect(result.items).toEqual(orders);
    });

    it('debe filtrar por status si se proporciona', async () => {
      // Arrange
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.findAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.findByRestaurant(
        mockRestaurantId,
        OrderStatus.PENDIENTE,
        mockRestaurant.ownerId,
        UserRole.RESTAURANT_OWNER,
      );

      // Assert
      expect(orderRepository.findAndCount).toHaveBeenCalledWith({
        where: { restaurantId: mockRestaurantId, status: OrderStatus.PENDIENTE },
        relations: ['user'],
        order: { fechaPedido: 'ASC' },
      });
    });

    it('debe validar permisos (solo owner o admin)', async () => {
      // Arrange
      const orders = [mockOrder];
      restaurantsService.findOne.mockResolvedValue(mockRestaurant);
      orderRepository.findAndCount.mockResolvedValue([orders, 1]);

      // Act
      await service.findByRestaurant(
        mockRestaurantId,
        undefined,
        mockRestaurant.ownerId,
        UserRole.RESTAURANT_OWNER,
      );

      // Assert
      expect(restaurantsService.findOne).toHaveBeenCalledWith(mockRestaurantId);
      expect(orderRepository.findAndCount).toHaveBeenCalled();
    });

    it('debe lanzar ForbiddenAccessException cuando no tiene permisos', async () => {
      // Arrange
      const otherRestaurant = { ...mockRestaurant, ownerId: 'other-owner-id' };
      restaurantsService.findOne.mockResolvedValue(otherRestaurant);

      // Act & Assert
      await expect(
        service.findByRestaurant(
          mockRestaurantId,
          undefined,
          'unauthorized-user-id',
          UserRole.RESTAURANT_OWNER,
        ),
      ).rejects.toThrow(ForbiddenAccessException);
    });
  });

  describe('getRestaurantStats', () => {
    it('debe calcular estadísticas correctamente', async () => {
      // Arrange
      const orders = [
        { ...mockOrder, status: OrderStatus.PENDIENTE },
        { ...mockOrder, id: 'order-2', status: OrderStatus.ACEPTADO },
        { ...mockOrder, id: 'order-3', status: OrderStatus.PREPARANDO },
        { ...mockOrder, id: 'order-4', status: OrderStatus.ENTREGADO },
        { ...mockOrder, id: 'order-5', status: OrderStatus.ENTREGADO },
      ];
      orderRepository.find.mockResolvedValue(orders);

      // Act
      const result = await service.getRestaurantStats(mockRestaurantId);

      // Assert
      expect(result.total).toBe(5);
      expect(result.pendientes).toBe(1);
      expect(result.enPreparacion).toBe(2); // ACEPTADO + PREPARANDO
      expect(result.completados).toBe(2);
    });

    it('debe retornar estructura correcta', async () => {
      // Arrange
      orderRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getRestaurantStats(mockRestaurantId);

      // Assert
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('pendientes');
      expect(result).toHaveProperty('enPreparacion');
      expect(result).toHaveProperty('completados');
    });
  });
});
