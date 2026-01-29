import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SiigoApiClient } from '../src/invoices/siigo/siigo-api.client';
import { CreateSiigoInvoiceDto } from '../src/invoices/dto/siigo-invoice.dto';

/**
 * Tests de Integración Real con Siigo Sandbox
 * 
 * IMPORTANTE: Estos tests requieren credenciales válidas de Siigo configuradas en .env
 * - SIIGO_USERNAME: Usuario de Siigo
 * - SIIGO_ACCESS_KEY: Access Key de Siigo
 * - SIIGO_API_URL: URL base (opcional, default: https://api.siigo.com)
 * 
 * IDs de configuración opcionales (con valores por defecto):
 * - SIIGO_DOCUMENT_ID, SIIGO_COST_CENTER, SIIGO_SELLER, SIIGO_TAX_ID
 * - SIIGO_PAYMENT_CASH_ID, SIIGO_PAYMENT_CARD_ID
 * - SIIGO_TEST_CUSTOMER_ID: NIT/CC del cliente de prueba
 * 
 * Estos tests hacen llamadas REALES a la API de Siigo.
 * Para ejecutarlos: npm run test:e2e -- siigo-integration.e2e-spec.ts
 * 
 * NOTA: Los tests están marcados con .skip por defecto. Quitar .skip antes de ejecutar.
 */

describe('Siigo Integration (Sandbox)', () => {
  let siigoClient: SiigoApiClient;
  let hasValidCredentials: boolean;
  let createdInvoiceId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        SiigoApiClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => process.env[key] || ''),
          },
        },
      ],
    }).compile();

    siigoClient = module.get<SiigoApiClient>(SiigoApiClient);

    // Verificar si hay credenciales válidas configuradas
    const username = process.env.SIIGO_USERNAME || '';
    const accessKey = process.env.SIIGO_ACCESS_KEY || '';
    
    hasValidCredentials = 
      username.length > 0 && 
      accessKey.length > 20; // Access keys suelen ser largas
  });

  describe('Autenticación', () => {
    it.skip('debe verificar que el cliente está configurado correctamente', () => {
      expect(siigoClient).toBeDefined();
      // La autenticación se ejecuta implícitamente en createInvoice
      // Si las credenciales son inválidas, createInvoice fallará con SIIGO_AUTH_FAILED
    });
  });

  describe('Crear Factura', () => {
    it.skip('debe crear una factura exitosamente con datos válidos', async () => {
      if (!hasValidCredentials) {
        console.log('⏭️  Saltando test: credenciales de Siigo no configuradas');
        return;
      }

      const testCustomerId = process.env.SIIGO_TEST_CUSTOMER_ID;
      if (!testCustomerId) {
        console.log('⏭️  Saltando test: SIIGO_TEST_CUSTOMER_ID no configurado');
        return;
      }

      // Preparar datos de factura usando valores de .env o defaults
      const invoiceData: CreateSiigoInvoiceDto = {
        document: { 
          id: parseInt(process.env.SIIGO_DOCUMENT_ID || '24446', 10) 
        },
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        customer: {
          identification: testCustomerId,
          branch_office: 0,
        },
        cost_center: parseInt(process.env.SIIGO_COST_CENTER || '235', 10),
        seller: parseInt(process.env.SIIGO_SELLER || '629', 10),
        items: [
          {
            code: `TEST-ITEM-${Date.now()}`,
            description: 'Pizza Margarita - Test E2E Siigo',
            quantity: 1,
            price: 15000,
            taxes: [{ 
              id: parseInt(process.env.SIIGO_TAX_ID || '13156', 10), 
              percentage: 19 
            }],
          },
        ],
        payments: [{
          id: parseInt(process.env.SIIGO_PAYMENT_CASH_ID || '5636', 10),
          value: 17850, // 15000 + 19% IVA = 17850
          due_date: new Date().toISOString().split('T')[0],
        }],
      };

      const invoice = await siigoClient.createInvoice(invoiceData);

      expect(invoice).toBeDefined();
      expect(invoice.id).toBeDefined();
      expect(invoice.number).toBeDefined();
      expect(invoice.pdf_url).toBeDefined();
      
      createdInvoiceId = invoice.id; // Guardar para otros tests
    }, 30000);
  });

  describe('Obtener Factura', () => {
    it.skip('debe obtener una factura por ID', async () => {
      if (!hasValidCredentials || !createdInvoiceId) {
        console.log('⏭️  Saltando test: credenciales o factura no disponibles');
        return;
      }

      const invoice = await siigoClient.getInvoice(createdInvoiceId);

      expect(invoice).toBeDefined();
      expect(invoice.id).toBe(createdInvoiceId);
      expect(invoice.number).toBeDefined();
      expect(invoice.status).toBeDefined();
    }, 30000);
  });

  describe('Obtener PDF', () => {
    it.skip('debe obtener URL del PDF de una factura', async () => {
      if (!hasValidCredentials || !createdInvoiceId) {
        console.log('⏭️  Saltando test: credenciales o factura no disponibles');
        return;
      }

      const pdfUrl = await siigoClient.getInvoicePdf(createdInvoiceId);

      expect(pdfUrl).toBeDefined();
      expect(typeof pdfUrl).toBe('string');
      expect(pdfUrl.length).toBeGreaterThan(0);
      expect(pdfUrl).toContain('pdf'); // Debe ser una URL de PDF
    }, 30000);
  });
});