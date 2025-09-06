import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhookController } from './controllers/webhook.controller';
import { WebhookService } from './services/webhook.service';
import { WebhookValidationService } from './services/webhook-validation.service';
import { SqsService } from './services/sqs.service';
import { WebhookWorkerService } from './services/webhook-worker.service';
import { DeadLetterQueueService } from './services/dead-letter-queue.service';
import { IdempotencyService } from './services/idempotency.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent]),
    ConfigModule,
  ],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    WebhookValidationService,
    SqsService,
    WebhookWorkerService,
    DeadLetterQueueService,
    IdempotencyService,
  ],
  exports: [
    WebhookService,
    WebhookValidationService,
    SqsService,
    WebhookWorkerService,
    DeadLetterQueueService,
    IdempotencyService,
  ],
})
export class WebhooksModule {}
