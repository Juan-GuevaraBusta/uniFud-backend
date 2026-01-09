import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { sanitizeForLogging } from '../../common/utils/log-sanitizer.util';

export interface WompiPaymentSource {
  id: string;
  status: string;
  type: string;
  public_data?: {
    bin?: string;
    last_four?: string;
    name?: string;
    exp_month?: string;
    exp_year?: string;
    card_holder?: string;
    exp_year_short?: string;
  };
  customer_email: string;
  created_at: string;
}

export interface WompiTransaction {
  id: string;
  status: string;
  amount_in_cents: number;
  currency: string;
  reference: string;
  customer_email: string;
  payment_method?: {
    type: string;
    payment_source_id?: string;
    extra?: {
      bin?: string;
      name?: string;
      exp_month?: string;
      exp_year?: string;
      card_holder?: string;
      last_four?: string;
      brand?: string;
    };
  };
  status_message?: string;
  created_at?: string;
  finalized_at?: string;
}

export interface WompiWebhookEvent {
  event: {
    id: string;
    type: string;
    created_at: string;
  };
  data: {
    transaction: {
      id: string;
      status: string;
      amount_in_cents: number;
      currency: string;
      reference: string;
      customer_email: string;
      payment_method?: {
        type: string;
        payment_source_id?: string;
      };
      status_message?: string;
      created_at: string;
      finalized_at?: string;
    };
  };
  sent_at: string;
}

@Injectable()
export class WompiClient {
  private readonly logger = new Logger(WompiClient.name);
  private readonly client: AxiosInstance;
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly integritySecret: string;
  private readonly baseURL: string;

  constructor(private readonly configService: ConfigService) {
    this.publicKey = this.configService.get<string>('WOMPI_PUBLIC_KEY') || '';
    this.privateKey = this.configService.get<string>('WOMPI_PRIVATE_KEY') || '';
    this.integritySecret = this.configService.get<string>('WOMPI_INTEGRITY_SECRET') || '';
    this.baseURL = this.configService.get<string>('WOMPI_API_URL') || 'https://production.wompi.co';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.privateKey}`,
      },
    });
  }

  /**
   * Crear Payment Source en Wompi
   * @param token Token de tarjeta generado por Wompi.js en el frontend
   * @param acceptanceToken Token de aceptación de política de privacidad
   * @param acceptPersonalAuth Token de aceptación de tratamiento de datos personales
   * @param customerEmail Email del cliente
   */
  async createPaymentSource(
    token: string,
    acceptanceToken: string,
    acceptPersonalAuth: string,
    customerEmail: string,
  ): Promise<WompiPaymentSource> {
    try {
      this.logger.log(`Creando Payment Source en Wompi para email: ${customerEmail}`);

      const payload = {
        type: 'CARD',
        token,
        customer_email: customerEmail,
        acceptance_token: acceptanceToken,
        accept_personal_auth: acceptPersonalAuth,
      };

      const response = await this.client.post('/v1/payment_sources', payload);

      this.logger.log(`✅ Payment Source creado: ${response.data.data?.id}`);

      return response.data.data || response.data;
    } catch (error: any) {
      this.logger.error(`❌ Error creando Payment Source: ${error.message}`);
      
      if (error.response?.data) {
        this.logger.error(`Detalles del error: ${JSON.stringify(sanitizeForLogging(error.response.data))}`);
      }
      
      throw new BadRequestException(
        error.response?.data?.message || 'Error al crear Payment Source en Wompi'
      );
    }
  }

  /**
   * Crear transacción de pago usando Payment Source
   * @param paymentSourceId ID del Payment Source en Wompi
   * @param amount Monto en pesos colombianos
   * @param reference Referencia única de la transacción (formato UFD-XXX)
   * @param customerEmail Email del cliente
   */
  async createTransaction(
    paymentSourceId: string,
    amount: number,
    reference: string,
    customerEmail: string,
  ): Promise<WompiTransaction> {
    try {
      this.logger.log(`Creando transacción en Wompi para referencia: ${reference}`);

      const payload = {
        amount_in_cents: Math.round(amount * 100), // Convertir a centavos
        currency: 'COP',
        customer_email: customerEmail,
        payment_method: {
          type: 'CARD',
          payment_source_id: paymentSourceId,
        },
        reference,
      };

      const response = await this.client.post('/v1/transactions', payload);

      this.logger.log(`✅ Transacción creada en Wompi: ${response.data.data?.id} - Status: ${response.data.data?.status}`);

      return response.data.data || response.data;
    } catch (error: any) {
      this.logger.error(`❌ Error creando transacción en Wompi: ${error.message}`);
      
      if (error.response?.data) {
        this.logger.error(`Detalles del error: ${JSON.stringify(sanitizeForLogging(error.response.data))}`);
      }
      
      throw new BadRequestException(
        error.response?.data?.message || 'Error al procesar pago con Wompi'
      );
    }
  }

  /**
   * Consultar estado de una transacción
   * @param transactionId ID de la transacción en Wompi
   */
  async getTransaction(transactionId: string): Promise<WompiTransaction> {
    try {
      const response = await this.client.get(`/v1/transactions/${transactionId}`);
      return response.data.data || response.data;
    } catch (error: any) {
      this.logger.error(`❌ Error consultando transacción en Wompi: ${error.message}`);
      throw new BadRequestException('Error al consultar transacción en Wompi');
    }
  }

  /**
   * Verificar firma de webhook usando Integrity Secret
   * Según documentación de Wompi, la firma se genera con SHA256
   * concatenando: reference + amount_in_cents + currency + integrity_secret
   */
  verifyWebhookSignature(payload: WompiWebhookEvent, signature: string): boolean {
    try {
      if (!this.integritySecret) {
        this.logger.warn('⚠️ Integrity Secret no configurado, no se puede verificar firma');
        return false;
      }

      const transaction = payload.data.transaction;
      const concatenated = `${transaction.reference}${transaction.amount_in_cents}${transaction.currency}${this.integritySecret}`;
      
      const hash = crypto
        .createHash('sha256')
        .update(concatenated)
        .digest('hex');

      const isValid = hash === signature;
      
      if (!isValid) {
        this.logger.warn(`⚠️ Firma de webhook inválida. Esperada: ${hash}, Recibida: ${signature}`);
      }

      return isValid;
    } catch (error: any) {
      this.logger.error(`❌ Error verificando firma de webhook: ${error.message}`);
      return false;
    }
  }
}
