import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { CreateSiigoInvoiceDto, SiigoInvoiceResponseDto, SiigoAuthResponseDto } from '../dto/siigo-invoice.dto';
import { DEFAULT_SIIGO_CONFIG } from './siigo-config';
import { BusinessException } from '../../common/exceptions/business-exception';

@Injectable()
export class SiigoApiClient {
  private readonly logger = new Logger(SiigoApiClient.name);
  private readonly client: AxiosInstance;
  private readonly baseURL: string;
  private readonly username: string;
  private readonly accessKey: string;
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;

  constructor(private readonly configService: ConfigService) {
    this.baseURL = this.configService.get<string>('SIIGO_API_URL') || DEFAULT_SIIGO_CONFIG.baseURL!;
    this.username = this.configService.get<string>('SIIGO_USERNAME') || '';
    this.accessKey = this.configService.get<string>('SIIGO_ACCESS_KEY') || '';

    if (!this.username || !this.accessKey) {
      this.logger.warn('⚠️ SIIGO_USERNAME o SIIGO_ACCESS_KEY no están configurados');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: DEFAULT_SIIGO_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Autenticación OAuth 2.0 con Siigo
   * Obtiene un token de acceso usando username y access_key
   */
  private async authenticate(): Promise<void> {
    try {
      this.logger.log('Autenticando con Siigo API...');

      if (!this.username || !this.accessKey) {
        throw new BusinessException(
          'Credenciales de Siigo no configuradas',
          'SIIGO_CREDENTIALS_MISSING',
        );
      }

      const response = await this.client.post<SiigoAuthResponseDto>('/auth', {
        username: this.username,
        access_key: this.accessKey,
      });

      this.accessToken = response.data.access_token;
      
      // Token expira en 1 hora por defecto, o según lo que devuelva Siigo
      const expiresIn = response.data.expires_in || 3600; // 3600 segundos = 1 hora
      // Renovar 5 minutos antes de que expire
      const bufferMinutes = 5;
      this.tokenExpiration = new Date(Date.now() + (expiresIn - bufferMinutes * 60) * 1000);
      
      this.logger.log('✅ Autenticación con Siigo exitosa');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string; errors?: any[] }>;
        const errorMessage = axiosError.response?.data?.message || axiosError.message;
        const statusCode = axiosError.response?.status;

        this.logger.error(`❌ Error autenticando con Siigo (${statusCode}): ${errorMessage}`);
        
        if (statusCode === 401) {
          throw new BusinessException(
            'Credenciales de Siigo inválidas',
            'SIIGO_AUTH_FAILED',
          );
        }

        throw new BusinessException(
          `Error de autenticación con Siigo: ${errorMessage}`,
          'SIIGO_AUTH_ERROR',
          { statusCode, response: axiosError.response?.data },
        );
      }

      this.logger.error('❌ Error autenticando con Siigo:', error);
      throw error;
    }
  }

  /**
   * Verificar si el token es válido
   */
  private isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiration) {
      return false;
    }
    // Considerar válido si no ha expirado (con buffer de 5 minutos)
    return new Date() < this.tokenExpiration;
  }

  /**
   * Obtener token válido (renovar si es necesario)
   */
  private async getValidToken(): Promise<string> {
    if (!this.isTokenValid()) {
      await this.authenticate();
    }
    if (!this.accessToken) {
      throw new BusinessException(
        'No se pudo obtener token de Siigo',
        'SIIGO_TOKEN_ERROR',
      );
    }
    return this.accessToken;
  }

  /**
   * Crear factura electrónica en Siigo
   */
  async createInvoice(invoiceData: CreateSiigoInvoiceDto): Promise<SiigoInvoiceResponseDto> {
    try {
      const token = await this.getValidToken();

      this.logger.log('Creando factura en Siigo...');

      const response = await this.client.post<SiigoInvoiceResponseDto>(
        '/v1/invoices',
        invoiceData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      this.logger.log(`✅ Factura creada en Siigo: ${response.data.id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string; errors?: any[] }>;
        const errorMessage = axiosError.response?.data?.message || axiosError.message;
        const statusCode = axiosError.response?.status;

        this.logger.error(`❌ Error creando factura en Siigo (${statusCode}): ${errorMessage}`);
        
        if (axiosError.response?.data?.errors) {
          this.logger.error('Errores de validación:', axiosError.response.data.errors);
        }

        if (statusCode === 401) {
          // Token expirado, intentar reautenticar una vez
          this.accessToken = null;
          this.tokenExpiration = null;
          try {
            return await this.createInvoice(invoiceData);
          } catch (retryError) {
            throw new BusinessException(
              'Error de autenticación con Siigo al crear factura',
              'SIIGO_AUTH_FAILED',
            );
          }
        }

        throw new BusinessException(
          `Error creando factura en Siigo: ${errorMessage}`,
          'SIIGO_INVOICE_CREATION_ERROR',
          { statusCode, errors: axiosError.response?.data?.errors },
        );
      }

      this.logger.error('❌ Error creando factura en Siigo:', error);
      throw error;
    }
  }

  /**
   * Obtener factura por ID
   */
  async getInvoice(invoiceId: string): Promise<SiigoInvoiceResponseDto> {
    try {
      const token = await this.getValidToken();

      const response = await this.client.get<SiigoInvoiceResponseDto>(
        `/v1/invoices/${invoiceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        const errorMessage = axiosError.response?.data?.message || axiosError.message;
        const statusCode = axiosError.response?.status;

        this.logger.error(`❌ Error obteniendo factura de Siigo (${statusCode}): ${errorMessage}`);

        if (statusCode === 404) {
          throw new BusinessException(
            `Factura ${invoiceId} no encontrada en Siigo`,
            'SIIGO_INVOICE_NOT_FOUND',
          );
        }

        throw new BusinessException(
          `Error obteniendo factura de Siigo: ${errorMessage}`,
          'SIIGO_INVOICE_GET_ERROR',
          { statusCode },
        );
      }

      this.logger.error('❌ Error obteniendo factura de Siigo:', error);
      throw error;
    }
  }

  /**
   * Obtener PDF de factura
   */
  async getInvoicePdf(invoiceId: string): Promise<string> {
    try {
      const token = await this.getValidToken();

      const response = await this.client.get<{ pdf_url?: string }>(
        `/v1/invoices/${invoiceId}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.pdf_url) {
        return response.data.pdf_url;
      }

      // Si la respuesta es diferente, intentar obtener la URL del invoice completo
      const invoice = await this.getInvoice(invoiceId);
      if (invoice.pdf_url) {
        return invoice.pdf_url;
      }

      throw new BusinessException(
        'No se pudo obtener URL del PDF de la factura',
        'SIIGO_PDF_URL_NOT_FOUND',
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        const errorMessage = axiosError.response?.data?.message || axiosError.message;
        const statusCode = axiosError.response?.status;

        this.logger.error(`❌ Error obteniendo PDF de Siigo (${statusCode}): ${errorMessage}`);

        throw new BusinessException(
          `Error obteniendo PDF de factura: ${errorMessage}`,
          'SIIGO_PDF_GET_ERROR',
          { statusCode },
        );
      }

      this.logger.error('❌ Error obteniendo PDF de Siigo:', error);
      throw error;
    }
  }
}

