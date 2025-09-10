import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';
// Note: @nestjs/schedule would be needed for production cron jobs
// For now, we'll implement manual triggers and external scheduling
import { Subscription, SubscriptionStatus } from '@/database/entities/subscription.entity';
import { SubscriptionPayment, SubscriptionPaymentStatus } from '@/database/entities/subscription-payment.entity';
import { Transaction, TransactionType, TransactionStatus } from '@/database/entities/transaction.entity';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from '../dto';
import { PaymentMethodType } from '@/database/entities';

@Injectable()
export class SubscriptionBillingService {
  private readonly logger = new Logger(SubscriptionBillingService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPayment)
    private readonly subscriptionPaymentRepository: Repository<SubscriptionPayment>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Process recurring billing for all active subscriptions
   * Can be called manually or scheduled externally
   */
  async processRecurringBilling(): Promise<void> {
    this.logger.log('Starting recurring billing process');

    try {
      const subscriptionsDue = await this.getSubscriptionsDueForBilling();
      this.logger.log(`Found ${subscriptionsDue.length} subscriptions due for billing`);

      for (const subscription of subscriptionsDue) {
        await this.processSubscriptionBilling(subscription);
      }

      this.logger.log('Completed recurring billing process');
    } catch (error) {
      this.logger.error(`Error in recurring billing process: ${error.message}`, error.stack);
    }
  }

  /**
   * Process retry attempts for failed payments
   * Can be called manually or scheduled externally
   */
  async processFailedPaymentRetries(): Promise<void> {
    this.logger.log('Starting failed payment retry process');

    try {
      const failedPayments = await this.getFailedPaymentsDueForRetry();
      this.logger.log(`Found ${failedPayments.length} failed payments due for retry`);

      for (const payment of failedPayments) {
        await this.retryFailedPayment(payment);
      }

      this.logger.log('Completed failed payment retry process');
    } catch (error) {
      this.logger.error(`Error in failed payment retry process: ${error.message}`, error.stack);
    }
  }

  /**
   * Get subscriptions due for billing
   */
  private async getSubscriptionsDueForBilling(): Promise<Subscription[]> {
    const now = new Date();
    
    return await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: LessThanOrEqual(now),
      },
      relations: ['subscriptionPlan', 'paymentMethod'],
    });
  }

  /**
   * Get failed payments due for retry
   */
  private async getFailedPaymentsDueForRetry(): Promise<SubscriptionPayment[]> {
    const now = new Date();
    
    return await this.subscriptionPaymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.subscription', 'subscription')
      .leftJoinAndSelect('subscription.subscriptionPlan', 'plan')
      .leftJoinAndSelect('subscription.paymentMethod', 'paymentMethod')
      .where('payment.status IN (:...statuses)', { 
        statuses: [SubscriptionPaymentStatus.FAILED, SubscriptionPaymentStatus.RETRYING] 
      })
      .andWhere('payment.retryCount < payment.maxRetryAttempts')
      .andWhere('(payment.nextRetryDate IS NULL OR payment.nextRetryDate <= :now)', { now })
      .getMany();
  }

  /**
   * Process billing for a specific subscription
   */
  private async processSubscriptionBilling(subscription: Subscription): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Processing billing for subscription: ${subscription.id}`);

      // Create subscription payment record
      const subscriptionPayment = this.subscriptionPaymentRepository.create({
        subscriptionId: subscription.id,
        amount: subscription.subscriptionPlan.amount,
        currency: subscription.subscriptionPlan.currency,
        billingDate: new Date(),
        billingCycleNumber: subscription.billingCycleCount + 1,
        status: SubscriptionPaymentStatus.PENDING,
      });

      const savedPayment = await queryRunner.manager.save(subscriptionPayment);

      try {
        // Process the payment
        const paymentResult = await this.processSubscriptionPayment(subscription, savedPayment);

        if (paymentResult.success) {
          // Update subscription payment as completed
          savedPayment.status = SubscriptionPaymentStatus.COMPLETED;
          savedPayment.transactionId = paymentResult.transactionId;
          savedPayment.processedAt = new Date();
          await queryRunner.manager.save(savedPayment);

          // Update subscription
          await this.updateSubscriptionAfterSuccessfulPayment(subscription, queryRunner);

          this.logger.log(`Successfully processed billing for subscription: ${subscription.id}`);
        } else {
          // Handle payment failure
          await this.handlePaymentFailure(savedPayment, paymentResult.errorMessage, queryRunner);
          this.logger.warn(`Payment failed for subscription: ${subscription.id} - ${paymentResult.errorMessage}`);
        }
      } catch (paymentError) {
        // Handle payment processing error
        await this.handlePaymentFailure(savedPayment, paymentError.message, queryRunner);
        this.logger.error(`Payment processing error for subscription: ${subscription.id}`, paymentError.stack);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process billing for subscription: ${subscription.id}`, error.stack);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process payment for subscription
   */
  private async processSubscriptionPayment(
    subscription: Subscription,
    subscriptionPayment: SubscriptionPayment,
  ): Promise<{ success: boolean; transactionId?: string; errorMessage?: string }> {
    const paymentDto: CreatePaymentDto = {
      amount: subscription.subscriptionPlan.amount,
      currency: subscription.subscriptionPlan.currency,
      paymentMethod: PaymentMethodType.CREDIT_CARD,
      customerId: subscription.customerId,
      description: `Subscription payment for ${subscription.subscriptionPlan.name}`,
      idempotencyKey: `sub_${subscription.id}_cycle_${subscriptionPayment.billingCycleNumber}_${Date.now()}`,
      metadata: {
        subscriptionId: subscription.id,
        subscriptionPaymentId: subscriptionPayment.id,
        billingCycle: subscriptionPayment.billingCycleNumber,
      },
      // Note: In a real implementation, you would use stored payment method
      // For now, this assumes the payment method has stored gateway information
      creditCard: {
        // This would be retrieved from stored payment method
        cardNumber: 'stored', // Placeholder - use stored payment method
        cardholderName: 'Customer Name',
        expiryMonth: 12,
        expiryYear: 2025,
        cvv: '123',
        billingAddress: {
          firstName: 'Customer',
          lastName: 'Name',
          address: '123 Main St',
          city: 'City',
          state: 'ST',
          zip: '12345',
          country: 'US',
        },
      },
    };

    try {
      const paymentResponse = await this.paymentService.createPurchase(paymentDto);
      
      if (paymentResponse.status === TransactionStatus.COMPLETED) {
        return { success: true, transactionId: paymentResponse.transactionId };
      } else {
        return { success: false, errorMessage: 'Payment failed' };
      }
    } catch (error) {
      return { success: false, errorMessage: error.message };
    }
  }

  /**
   * Update subscription after successful payment
   */
  private async updateSubscriptionAfterSuccessfulPayment(
    subscription: Subscription,
    queryRunner: any,
  ): Promise<void> {
    // Calculate next billing date
    const nextBillingDate = this.calculateNextBillingDate(
      subscription.nextBillingDate,
      subscription.subscriptionPlan.billingInterval,
      subscription.subscriptionPlan.billingIntervalCount,
    );

    // Update subscription
    subscription.billingCycleCount += 1;
    subscription.failedPaymentCount = 0; // Reset failed payment count
    subscription.lastPaymentDate = new Date();
    subscription.lastPaymentAmount = subscription.subscriptionPlan.amount;
    subscription.currentPeriodStart = subscription.nextBillingDate;
    subscription.currentPeriodEnd = nextBillingDate;
    subscription.nextBillingDate = nextBillingDate;

    // Check if subscription should end (max billing cycles reached)
    if (subscription.subscriptionPlan.maxBillingCycles && 
        subscription.billingCycleCount >= subscription.subscriptionPlan.maxBillingCycles) {
      subscription.status = SubscriptionStatus.EXPIRED;
      subscription.endedAt = new Date();
    }

    await queryRunner.manager.save(subscription);
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailure(
    subscriptionPayment: SubscriptionPayment,
    errorMessage: string,
    queryRunner: any,
  ): Promise<void> {
    subscriptionPayment.status = SubscriptionPaymentStatus.FAILED;
    subscriptionPayment.failureReason = errorMessage;
    subscriptionPayment.processedAt = new Date();

    // Schedule retry if within retry limits
    if (subscriptionPayment.retryCount < subscriptionPayment.maxRetryAttempts) {
      subscriptionPayment.status = SubscriptionPaymentStatus.RETRYING;
      subscriptionPayment.nextRetryDate = this.calculateRetryDate(subscriptionPayment.retryCount);
    }

    await queryRunner.manager.save(subscriptionPayment);

    // Update subscription failed payment count
    const subscription = await queryRunner.manager.findOne(Subscription, {
      where: { id: subscriptionPayment.subscriptionId },
    });

    if (subscription) {
      subscription.failedPaymentCount += 1;

      // Mark subscription as past due if too many failures
      if (subscription.failedPaymentCount >= 3) {
        subscription.status = SubscriptionStatus.PAST_DUE;
      }

      await queryRunner.manager.save(subscription);
    }
  }

  /**
   * Retry failed payment
   */
  private async retryFailedPayment(subscriptionPayment: SubscriptionPayment): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Retrying failed payment: ${subscriptionPayment.id} (attempt ${subscriptionPayment.retryCount + 1})`);

      subscriptionPayment.retryCount += 1;
      subscriptionPayment.status = SubscriptionPaymentStatus.PROCESSING;
      await queryRunner.manager.save(subscriptionPayment);

      // Process the payment
      const paymentResult = await this.processSubscriptionPayment(
        subscriptionPayment.subscription,
        subscriptionPayment,
      );

      if (paymentResult.success) {
        // Update as completed
        subscriptionPayment.status = SubscriptionPaymentStatus.COMPLETED;
        subscriptionPayment.transactionId = paymentResult.transactionId;
        subscriptionPayment.processedAt = new Date();
        subscriptionPayment.nextRetryDate = null;
        await queryRunner.manager.save(subscriptionPayment);

        // Update subscription
        await this.updateSubscriptionAfterSuccessfulPayment(subscriptionPayment.subscription, queryRunner);

        this.logger.log(`Successfully retried payment: ${subscriptionPayment.id}`);
      } else {
        // Handle retry failure
        if (subscriptionPayment.retryCount >= subscriptionPayment.maxRetryAttempts) {
          subscriptionPayment.status = SubscriptionPaymentStatus.FAILED;
          subscriptionPayment.nextRetryDate = null;
        } else {
          subscriptionPayment.status = SubscriptionPaymentStatus.RETRYING;
          subscriptionPayment.nextRetryDate = this.calculateRetryDate(subscriptionPayment.retryCount);
        }
        
        subscriptionPayment.failureReason = paymentResult.errorMessage;
        await queryRunner.manager.save(subscriptionPayment);

        this.logger.warn(`Retry failed for payment: ${subscriptionPayment.id} - ${paymentResult.errorMessage}`);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error retrying payment: ${subscriptionPayment.id}`, error.stack);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Calculate next billing date based on interval
   */
  private calculateNextBillingDate(currentDate: Date, interval: string, count: number): Date {
    const nextDate = new Date(currentDate);
    
    switch (interval) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + count);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (count * 7));
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + count);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + (count * 3));
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + count);
        break;
    }
    
    return nextDate;
  }

  /**
   * Calculate retry date with exponential backoff
   */
  private calculateRetryDate(retryCount: number): Date {
    const baseDelayMinutes = 30; // Start with 30 minutes
    const delayMinutes = baseDelayMinutes * Math.pow(2, retryCount); // Exponential backoff
    const maxDelayMinutes = 24 * 60; // Max 24 hours
    
    const actualDelayMinutes = Math.min(delayMinutes, maxDelayMinutes);
    const retryDate = new Date();
    retryDate.setMinutes(retryDate.getMinutes() + actualDelayMinutes);
    
    return retryDate;
  }

  /**
   * Manual trigger for processing specific subscription billing
   */
  async processSubscriptionBillingManual(subscriptionId: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: ['subscriptionPlan', 'paymentMethod'],
    });

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    await this.processSubscriptionBilling(subscription);
  }
}
