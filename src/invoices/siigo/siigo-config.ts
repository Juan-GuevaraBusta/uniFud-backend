/**
 * Configuración para integración con Siigo API
 * 
 * Las variables de entorno deben estar configuradas en el archivo .env:
 * - SIIGO_API_URL: URL base de la API de Siigo (default: https://api.siigo.com)
 * - SIIGO_USERNAME: Usuario de Siigo
 * - SIIGO_ACCESS_KEY: Access Key de Siigo
 */

export interface SiigoConfig {
  baseURL: string;
  username: string;
  accessKey: string;
  timeout: number;
}

export const DEFAULT_SIIGO_CONFIG: Partial<SiigoConfig> = {
  baseURL: 'https://api.siigo.com',
  timeout: 30000, // 30 segundos
};

