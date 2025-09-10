import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import {
  Transaction,
  PaymentMethod,
  SubscriptionPlan,
  Subscription,
  SubscriptionPayment,
} from '@/database/entities';
import {
  PaymentService,
  AuthorizeNetService,
  SubscriptionPlanService,
  SubscriptionService,
  SubscriptionBillingService,
  PaymentMethodService,
} from './services';
import { PaymentController } from './controllers';
import { PaymentMethodController } from './controllers/payment-method.controller';
import { SubscriptionPlanController } from './controllers/subscription-plan.controller';
import { SubscriptionController } from './controllers/subscription.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Transaction,
      PaymentMethod,
      SubscriptionPlan,
      Subscription,
      SubscriptionPayment,
    ]),
  ],
  controllers: [
    PaymentController,
    SubscriptionPlanController,
    SubscriptionController,
    PaymentMethodController,
  ],
  providers: [
    PaymentService,
    AuthorizeNetService,
    SubscriptionPlanService,
    SubscriptionService,
    SubscriptionBillingService,
    PaymentMethodService,
  ],
  exports: [
    PaymentService,
    AuthorizeNetService,
    SubscriptionPlanService,
    SubscriptionService,
    SubscriptionBillingService,
    PaymentMethodService,
  ],
})
export class PaymentsModule {}
