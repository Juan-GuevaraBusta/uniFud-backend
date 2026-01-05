import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceItem } from './entities/invoice.entity';
import { Order } from '../orders/entities/order.entity';
import { SiigoApiClient } from './siigo/siigo-api.client';
import { CreateSiigoInvoiceDto, SiigoInvoiceResponseDto } from './dto/siigo-invoice.dto';
import { ConfigService } from '@nestjs/config';
import { ResourceNotFoundException } from '../common/exceptions/not-found-exception';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  // IDs de configuración de Siigo (pueden venir de variables de entorno)
  private readonly siigoDocumentId: number;
  private readonly siigoCostCenter: number;
  private readonly siigoSeller: number;
  private readonly siigoTaxId: number;
  private readonly siigoPaymentCashId: number;
  private readonly siigoPaymentCardId: number;

  constructor(
    @InjectRepository(Invoice)
    private readonly invoicesRepository: Repository<Invoice>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly siigoClient: SiigoApiClient,
    private readonly configService: ConfigService,
  ) {
    // Obtener IDs de configuración de Siigo desde variables de entorno o usar valores por defecto
    this.siigoDocumentId = parseInt(
      this.configService.get<string>('SIIGO_DOCUMENT_ID') || '24446',
      10,
    );
    this.siigoCostCenter = parseInt(
      this.configService.get<string>('SIIGO_COST_CENTER') || '235',
      10,
    );
    this.siigoSeller = parseInt(
      this.configService.get<string>('SIIGO_SELLER') || '629',
      10,
    );
    this.siigoTaxId = parseInt(
      this.configService.get<string>('SIIGO_TAX_ID') || '13156',
      10,
    );
    this.siigoPaymentCashId = parseInt(
      this.configService.get<string>('SIIGO_PAYMENT_CASH_ID') || '5636',
      10,
    );
    this.siigoPaymentCardId = parseInt(
      this.configService.get<string>('SIIGO_PAYMENT_CARD_ID') || '10462',
      10,
    );
  }

  /**
   * Crear factura automáticamente cuando pedido se completa
   * Si falla la creación en Siigo, loggea el error pero NO falla el pedido
   */
  async createInvoiceFromOrder(orderId: string): Promise<Invoice | null> {
    try {
      this.logger.log(`Creando factura para pedido ${orderId}...`);

      // 1. Obtener pedido con detalles
      const order = await this.ordersRepository.findOne({
        where: { id: orderId },
        relations: ['user', 'restaurant'],
      });

      if (!order) {
        this.logger.error(`Pedido ${orderId} no encontrado`);
        throw new ResourceNotFoundException('Pedido', { id: orderId });
      }

      // 2. Validar que no exista factura previa
      const existingInvoice = await this.invoicesRepository.findOne({
        where: { orderId },
      });

      if (existingInvoice) {
        this.logger.warn(`Factura ya existe para pedido ${orderId}`);
        return existingInvoice;
      }

      // 3. Preparar datos para Siigo
      const invoiceData = this.prepareInvoiceData(order);

      // 4. Enviar a Siigo
      let siigoResponse: SiigoInvoiceResponseDto;
      try {
        siigoResponse = await this.siigoClient.createInvoice(invoiceData);
        this.logger.log(`✅ Factura creada en Siigo: ${siigoResponse.id}`);
      } catch (siigoError: any) {
        // Si falla Siigo, loggear pero NO fallar el pedido
        this.logger.error(
          `❌ Error creando factura en Siigo para pedido ${orderId}: ${siigoError.message}`,
        );
        // Guardar factura con estado 'error' para referencia
        return this.createInvoiceWithError(order, siigoError);
      }

      // 5. Guardar en base de datos
      const invoice = this.invoicesRepository.create({
        orderId: order.id,
        siigoInvoiceId: siigoResponse.id,
        invoiceNumber: siigoResponse.number || `TEMP-${order.numeroOrden}`,
        invoicePrefix: siigoResponse.prefix || 'FE',
        customerName: order.user.nombre || order.user.email,
        customerDocument: this.getCustomerDocument(order),
        customerDocumentType: 'CC',
        customerEmail: order.user.email,
        customerPhone: undefined, // Order no tiene teléfono del cliente directamente
        subtotal: order.subtotal / 100, // Convertir de centavos a pesos
        tax: (order.subtotal * 0.19) / 100, // IVA 19% en pesos
        total: order.total / 100, // Convertir de centavos a pesos
        paymentMethod: this.determinePaymentMethod(order),
        items: this.formatInvoiceItems(order),
        pdfUrl: siigoResponse.pdf_url,
        xmlUrl: siigoResponse.xml_url,
        status: 'sent',
        sentAt: new Date(),
        notes: `Pedido #${order.numeroOrden} - ${order.restaurant.nombre}`,
      });

      await this.invoicesRepository.save(invoice);

      this.logger.log(`✅ Factura creada exitosamente: ${invoice.invoiceNumber}`);

      return invoice;
    } catch (error: any) {
      // Si es ResourceNotFoundException, relanzarla
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }

      // Para otros errores, loggear pero retornar null (no bloquear)
      this.logger.error(`❌ Error inesperado creando factura para pedido ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Preparar datos para Siigo API
   */
  private prepareInvoiceData(order: Order): CreateSiigoInvoiceDto {
    return {
      document: {
        id: this.siigoDocumentId,
      },
      date: new Date().toISOString().split('T')[0],
      customer: {
        identification: this.getCustomerDocument(order),
        branch_office: 0,
      },
      cost_center: this.siigoCostCenter,
      seller: this.siigoSeller,
      observations: `Pedido #${order.numeroOrden} - ${order.restaurant.nombre}`,
      items: order.items.map((item) => ({
        code: `ITEM-${item.dishId.substring(0, 20)}`, // Limitar longitud
        description: this.formatItemDescription(item),
        quantity: item.cantidad,
        price: item.precioUnitario / 100, // Convertir de centavos a pesos
        discount: 0,
        taxes: [
          {
            id: this.siigoTaxId,
            percentage: 19,
          },
        ],
      })),
      payments: [
        {
          id: this.determinePaymentMethod(order) === 'card' 
            ? this.siigoPaymentCardId 
            : this.siigoPaymentCashId,
          value: order.total / 100, // Convertir de centavos a pesos
          due_date: new Date().toISOString().split('T')[0],
        },
      ],
    };
  }

  /**
   * Formatear items para guardar en BD
   */
  private formatInvoiceItems(order: Order): InvoiceItem[] {
    return order.items.map((item) => ({
      description: item.dishNombre,
      quantity: item.cantidad,
      unitPrice: item.precioUnitario / 100, // Convertir de centavos a pesos
      tax: (item.precioUnitario * 0.19) / 100, // IVA 19% en pesos
      total: item.precioTotal / 100, // En pesos
    }));
  }

  /**
   * Obtener documento del cliente (del usuario o valor por defecto)
   */
  private getCustomerDocument(order: Order): string {
    // TODO: Agregar campo customerDocument al User entity si es necesario
    // Por ahora usar un valor por defecto o el ID del usuario como fallback
    return '1234567890'; // Valor por defecto - debe configurarse según necesidades
  }

  /**
   * Determinar método de pago basado en el pedido
   * Por ahora asumimos 'card' si el total es mayor a 0, 'cash' como fallback
   */
  private determinePaymentMethod(order: Order): string {
    // Si el pedido tiene un Payment asociado, se puede determinar mejor
    // Por ahora, asumimos 'card' ya que los pedidos se crean después del pago
    return 'card';
  }

  /**
   * Formatear descripción del item incluyendo toppings si existen
   */
  private formatItemDescription(item: Order['items'][0]): string {
    let description = item.dishNombre;

    if (item.toppingsSeleccionados && item.toppingsSeleccionados.length > 0) {
      const toppings = item.toppingsSeleccionados.map((t) => t.nombre).join(', ');
      description += ` (Con: ${toppings})`;
    }

    if (item.toppingsBaseRemocionados && item.toppingsBaseRemocionados.length > 0) {
      const removidos = item.toppingsBaseRemocionados.map((t) => t.nombre).join(', ');
      description += ` (Sin: ${removidos})`;
    }

    if (item.comentarios) {
      description += ` - ${item.comentarios}`;
    }

    return description;
  }

  /**
   * Crear factura con estado 'error' cuando falla Siigo
   */
  private async createInvoiceWithError(order: Order, error: any): Promise<Invoice> {
    const invoice = this.invoicesRepository.create({
      orderId: order.id,
      invoiceNumber: `ERROR-${order.numeroOrden}`,
      invoicePrefix: 'FE',
      customerName: order.user.nombre || order.user.email,
      customerDocument: this.getCustomerDocument(order),
      customerDocumentType: 'CC',
      customerEmail: order.user.email,
      subtotal: order.subtotal / 100,
      tax: (order.subtotal * 0.19) / 100,
      total: order.total / 100,
      paymentMethod: this.determinePaymentMethod(order),
      items: this.formatInvoiceItems(order),
      status: 'error',
      notes: `Error al crear factura en Siigo: ${error.message}`,
    });

    return await this.invoicesRepository.save(invoice);
  }
}

