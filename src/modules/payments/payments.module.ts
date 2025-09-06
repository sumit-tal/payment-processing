import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { 
  Transaction, 
  PaymentMethod, 
  SubscriptionPlan, 
  Subscription, 
  SubscriptionPayment 
} from './entities';
import { 
  PaymentService, 
  AuthorizeNetService, 
  SubscriptionPlanService, 
  SubscriptionService, 
  SubscriptionBillingService 
} from './services';
import { PaymentController } from './controllers';
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
      SubscriptionPayment
    ]),
  ],
  controllers: [
    PaymentController,
    SubscriptionPlanController,
    SubscriptionController,
  ],
  providers: [
    PaymentService, 
    AuthorizeNetService,
    SubscriptionPlanService,
    SubscriptionService,
    SubscriptionBillingService,
  ],
  exports: [
    PaymentService, 
    AuthorizeNetService,
    SubscriptionPlanService,
    SubscriptionService,
    SubscriptionBillingService,
  ],
})
export class PaymentsModule {}
