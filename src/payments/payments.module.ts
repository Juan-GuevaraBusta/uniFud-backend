import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { WompiClient } from './providers/wompi.client';
import { UserCardsController } from './user-cards.controller';
import { UserCardsService } from './user-cards.service';
import { UserCard } from './entities/user-card.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, UserCard]),
    UsersModule,
  ],
  controllers: [PaymentsController, UserCardsController],
  providers: [
    PaymentsService,
    WompiClient,
    UserCardsService,
  ],
  exports: [PaymentsService, UserCardsService, WompiClient],
})
export class PaymentsModule {}

