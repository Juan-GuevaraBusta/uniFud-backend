import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesService } from './invoice.service';
import { InvoicesController } from './invoice.controller';
import { Invoice } from './entities/invoice.entity';
import { SiigoApiClient } from './siigo/siigo-api.client';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Order]),
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    SiigoApiClient,
  ],
  exports: [InvoicesService, SiigoApiClient],
})
export class InvoicesModule {}

