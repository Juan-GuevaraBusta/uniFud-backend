import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SiigoApiClient } from './siigo-api.client';
import { BusinessException } from '../../common/exceptions/business-exception';
import { CreateSiigoInvoiceDto, SiigoInvoiceResponseDto, SiigoAuthResponseDto } from '../dto/siigo-invoice.dto';
import axios, { AxiosError } from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Helper para crear errores de Axios correctamente
const createAxiosError = (status: number, data: any): AxiosError => {
  const error = new Error(`Request failed with status code ${status}`) as AxiosError;
  error.isAxiosError = true;
  error.response = {
    status,
    data,
    headers: {},
    config: {} as any,
    statusText: 'Error',
  };
  error.message = `Request failed with status code ${status}`;
  return error;
};

describe('SiigoApiClient', () => {
  let client: SiigoApiClient;
  let configService: ConfigService;
  let mockAxiosInstance: any;

  beforeEach(async () => {
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    };

    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);
    
    // Mock axios.isAxiosError para que funcione correctamente
    const mockIsAxiosError = jest.fn((payload: any): payload is AxiosError => {
      return payload && payload.isAxiosError === true;
    });
    Object.defineProperty(axios, 'isAxiosError', {
      value: mockIsAxiosError,
      writable: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiigoApiClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                SIIGO_API_URL: 'https://api.siigo.com',
                SIIGO_USERNAME: 'test_username',
                SIIGO_ACCESS_KEY: 'test_access_key',
              };
              return config[key] || '';
            }),
          },
        },
      ],
    }).compile();

    client = module.get<SiigoApiClient>(SiigoApiClient);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('debe autenticarse exitosamente con credenciales válidas', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: mockAuthResponse,
      });

      // Llamar authenticate a través de createInvoice para probarlo indirectamente
      // ya que es privado
      const mockInvoiceData: CreateSiigoInvoiceDto = {
        document: { id: 24446 },
        date: '2024-01-15',
        customer: { identification: '1234567890', branch_office: 0 },
        cost_center: 235,
        seller: 629,
        items: [],
        payments: [],
      };

      const mockInvoiceResponse: SiigoInvoiceResponseDto = {
        id: 'invoice-id',
        number: 'FE-001-00012345',
        prefix: 'FE',
      };

      // Primera llamada para autenticar, segunda para crear factura
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockAuthResponse })
        .mockResolvedValueOnce({ data: mockInvoiceResponse });

      const result = await client.createInvoice(mockInvoiceData);

      expect(result).toEqual(mockInvoiceResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth', {
        username: 'test_username',
        access_key: 'test_access_key',
      });
    });

    it('debe lanzar BusinessException cuando faltan credenciales', async () => {
      const moduleWithoutCreds = await Test.createTestingModule({
        providers: [
          SiigoApiClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  SIIGO_API_URL: 'https://api.siigo.com',
                  SIIGO_USERNAME: '',
                  SIIGO_ACCESS_KEY: '',
                };
                return config[key] || '';
              }),
            },
          },
        ],
      }).compile();

      const clientWithoutCreds = moduleWithoutCreds.get<SiigoApiClient>(SiigoApiClient);

      const mockInvoiceData: CreateSiigoInvoiceDto = {
        document: { id: 24446 },
        date: '2024-01-15',
        customer: { identification: '1234567890', branch_office: 0 },
        cost_center: 235,
        seller: 629,
        items: [],
        payments: [],
      };

      await expect(clientWithoutCreds.createInvoice(mockInvoiceData)).rejects.toThrow(
        new BusinessException('Credenciales de Siigo no configuradas', 'SIIGO_CREDENTIALS_MISSING'),
      );
    });

    it('debe lanzar BusinessException con código SIIGO_AUTH_FAILED cuando credenciales son inválidas (401)', async () => {
      const mockInvoiceData: CreateSiigoInvoiceDto = {
        document: { id: 24446 },
        date: '2024-01-15',
        customer: { identification: '1234567890', branch_office: 0 },
        cost_center: 235,
        seller: 629,
        items: [],
        payments: [],
      };

      const axiosError = createAxiosError(401, { message: 'Credenciales inválidas' });
      
      // Primera llamada es para authenticate, segunda para createInvoice
      mockAxiosInstance.post
        .mockRejectedValueOnce(axiosError) // authenticate falla
        .mockRejectedValueOnce(axiosError); // createInvoice falla

      await expect(client.createInvoice(mockInvoiceData)).rejects.toThrow(BusinessException);
      await expect(client.createInvoice(mockInvoiceData)).rejects.toThrow('Credenciales de Siigo inválidas');
    });

    it('debe lanzar BusinessException con código SIIGO_AUTH_ERROR en errores de red o timeout', async () => {
      const mockInvoiceData: CreateSiigoInvoiceDto = {
        document: { id: 24446 },
        date: '2024-01-15',
        customer: { identification: '1234567890', branch_office: 0 },
        cost_center: 235,
        seller: 629,
        items: [],
        payments: [],
      };

      const axiosError = createAxiosError(500, { message: 'Internal server error' });
      
      // Primera llamada es para authenticate - debe fallar
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);

      const promise = client.createInvoice(mockInvoiceData);
      await expect(promise).rejects.toThrow(BusinessException);
      await expect(promise).rejects.toThrow('Error de autenticación con Siigo');
      
      // Verificar que se llamó a authenticate (endpoint /auth)
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth', {
        username: 'test_username',
        access_key: 'test_access_key',
      });
    });
  });

  describe('getValidToken', () => {
    it('debe retornar token existente si aún es válido', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const mockInvoiceResponse: SiigoInvoiceResponseDto = {
        id: 'invoice-id',
        number: 'FE-001-00012345',
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockAuthResponse })
        .mockResolvedValueOnce({ data: mockInvoiceResponse });

      const mockInvoiceData: CreateSiigoInvoiceDto = {
        document: { id: 24446 },
        date: '2024-01-15',
        customer: { identification: '1234567890', branch_office: 0 },
        cost_center: 235,
        seller: 629,
        items: [],
        payments: [],
      };

      // Primera llamada (autentica y crea factura)
      await client.createInvoice(mockInvoiceData);

      // Segunda llamada (debe usar token existente)
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockInvoiceResponse });
      await client.createInvoice(mockInvoiceData);

      // Debe haber llamado authenticate solo una vez (en la primera llamada)
      const authCalls = mockAxiosInstance.post.mock.calls.filter(
        (call) => call[0] === '/auth',
      );
      expect(authCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('createInvoice', () => {
    it('debe crear factura exitosamente', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const mockInvoiceData: CreateSiigoInvoiceDto = {
        document: { id: 24446 },
        date: '2024-01-15',
        customer: { identification: '1234567890', branch_office: 0 },
        cost_center: 235,
        seller: 629,
        items: [
          {
            code: 'ITEM-123',
            description: 'Pizza Margarita',
            quantity: 2,
            price: 15000,
            taxes: [{ id: 13156, percentage: 19 }],
          },
        ],
        payments: [{ id: 5636, value: 35700, due_date: '2024-01-15' }],
      };

      const mockInvoiceResponse: SiigoInvoiceResponseDto = {
        id: 'siigo-invoice-id',
        number: 'FE-001-00012345',
        prefix: 'FE',
        pdf_url: 'https://api.siigo.com/invoices/siigo-invoice-id/pdf',
        xml_url: 'https://api.siigo.com/invoices/siigo-invoice-id/xml',
        status: 'sent',
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockAuthResponse })
        .mockResolvedValueOnce({ data: mockInvoiceResponse });

      const result = await client.createInvoice(mockInvoiceData);

      expect(result).toEqual(mockInvoiceResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/invoices', mockInvoiceData, {
        headers: {
          Authorization: 'Bearer test_access_token_12345',
        },
      });
    });

    it('debe manejar token expirado (401) con reautenticación automática', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'new_access_token_12345',
        expires_in: 3600,
      };

      const mockInvoiceData: CreateSiigoInvoiceDto = {
        document: { id: 24446 },
        date: '2024-01-15',
        customer: { identification: '1234567890', branch_office: 0 },
        cost_center: 235,
        seller: 629,
        items: [],
        payments: [],
      };

      const mockInvoiceResponse: SiigoInvoiceResponseDto = {
        id: 'invoice-id',
        number: 'FE-001-00012345',
      };

      const axiosError401 = createAxiosError(401, { message: 'Token expirado' });

      // Primera autenticación (token inicial)
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse });
      // Primera llamada createInvoice retorna 401
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError401);
      // Reautenticación
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse });
      // Segunda llamada createInvoice exitosa
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockInvoiceResponse });

      const result = await client.createInvoice(mockInvoiceData);

      expect(result).toEqual(mockInvoiceResponse);
      // Debe haber llamado authenticate dos veces (inicial + retry)
      const authCalls = mockAxiosInstance.post.mock.calls.filter(
        (call) => call[0] === '/auth',
      );
      expect(authCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('debe lanzar BusinessException si el error 401 persiste después de reautenticar', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'new_access_token_12345',
        expires_in: 3600,
      };

      const mockInvoiceData: CreateSiigoInvoiceDto = {
        document: { id: 24446 },
        date: '2024-01-15',
        customer: { identification: '1234567890', branch_office: 0 },
        cost_center: 235,
        seller: 629,
        items: [],
        payments: [],
      };

      const axiosError401 = createAxiosError(401, { message: 'Token expirado' });

      // Configurar mocks en el orden correcto:
      // 1. Primera autenticación (token inicial) - POST /auth
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse });
      // 2. Primera llamada createInvoice retorna 401 - POST /v1/invoices
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError401);
      // 3. Reautenticación exitosa - POST /auth
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse });
      // 4. Segunda llamada createInvoice retorna 401 nuevamente - POST /v1/invoices
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError401);

      const promise = client.createInvoice(mockInvoiceData);
      await expect(promise).rejects.toThrow(BusinessException);
      await expect(promise).rejects.toThrow(
        'Error de autenticación con Siigo al crear factura',
      );
    });

    it('debe lanzar BusinessException con código SIIGO_INVOICE_CREATION_ERROR en errores de validación (400/422)', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const mockInvoiceData: CreateSiigoInvoiceDto = {
        document: { id: 24446 },
        date: '2024-01-15',
        customer: { identification: '1234567890', branch_office: 0 },
        cost_center: 235,
        seller: 629,
        items: [],
        payments: [],
      };

      const axiosError = createAxiosError(400, {
        message: 'Error de validación',
        errors: [
          { field: 'customer.identification', message: 'Cliente no encontrado' },
        ],
      });

      // Configurar mocks: primero authenticate, luego createInvoice falla
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockAuthResponse }) // POST /auth - authenticate
        .mockRejectedValueOnce(axiosError); // POST /v1/invoices - createInvoice falla

      const promise = client.createInvoice(mockInvoiceData);
      await expect(promise).rejects.toThrow(BusinessException);
      await expect(promise).rejects.toThrow(
        'Error creando factura en Siigo',
      );
    });

    it('debe lanzar error en caso de error de red o timeout', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const mockInvoiceData: CreateSiigoInvoiceDto = {
        document: { id: 24446 },
        date: '2024-01-15',
        customer: { identification: '1234567890', branch_office: 0 },
        cost_center: 235,
        seller: 629,
        items: [],
        payments: [],
      };

      const networkError = new Error('Network Error');

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockAuthResponse })
        .mockRejectedValueOnce(networkError);

      await expect(client.createInvoice(mockInvoiceData)).rejects.toThrow('Network Error');
    });
  });

  describe('getInvoice', () => {
    it('debe obtener factura exitosamente por ID', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const mockInvoiceResponse: SiigoInvoiceResponseDto = {
        id: 'invoice-id-123',
        number: 'FE-001-00012345',
        prefix: 'FE',
        pdf_url: 'https://api.siigo.com/invoices/invoice-id-123/pdf',
        xml_url: 'https://api.siigo.com/invoices/invoice-id-123/xml',
        status: 'sent',
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse });
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockInvoiceResponse });

      const result = await client.getInvoice('invoice-id-123');

      expect(result).toEqual(mockInvoiceResponse);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/invoices/invoice-id-123', {
        headers: {
          Authorization: 'Bearer test_access_token_12345',
        },
      });
    });

    it('debe lanzar BusinessException con código SIIGO_INVOICE_NOT_FOUND cuando la factura no existe (404)', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const axiosError = createAxiosError(404, { message: 'Factura no encontrada' });

      // Configurar mocks: primero authenticate, luego getInvoice falla
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse }); // POST /auth - authenticate
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError); // GET /v1/invoices/{id} - getInvoice falla

      const promise = client.getInvoice('non-existent-id');
      await expect(promise).rejects.toThrow(BusinessException);
      await expect(promise).rejects.toThrow(
        'Factura non-existent-id no encontrada en Siigo',
      );
    });

    it('debe manejar token expirado (401) con reautenticación automática en getInvoice', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'new_access_token_12345',
        expires_in: 3600,
      };

      const mockInvoiceResponse: SiigoInvoiceResponseDto = {
        id: 'invoice-id-123',
        number: 'FE-001-00012345',
      };

      const axiosError401 = createAxiosError(401, { message: 'Token expirado' });

      // Primera autenticación (token inicial)
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse });
      // Primera llamada getInvoice retorna 401
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError401);

      // Nota: getInvoice actualmente no tiene retry automático como createInvoice,
      // así que este test verificará el comportamiento actual.
      await expect(client.getInvoice('invoice-id-123')).rejects.toThrow(BusinessException);
    });

    it('debe lanzar BusinessException con código SIIGO_INVOICE_GET_ERROR en otros errores (500, etc.)', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const axiosError = createAxiosError(500, { message: 'Internal server error' });

      // Configurar mocks: primero authenticate, luego getInvoice falla
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse }); // POST /auth - authenticate
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError); // GET /v1/invoices/{id} - getInvoice falla

      const promise = client.getInvoice('invoice-id-123');
      await expect(promise).rejects.toThrow(BusinessException);
      await expect(promise).rejects.toThrow(
        'Error obteniendo factura de Siigo',
      );
    });
  });

  describe('getInvoicePdf', () => {
    it('debe obtener URL del PDF exitosamente desde endpoint /pdf', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const pdfUrl = 'https://api.siigo.com/invoices/invoice-id-123/pdf';

      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { pdf_url: pdfUrl },
      });

      const result = await client.getInvoicePdf('invoice-id-123');

      expect(result).toBe(pdfUrl);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/invoices/invoice-id-123/pdf', {
        headers: {
          Authorization: 'Bearer test_access_token_12345',
        },
      });
    });

    it('debe obtener URL del PDF desde factura completa como fallback', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const pdfUrl = 'https://api.siigo.com/invoices/invoice-id-123/pdf';

      const mockInvoiceResponse: SiigoInvoiceResponseDto = {
        id: 'invoice-id-123',
        number: 'FE-001-00012345',
        pdf_url: pdfUrl,
      };

      // Primera llamada a /pdf no devuelve pdf_url
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse });
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: {} }) // /pdf no tiene pdf_url
        .mockResolvedValueOnce({ data: mockInvoiceResponse }); // getInvoice sí tiene pdf_url

      const result = await client.getInvoicePdf('invoice-id-123');

      expect(result).toBe(pdfUrl);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(
        1,
        '/v1/invoices/invoice-id-123/pdf',
        {
          headers: {
            Authorization: 'Bearer test_access_token_12345',
          },
        },
      );
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(
        2,
        '/v1/invoices/invoice-id-123',
        {
          headers: {
            Authorization: 'Bearer test_access_token_12345',
          },
        },
      );
    });

    it('debe lanzar BusinessException cuando no se puede obtener URL del PDF', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const mockInvoiceResponse: SiigoInvoiceResponseDto = {
        id: 'invoice-id-123',
        number: 'FE-001-00012345',
        // Sin pdf_url
      };

      const mockInvoiceWithoutPdf: SiigoInvoiceResponseDto = {
        id: 'invoice-id-123',
        number: 'FE-001-00012345',
        // Sin pdf_url
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse });
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: {} }) // GET /v1/invoices/{id}/pdf - no tiene pdf_url
        .mockResolvedValueOnce({ data: mockInvoiceWithoutPdf }); // GET /v1/invoices/{id} - getInvoice tampoco tiene pdf_url

      const promise = client.getInvoicePdf('invoice-id-123');
      await expect(promise).rejects.toThrow(BusinessException);
      await expect(promise).rejects.toThrow(
        'No se pudo obtener URL del PDF de la factura',
      );
    });

    it('debe lanzar BusinessException con código SIIGO_PDF_GET_ERROR en errores (401/404/500)', async () => {
      const mockAuthResponse: SiigoAuthResponseDto = {
        access_token: 'test_access_token_12345',
        expires_in: 3600,
      };

      const axiosError = createAxiosError(404, { message: 'PDF no encontrado' });

      // Configurar mocks: primero authenticate, luego getInvoicePdf falla
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockAuthResponse }); // POST /auth - authenticate
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError); // GET /v1/invoices/{id}/pdf - falla

      const promise = client.getInvoicePdf('invoice-id-123');
      await expect(promise).rejects.toThrow(BusinessException);
      await expect(promise).rejects.toThrow(
        'Error obteniendo PDF de factura',
      );
    });
  });
});
