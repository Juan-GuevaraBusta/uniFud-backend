import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { WompiWebhookEvent } from './providers/wompi.client';

@ApiTags('Pagos')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook para recibir eventos de Wompi' })
  @ApiHeader({
    name: 'x-signature',
    description: 'Firma de integridad del webhook',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook procesado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Firma inválida o datos incorrectos',
  })
  async handleWebhook(
    @Body() event: WompiWebhookEvent,
    @Headers('x-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Recibido webhook de Wompi: ${event.event?.type || 'unknown'}`);

    try {
      // Si no hay firma, intentar procesar igual (para desarrollo)
      // En producción, siempre debe haber firma
      if (!signature) {
        this.logger.warn('⚠️ Webhook recibido sin firma');
      }

      await this.paymentsService.handleWebhook(event, signature || '');

      return { received: true };
    } catch (error: any) {
      this.logger.error(`❌ Error procesando webhook: ${error.message}`);
      throw error;
    }
  }
}

