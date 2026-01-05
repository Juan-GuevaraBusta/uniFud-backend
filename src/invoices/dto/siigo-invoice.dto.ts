import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsDateString, ValidateNested, IsOptional, IsObject, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para crear factura en Siigo API
 */
export class SiigoDocumentDto {
  @ApiProperty({ description: 'ID del tipo de documento en Siigo', example: 24446 })
  @IsNumber()
  id: number;
}

export class SiigoCustomerDto {
  @ApiProperty({ description: 'Identificación del cliente (NIT/CC)', example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  identification: string;

  @ApiProperty({ description: 'ID de la sucursal', example: 0 })
  @IsNumber()
  branch_office: number;
}

export class SiigoTaxDto {
  @ApiProperty({ description: 'ID del impuesto en Siigo', example: 13156 })
  @IsNumber()
  id: number;

  @ApiProperty({ description: 'Porcentaje del impuesto', example: 19 })
  @IsNumber()
  percentage: number;
}

export class SiigoInvoiceItemDto {
  @ApiProperty({ description: 'Código del item', example: 'ITEM-123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Descripción del item', example: 'Pizza Margarita' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Cantidad', example: 2 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Precio unitario', example: 15000 })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ description: 'Descuento', example: 0 })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiProperty({ description: 'Impuestos', type: [SiigoTaxDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SiigoTaxDto)
  taxes: SiigoTaxDto[];
}

export class SiigoPaymentDto {
  @ApiProperty({ description: 'ID de la forma de pago en Siigo', example: 5636 })
  @IsNumber()
  id: number;

  @ApiProperty({ description: 'Valor del pago', example: 35700 })
  @IsNumber()
  value: number;

  @ApiProperty({ description: 'Fecha de vencimiento (YYYY-MM-DD)', example: '2024-01-15' })
  @IsDateString()
  due_date: string;
}

export class CreateSiigoInvoiceDto {
  @ApiProperty({ description: 'Tipo de documento', type: SiigoDocumentDto })
  @ValidateNested()
  @Type(() => SiigoDocumentDto)
  document: SiigoDocumentDto;

  @ApiProperty({ description: 'Fecha de la factura (YYYY-MM-DD)', example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Datos del cliente', type: SiigoCustomerDto })
  @ValidateNested()
  @Type(() => SiigoCustomerDto)
  customer: SiigoCustomerDto;

  @ApiProperty({ description: 'ID del centro de costos', example: 235 })
  @IsNumber()
  cost_center: number;

  @ApiProperty({ description: 'ID del vendedor', example: 629 })
  @IsNumber()
  seller: number;

  @ApiPropertyOptional({ description: 'Observaciones', example: 'Pedido #ABC-123 - Restaurante XYZ' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiProperty({ description: 'Items de la factura', type: [SiigoInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SiigoInvoiceItemDto)
  items: SiigoInvoiceItemDto[];

  @ApiProperty({ description: 'Formas de pago', type: [SiigoPaymentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SiigoPaymentDto)
  payments: SiigoPaymentDto[];
}

/**
 * DTO para respuesta de autenticación de Siigo
 */
export class SiigoAuthResponseDto {
  @ApiProperty({ description: 'Token de acceso', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiPropertyOptional({ description: 'Tiempo de expiración en segundos', example: 3600 })
  expires_in?: number;
}

/**
 * DTO para respuesta de factura creada en Siigo
 */
export class SiigoInvoiceResponseDto {
  @ApiProperty({ description: 'ID de la factura en Siigo', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'Número de factura', example: 'FE-001-00012345' })
  number?: string;

  @ApiPropertyOptional({ description: 'Prefijo de la factura', example: 'FE' })
  prefix?: string;

  @ApiPropertyOptional({ description: 'URL del PDF de la factura' })
  pdf_url?: string;

  @ApiPropertyOptional({ description: 'URL del XML de la factura' })
  xml_url?: string;

  @ApiPropertyOptional({ description: 'Estado de la factura' })
  status?: string;

  @ApiPropertyOptional({ description: 'Fecha de creación' })
  created_at?: string;
}

