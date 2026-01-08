import { Controller, Get, Param, HttpCode, HttpStatus, UseInterceptors, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { InvoicesService } from './invoice.service';
import { Invoice } from './entities/invoice.entity';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ForbiddenException } from '@nestjs/common';
import { ResourceNotFoundException } from '../common/exceptions/not-found-exception';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@ApiTags('Facturas')
@Controller('invoices')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    @InjectRepository(Invoice)
    private readonly invoicesRepository: Repository<Invoice>,
  ) {}

  /**
   * Obtener factura por ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener factura por ID',
    description: 'Obtiene los detalles de una factura específica. Requiere autenticación.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la factura (UUID)',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Factura encontrada',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        orderId: 'order-uuid',
        invoiceNumber: 'FE-001234',
        invoicePrefix: 'FE',
        customerName: 'Juan Pérez',
        customerEmail: 'juan@example.com',
        subtotal: 10000,
        tax: 1900,
        total: 11900,
        status: 'sent',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Factura no encontrada',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permiso para acceder a esta factura',
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: any): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id },
      relations: ['order', 'order.user', 'order.restaurant'],
    });

    if (!invoice) {
      throw new ResourceNotFoundException('Factura', { id });
    }

    // Verificar permisos
    if (user.role === UserRole.ADMIN) {
      return invoice;
    }

    if (user.role === UserRole.STUDENT) {
      if (invoice.order?.user?.id !== user.id) {
        throw new ForbiddenException('No tienes acceso a esta factura');
      }
      return invoice;
    }

    // Propietario del restaurante
    if (invoice.order?.restaurant?.ownerId !== user.id) {
      throw new ForbiddenException('No tienes acceso a esta factura');
    }

    return invoice;
  }

  /**
   * Obtener factura por número de pedido
   */
  @Get('order/:orderId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener factura por número de pedido',
    description: 'Obtiene la factura asociada a un pedido específico',
  })
  @ApiParam({
    name: 'orderId',
    description: 'ID del pedido',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Factura encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Factura no encontrada para este pedido',
  })
  async findByOrderId(@Param('orderId') orderId: string, @CurrentUser() user: any): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { orderId },
      relations: ['order', 'order.user', 'order.restaurant'],
    });

    if (!invoice) {
      throw new ResourceNotFoundException('Factura', { orderId });
    }

    // Verificar permisos (misma lógica que findOne)
    if (user.role === UserRole.ADMIN) {
      return invoice;
    }

    if (user.role === UserRole.STUDENT) {
      if (invoice.order?.user?.id !== user.id) {
        throw new ForbiddenException('No tienes acceso a esta factura');
      }
      return invoice;
    }

    if (invoice.order?.restaurant?.ownerId !== user.id) {
      throw new ForbiddenException('No tienes acceso a esta factura');
    }

    return invoice;
  }
}