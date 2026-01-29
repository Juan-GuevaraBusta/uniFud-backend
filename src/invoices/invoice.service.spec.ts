import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InvoicesService } from './invoice.service';
import { Invoice, InvoiceItem } from './entities/invoice.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { SiigoApiClient } from './siigo/siigo-api.client';
import { ResourceNotFoundException } from '../common/exceptions/not-found-exception';
import { BusinessException } from '../common/exceptions/business-exception';
import { CreateSiigoInvoiceDto, SiigoInvoiceResponseDto } from './dto/siigo-invoice.dto';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let invoiceRepository: Repository<Invoice>;
  let orderRepository: Repository<Order>;
  let siigoClient: SiigoApiClient;
  let configService: ConfigService;

  const mockInvoiceRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockOrderRepository = {
    findOne: jest.fn(),
  };

  const mockSiigoClient = {
    createInvoice: jest.fn(),
    getInvoice: jest.fn(),
    getInvoicePdf: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        SIIGO_DOCUMENT_ID: '24446',
        SIIGO_COST_CENTER: '235',
        SIIGO_SELLER: '629',
        SIIGO_TAX_ID: '13156',
        SIIGO_PAYMENT_CASH_ID: '5636',
        SIIGO_PAYMENT_CARD_ID: '10462',
      };
      return config[key] || '';
    }),
  };

  const mockOrder: Order = {
    id: 'order-uuid',
    numeroOrden: 'ORD-001',
    subtotal: 100000, // centavos
    total: 119000, // centavos
    userId: 'user-uuid',
    restaurantId: 'restaurant-uuid',
    status: 'entregado' as any,
    items: [
      {
        dishId: 'dish-uuid',
        dishNombre: 'Pizza Margarita',
        cantidad: 2,
        precioUnitario: 50000, // centavos
        precioTotal: 100000, // centavos
        toppingsSeleccionados: [{ id: 'topping-1', nombre: 'Queso Extra', precio: 2000 }],
        toppingsBaseRemocionados: [{ id: 'topping-2', nombre: 'Cebolla' }],
        comentarios: 'Sin sal',
      },
    ],
    user: {
      id: 'user-uuid',
      email: 'test@example.com',
      nombre: 'Test User',
    } as any,
    restaurant: {
      id: 'restaurant-uuid',
      nombre: 'Test Restaurant',
    } as any,
  } as Order;

  const mockSiigoInvoiceResponse: SiigoInvoiceResponseDto = {
    id: 'siigo-invoice-id',
    number: 'FE-001-00012345',
    prefix: 'FE',
    pdf_url: 'https://api.siigo.com/invoices/siigo-invoice-id/pdf',
    xml_url: 'https://api.siigo.com/invoices/siigo-invoice-id/xml',
    status: 'sent',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: mockInvoiceRepository,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: SiigoApiClient,
          useValue: mockSiigoClient,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    invoiceRepository = module.get<Repository<Invoice>>(getRepositoryToken(Invoice));
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    siigoClient = module.get<SiigoApiClient>(SiigoApiClient);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createInvoiceFromOrder', () => {
    it('debe crear factura exitosamente', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null); // No existe factura previa
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);

      const invoiceData = {
        orderId: mockOrder.id,
        siigoInvoiceId: mockSiigoInvoiceResponse.id,
        invoiceNumber: mockSiigoInvoiceResponse.number,
        invoicePrefix: mockSiigoInvoiceResponse.prefix,
        customerName: mockOrder.user.nombre,
        customerDocument: '1234567890',
        customerDocumentType: 'CC',
        customerEmail: mockOrder.user.email,
        subtotal: 1000, // pesos (100000 / 100)
        tax: 190, // pesos (100000 * 0.19 / 100)
        total: 1190, // pesos (119000 / 100)
        paymentMethod: 'card',
        items: [
          {
            description: 'Pizza Margarita',
            quantity: 2,
            unitPrice: 500, // pesos (50000 / 100)
            tax: 95, // pesos (50000 * 0.19 / 100)
            total: 1000, // pesos (100000 / 100)
          },
        ],
        pdfUrl: mockSiigoInvoiceResponse.pdf_url,
        xmlUrl: mockSiigoInvoiceResponse.xml_url,
        status: 'sent',
        sentAt: new Date(),
        notes: `Pedido #${mockOrder.numeroOrden} - ${mockOrder.restaurant.nombre}`,
      };

      const savedInvoice = {
        id: 'invoice-uuid',
        ...invoiceData,
      };

      mockInvoiceRepository.create.mockReturnValue(savedInvoice);
      mockInvoiceRepository.save.mockResolvedValue(savedInvoice);

      const result = await service.createInvoiceFromOrder('order-uuid');

      expect(result).toEqual(savedInvoice);
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order-uuid' },
        relations: ['user', 'restaurant'],
      });
      expect(mockInvoiceRepository.findOne).toHaveBeenCalledWith({
        where: { orderId: 'order-uuid' },
      });
      expect(mockSiigoClient.createInvoice).toHaveBeenCalled();
      expect(mockInvoiceRepository.save).toHaveBeenCalled();
      expect(result?.status).toBe('sent');
      expect(result?.siigoInvoiceId).toBe('siigo-invoice-id');
      expect(result?.invoiceNumber).toBe('FE-001-00012345');
    });

    it('debe lanzar ResourceNotFoundException cuando el pedido no existe', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(service.createInvoiceFromOrder('non-existent-order')).rejects.toThrow(
        ResourceNotFoundException,
      );
      await expect(service.createInvoiceFromOrder('non-existent-order')).rejects.toThrow(
        'Pedido no encontrado',
      );
    });

    it('debe retornar factura existente cuando ya existe una factura para el pedido', async () => {
      const existingInvoice = {
        id: 'existing-invoice-uuid',
        orderId: 'order-uuid',
        invoiceNumber: 'FE-001-00012345',
      };

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(existingInvoice);

      const result = await service.createInvoiceFromOrder('order-uuid');

      expect(result).toEqual(existingInvoice);
      expect(mockSiigoClient.createInvoice).not.toHaveBeenCalled();
      expect(mockInvoiceRepository.save).not.toHaveBeenCalled();
    });

    it('debe crear factura con estado error cuando falla Siigo', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null);

      const siigoError = new BusinessException('Error de Siigo', 'SIIGO_INVOICE_CREATION_ERROR');
      mockSiigoClient.createInvoice.mockRejectedValue(siigoError);

      const errorInvoice = {
        id: 'error-invoice-uuid',
        orderId: mockOrder.id,
        invoiceNumber: 'ERROR-ORD-001',
        status: 'error',
        notes: `Error al crear factura en Siigo: ${siigoError.message}`,
      };

      mockInvoiceRepository.create.mockReturnValue(errorInvoice);
      mockInvoiceRepository.save.mockResolvedValue(errorInvoice);

      const result = await service.createInvoiceFromOrder('order-uuid');

      expect(result).toEqual(errorInvoice);
      expect(result?.status).toBe('error');
      expect(result?.invoiceNumber).toBe('ERROR-ORD-001');
      expect(mockInvoiceRepository.save).toHaveBeenCalled();
    });

    it('debe retornar null cuando ocurre un error inesperado (no ResourceNotFoundException)', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.createInvoiceFromOrder('order-uuid');

      expect(result).toBeNull();
    });
  });

  describe('prepareInvoiceData', () => {
    it('debe formatear datos correctamente para Siigo', async () => {
      // Usamos createInvoiceFromOrder para probar prepareInvoiceData indirectamente
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);
      mockInvoiceRepository.create.mockReturnValue({} as Invoice);
      mockInvoiceRepository.save.mockResolvedValue({} as Invoice);

      await service.createInvoiceFromOrder('order-uuid');

      expect(mockSiigoClient.createInvoice).toHaveBeenCalled();
      const invoiceData: CreateSiigoInvoiceDto = mockSiigoClient.createInvoice.mock.calls[0][0];

      expect(invoiceData.document.id).toBe(24446);
      expect(invoiceData.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Formato YYYY-MM-DD
      expect(invoiceData.customer.identification).toBe('1234567890');
      expect(invoiceData.customer.branch_office).toBe(0);
      expect(invoiceData.cost_center).toBe(235);
      expect(invoiceData.seller).toBe(629);
      expect(invoiceData.observations).toBe(`Pedido #ORD-001 - Test Restaurant`);
      expect(invoiceData.items).toHaveLength(1);
      expect(invoiceData.items[0].code).toBe('ITEM-dish-uuid');
      expect(invoiceData.items[0].description).toBe(
        'Pizza Margarita (Con: Queso Extra) (Sin: Cebolla) - Sin sal',
      );
      expect(invoiceData.items[0].quantity).toBe(2);
      expect(invoiceData.items[0].price).toBe(500); // Convertido de centavos a pesos (50000 / 100)
      expect(invoiceData.items[0].taxes).toEqual([{ id: 13156, percentage: 19 }]);
      expect(invoiceData.payments).toHaveLength(1);
      expect(invoiceData.payments[0].id).toBe(10462); // Card payment ID
      expect(invoiceData.payments[0].value).toBe(1190); // Convertido de centavos a pesos (119000 / 100)
      expect(invoiceData.payments[0].due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('debe calcular IVA correctamente (19%)', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);
      mockInvoiceRepository.create.mockReturnValue({} as Invoice);
      mockInvoiceRepository.save.mockResolvedValue({} as Invoice);

      await service.createInvoiceFromOrder('order-uuid');

      const invoiceData: CreateSiigoInvoiceDto = mockSiigoClient.createInvoice.mock.calls[0][0];

      expect(invoiceData.items[0].taxes).toEqual([{ id: 13156, percentage: 19 }]);
      // Precio unitario: 50000 centavos = 500 pesos
      // IVA: 500 * 0.19 = 95 pesos
      expect(invoiceData.items[0].price).toBe(500);
    });

    it('debe convertir centavos a pesos correctamente', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);
      mockInvoiceRepository.create.mockReturnValue({} as Invoice);
      mockInvoiceRepository.save.mockResolvedValue({} as Invoice);

      await service.createInvoiceFromOrder('order-uuid');

      const invoiceData: CreateSiigoInvoiceDto = mockSiigoClient.createInvoice.mock.calls[0][0];

      // Precio unitario: 50000 centavos = 500 pesos
      expect(invoiceData.items[0].price).toBe(500);
      // Total del pago: 119000 centavos = 1190 pesos
      expect(invoiceData.payments[0].value).toBe(1190);
    });
  });

  describe('formatInvoiceItems', () => {
    it('debe calcular IVA 19% en formatInvoiceItems', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);

      const savedInvoice = {
        id: 'invoice-uuid',
        items: [
          {
            description: 'Pizza Margarita',
            quantity: 2,
            unitPrice: 500, // pesos (50000 / 100)
            tax: 95, // pesos (50000 * 0.19 / 100)
            total: 1000, // pesos (100000 / 100)
          },
        ],
      } as Invoice;

      mockInvoiceRepository.create.mockReturnValue(savedInvoice);
      mockInvoiceRepository.save.mockResolvedValue(savedInvoice);

      const result = await service.createInvoiceFromOrder('order-uuid');

      expect(result?.items).toBeDefined();
      expect(result?.items[0].unitPrice).toBe(500);
      expect(result?.items[0].tax).toBe(95); // 500 * 0.19 = 95
      expect(result?.items[0].total).toBe(1000);
    });

    it('debe calcular IVA correctamente en createInvoiceFromOrder - subtotal y tax', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);

      const savedInvoice = {
        id: 'invoice-uuid',
        subtotal: 1000, // pesos (100000 / 100)
        tax: 190, // pesos (100000 * 0.19 / 100)
        total: 1190, // pesos (119000 / 100)
      } as Invoice;

      mockInvoiceRepository.create.mockReturnValue(savedInvoice);
      mockInvoiceRepository.save.mockResolvedValue(savedInvoice);

      const result = await service.createInvoiceFromOrder('order-uuid');

      expect(result?.subtotal).toBe(1000);
      expect(result?.tax).toBe(190); // 100000 * 0.19 / 100 = 190
      expect(result?.total).toBe(1190);
    });
  });

  describe('formatItemDescription', () => {
    it('debe incluir toppings seleccionados en la descripción', async () => {
      const orderWithSelectedToppings = {
        ...mockOrder,
        items: [
          {
            ...mockOrder.items[0],
            toppingsSeleccionados: [
              { id: 'topping-1', nombre: 'Queso Extra', precio: 2000 },
              { id: 'topping-2', nombre: 'Bacon', precio: 3000 },
            ],
            toppingsBaseRemocionados: undefined,
            comentarios: undefined,
          },
        ],
      };

      mockOrderRepository.findOne.mockResolvedValue(orderWithSelectedToppings);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);
      mockInvoiceRepository.create.mockReturnValue({} as Invoice);
      mockInvoiceRepository.save.mockResolvedValue({} as Invoice);

      await service.createInvoiceFromOrder('order-uuid');

      const invoiceData: CreateSiigoInvoiceDto = mockSiigoClient.createInvoice.mock.calls[0][0];

      expect(invoiceData.items[0].description).toBe('Pizza Margarita (Con: Queso Extra, Bacon)');
    });

    it('debe incluir toppings removidos en la descripción', async () => {
      const orderWithRemovedToppings = {
        ...mockOrder,
        items: [
          {
            ...mockOrder.items[0],
            toppingsSeleccionados: undefined,
            toppingsBaseRemocionados: [
              { id: 'topping-1', nombre: 'Cebolla' },
              { id: 'topping-2', nombre: 'Tomate' },
            ],
            comentarios: undefined,
          },
        ],
      };

      mockOrderRepository.findOne.mockResolvedValue(orderWithRemovedToppings);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);
      mockInvoiceRepository.create.mockReturnValue({} as Invoice);
      mockInvoiceRepository.save.mockResolvedValue({} as Invoice);

      await service.createInvoiceFromOrder('order-uuid');

      const invoiceData: CreateSiigoInvoiceDto = mockSiigoClient.createInvoice.mock.calls[0][0];

      expect(invoiceData.items[0].description).toBe('Pizza Margarita (Sin: Cebolla, Tomate)');
    });

    it('debe incluir comentarios en la descripción', async () => {
      const orderWithComments = {
        ...mockOrder,
        items: [
          {
            ...mockOrder.items[0],
            toppingsSeleccionados: undefined,
            toppingsBaseRemocionados: undefined,
            comentarios: 'Sin sal, por favor',
          },
        ],
      };

      mockOrderRepository.findOne.mockResolvedValue(orderWithComments);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);
      mockInvoiceRepository.create.mockReturnValue({} as Invoice);
      mockInvoiceRepository.save.mockResolvedValue({} as Invoice);

      await service.createInvoiceFromOrder('order-uuid');

      const invoiceData: CreateSiigoInvoiceDto = mockSiigoClient.createInvoice.mock.calls[0][0];

      expect(invoiceData.items[0].description).toBe('Pizza Margarita - Sin sal, por favor');
    });

    it('debe incluir todos los campos combinados en la descripción', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);
      mockInvoiceRepository.create.mockReturnValue({} as Invoice);
      mockInvoiceRepository.save.mockResolvedValue({} as Invoice);

      await service.createInvoiceFromOrder('order-uuid');

      const invoiceData: CreateSiigoInvoiceDto = mockSiigoClient.createInvoice.mock.calls[0][0];

      expect(invoiceData.items[0].description).toBe(
        'Pizza Margarita (Con: Queso Extra) (Sin: Cebolla) - Sin sal',
      );
    });
  });

  describe('getCustomerDocument', () => {
    it('debe retornar valor por defecto 1234567890', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);
      mockInvoiceRepository.create.mockReturnValue({} as Invoice);
      mockInvoiceRepository.save.mockResolvedValue({} as Invoice);

      await service.createInvoiceFromOrder('order-uuid');

      const invoiceData: CreateSiigoInvoiceDto = mockSiigoClient.createInvoice.mock.calls[0][0];

      expect(invoiceData.customer.identification).toBe('1234567890');
    });
  });

  describe('determinePaymentMethod', () => {
    it('debe retornar card por defecto', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      mockSiigoClient.createInvoice.mockResolvedValue(mockSiigoInvoiceResponse);
      mockInvoiceRepository.create.mockReturnValue({} as Invoice);
      mockInvoiceRepository.save.mockResolvedValue({} as Invoice);

      await service.createInvoiceFromOrder('order-uuid');

      const invoiceData: CreateSiigoInvoiceDto = mockSiigoClient.createInvoice.mock.calls[0][0];

      // Card payment ID es 10462 según el mock
      expect(invoiceData.payments[0].id).toBe(10462);
    });
  });

  describe('createInvoiceWithError', () => {
    it('debe guardar factura con estado error cuando falla Siigo', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockInvoiceRepository.findOne.mockResolvedValue(null);

      const siigoError = new BusinessException('Error de Siigo', 'SIIGO_INVOICE_CREATION_ERROR');
      mockSiigoClient.createInvoice.mockRejectedValue(siigoError);

      const errorInvoice = {
        id: 'error-invoice-uuid',
        orderId: mockOrder.id,
        invoiceNumber: 'ERROR-ORD-001',
        invoicePrefix: 'FE',
        customerName: mockOrder.user.nombre,
        customerDocument: '1234567890',
        customerDocumentType: 'CC',
        customerEmail: mockOrder.user.email,
        subtotal: 1000,
        tax: 190,
        total: 1190,
        paymentMethod: 'card',
        items: [
          {
            description: 'Pizza Margarita',
            quantity: 2,
            unitPrice: 500,
            tax: 95,
            total: 1000,
          },
        ],
        status: 'error',
        notes: `Error al crear factura en Siigo: ${siigoError.message}`,
      };

      mockInvoiceRepository.create.mockReturnValue(errorInvoice);
      mockInvoiceRepository.save.mockResolvedValue(errorInvoice);

      const result = await service.createInvoiceFromOrder('order-uuid');

      expect(result?.status).toBe('error');
      expect(result?.invoiceNumber).toBe('ERROR-ORD-001');
      expect(result?.notes).toContain('Error al crear factura en Siigo');
      expect(mockInvoiceRepository.save).toHaveBeenCalled();
    });
  });
});
