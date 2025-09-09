import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as AuthorizeNet from 'authorizenet';
import {
  Subscription,
  SubscriptionStatus,
} from '@/database/entities/subscription.entity';
import {
  SubscriptionPlan,
  BillingInterval,
} from '@/database/entities/subscription-plan.entity';
import { PaymentMethod } from '@/database/entities/payment-method.entity';
import {
  SubscriptionPayment,
  SubscriptionPaymentStatus,
} from '@/database/entities/subscription-payment.entity';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CancelSubscriptionDto,
} from '../dto/subscription.dto';
import { SubscriptionPlanService } from './subscription-plan.service';

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  gatewaySubscriptionId?: string;
  errorMessage?: string;
  rawResponse?: any;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly apiContracts: typeof AuthorizeNet.APIContracts;
  private readonly apiControllers: typeof AuthorizeNet.APIControllers;
  private readonly config: {
    apiLoginId: string;
    transactionKey: string;
    environment: 'sandbox' | 'production';
  };

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepository: Repository<SubscriptionPlan>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(SubscriptionPayment)
    private readonly subscriptionPaymentRepository: Repository<SubscriptionPayment>,
    private readonly subscriptionPlanService: SubscriptionPlanService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.apiContracts = AuthorizeNet.APIContracts;
    this.apiControllers = AuthorizeNet.APIControllers;

    this.config = {
      apiLoginId: this.configService.get<string>('AUTHORIZENET_API_LOGIN_ID'),
      transactionKey: this.configService.get<string>(
        'AUTHORIZENET_TRANSACTION_KEY',
      ),
      environment: this.configService.get<string>(
        'AUTHORIZENET_ENVIRONMENT',
      ) as 'sandbox' | 'production',
    };

    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.apiLoginId || !this.config.transactionKey) {
      throw new Error('Authorize.Net API credentials are required');
    }
  }

  private createMerchantAuth(): any {
    const merchantAuthenticationType =
      new this.apiContracts.MerchantAuthenticationType();
    merchantAuthenticationType.setName(this.config.apiLoginId);
    merchantAuthenticationType.setTransactionKey(this.config.transactionKey);
    return merchantAuthenticationType;
  }

  private mapBillingIntervalToAuthorizeNet(
    interval: BillingInterval,
    count: number,
  ): any {
    const paymentScheduleInterval =
      new this.apiContracts.PaymentScheduleType.Interval();

    switch (interval) {
      case BillingInterval.DAILY:
        paymentScheduleInterval.setLength(count);
        paymentScheduleInterval.setUnit(
          this.apiContracts.ARBSubscriptionUnitEnum.DAYS,
        );
        break;
      case BillingInterval.WEEKLY:
        paymentScheduleInterval.setLength(count * 7);
        paymentScheduleInterval.setUnit(
          this.apiContracts.ARBSubscriptionUnitEnum.DAYS,
        );
        break;
      case BillingInterval.MONTHLY:
        paymentScheduleInterval.setLength(count);
        paymentScheduleInterval.setUnit(
          this.apiContracts.ARBSubscriptionUnitEnum.MONTHS,
        );
        break;
      case BillingInterval.QUARTERLY:
        paymentScheduleInterval.setLength(count * 3);
        paymentScheduleInterval.setUnit(
          this.apiContracts.ARBSubscriptionUnitEnum.MONTHS,
        );
        break;
      case BillingInterval.YEARLY:
        paymentScheduleInterval.setLength(count * 12);
        paymentScheduleInterval.setUnit(
          this.apiContracts.ARBSubscriptionUnitEnum.MONTHS,
        );
        break;
      default:
        throw new BadRequestException(
          `Unsupported billing interval: ${interval}`,
        );
    }

    return paymentScheduleInterval;
  }

  private calculateNextBillingDate(
    startDate: Date,
    interval: BillingInterval,
    count: number,
  ): Date {
    const nextDate = new Date(startDate);

    switch (interval) {
      case BillingInterval.DAILY:
        nextDate.setDate(nextDate.getDate() + count);
        break;
      case BillingInterval.WEEKLY:
        nextDate.setDate(nextDate.getDate() + count * 7);
        break;
      case BillingInterval.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + count);
        break;
      case BillingInterval.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + count * 3);
        break;
      case BillingInterval.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + count);
        break;
    }

    return nextDate;
  }

  private executeARBRequest(request: any): Promise<SubscriptionResult> {
    return new Promise(resolve => {
      const ctrl = new this.apiControllers.ARBCreateSubscriptionController(
        request.getJSON(),
      );

      if (this.config.environment === 'sandbox') {
        ctrl.setEnvironment(AuthorizeNet.Constants.endpoint.sandbox);
      } else {
        ctrl.setEnvironment(AuthorizeNet.Constants.endpoint.production);
      }

      ctrl.execute(() => {
        const apiResponse = ctrl.getResponse();
        const response = new this.apiContracts.ARBCreateSubscriptionResponse(
          apiResponse,
        );

        this.logger.debug('Authorize.Net ARB Response', {
          response: apiResponse,
        });

        if (
          response.getMessages().getResultCode() ===
          this.apiContracts.MessageTypeEnum.OK
        ) {
          resolve({
            success: true,
            gatewaySubscriptionId: response.getSubscriptionId(),
            rawResponse: apiResponse,
          });
        } else {
          const errorMessage = response.getMessages().getMessage()[0].getText();
          resolve({
            success: false,
            errorMessage,
            rawResponse: apiResponse,
          });
        }
      });
    });
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    this.logger.log(
      `Creating subscription for customer: ${createSubscriptionDto.customerId}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate subscription plan
      const subscriptionPlan = await this.subscriptionPlanService.findPlanById(
        createSubscriptionDto.subscriptionPlanId,
      );
      if (
        !(await this.subscriptionPlanService.isPlanAvailable(
          subscriptionPlan.id,
        ))
      ) {
        throw new BadRequestException('Subscription plan is not available');
      }

      // Validate payment method
      const paymentMethod = await this.paymentMethodRepository.findOne({
        where: {
          id: createSubscriptionDto.paymentMethodId,
          customerId: createSubscriptionDto.customerId,
          isActive: true,
        },
      });

      if (!paymentMethod) {
        throw new NotFoundException('Payment method not found or not active');
      }

      // Calculate subscription dates
      const startDate = createSubscriptionDto.startDate
        ? new Date(createSubscriptionDto.startDate)
        : new Date();
      const trialEnd = createSubscriptionDto.trialEnd
        ? new Date(createSubscriptionDto.trialEnd)
        : subscriptionPlan.trialPeriodDays
          ? new Date(
              startDate.getTime() +
                subscriptionPlan.trialPeriodDays * 24 * 60 * 60 * 1000,
            )
          : null;

      const billingStartDate = trialEnd || startDate;
      const nextBillingDate = this.calculateNextBillingDate(
        billingStartDate,
        subscriptionPlan.billingInterval,
        subscriptionPlan.billingIntervalCount,
      );
      const currentPeriodEnd = new Date(nextBillingDate);

      // Create Authorize.Net ARB subscription
      const arbResult = await this.createARBSubscription(
        subscriptionPlan,
        paymentMethod,
        billingStartDate,
      );

      if (!arbResult.success) {
        throw new BadRequestException(
          `Failed to create subscription: ${arbResult.errorMessage}`,
        );
      }

      // Create subscription record
      const subscription = new Subscription({
        customerId: createSubscriptionDto.customerId,
        subscriptionPlanId: subscriptionPlan.id,
        paymentMethodId: paymentMethod.id,
        gatewaySubscriptionId: arbResult.gatewaySubscriptionId,
        status: trialEnd ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
        currentPeriodStart: startDate,
        currentPeriodEnd,
        nextBillingDate,
        trialStart: trialEnd ? startDate : null,
        trialEnd,
        billingCycleCount: 0,
        failedPaymentCount: 0,
        metadata: createSubscriptionDto.metadata,
        gatewayResponse: arbResult.rawResponse,
      });

      const savedSubscription = await queryRunner.manager.save(subscription);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Successfully created subscription with ID: ${savedSubscription.id}`,
      );
      return savedSubscription;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create subscription: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async createARBSubscription(
    plan: SubscriptionPlan,
    paymentMethod: PaymentMethod,
    startDate: Date,
  ): Promise<SubscriptionResult> {
    const merchantAuthenticationType = this.createMerchantAuth();

    // Create payment schedule
    const interval = this.mapBillingIntervalToAuthorizeNet(
      plan.billingInterval,
      plan.billingIntervalCount,
    );
    const paymentSchedule = new this.apiContracts.PaymentScheduleType();
    paymentSchedule.setInterval(interval);
    paymentSchedule.setStartDate(startDate.toISOString().split('T')[0]);

    if (plan.maxBillingCycles) {
      paymentSchedule.setTotalOccurrences(plan.maxBillingCycles);
    } else {
      paymentSchedule.setTotalOccurrences(9999); // Authorize.Net max for unlimited
    }

    // Create subscription
    const arbSubscription = new this.apiContracts.ARBSubscriptionType();
    arbSubscription.setName(plan.name);
    arbSubscription.setPaymentSchedule(paymentSchedule);
    arbSubscription.setAmount(plan.amount);

    // Set payment method (split the combined ID format: customerProfileId|customerPaymentProfileId)
    const [customerProfileId, customerPaymentProfileId] =
      paymentMethod.gatewayPaymentMethodId.split('|');

    if (!customerProfileId || !customerPaymentProfileId) {
      throw new BadRequestException('Invalid payment method ID format');
    }

    const profile = new this.apiContracts.CustomerProfileIdType();
    profile.setCustomerProfileId(customerProfileId);
    profile.setCustomerPaymentProfileId(customerPaymentProfileId);
    arbSubscription.setProfile(profile);

    const request = new this.apiContracts.ARBCreateSubscriptionRequest();
    request.setMerchantAuthentication(merchantAuthenticationType);
    request.setSubscription(arbSubscription);

    return await this.executeARBRequest(request);
  }

  /**
   * Get subscription by ID with relations
   */
  async findSubscriptionById(id: string): Promise<Subscription> {
    this.logger.log(`Retrieving subscription with ID: ${id}`);

    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
      relations: ['subscriptionPlan', 'paymentMethod'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    return subscription;
  }

  /**
   * Get subscriptions by customer ID
   */
  async findSubscriptionsByCustomer(
    customerId: string,
  ): Promise<Subscription[]> {
    this.logger.log(`Retrieving subscriptions for customer: ${customerId}`);

    return await this.subscriptionRepository.find({
      where: { customerId },
      relations: ['subscriptionPlan', 'paymentMethod'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    id: string,
    updateSubscriptionDto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    this.logger.log(`Updating subscription with ID: ${id}`);

    const subscription = await this.findSubscriptionById(id);

    // Update allowed fields
    if (updateSubscriptionDto.paymentMethodId) {
      const paymentMethod = await this.paymentMethodRepository.findOne({
        where: {
          id: updateSubscriptionDto.paymentMethodId,
          customerId: subscription.customerId,
          isActive: true,
        },
      });

      if (!paymentMethod) {
        throw new NotFoundException('Payment method not found or not active');
      }

      subscription.paymentMethodId = updateSubscriptionDto.paymentMethodId;
    }

    if (updateSubscriptionDto.status) {
      subscription.status = updateSubscriptionDto.status;
    }

    if (updateSubscriptionDto.metadata) {
      subscription.metadata = {
        ...subscription.metadata,
        ...updateSubscriptionDto.metadata,
      };
    }

    const updatedSubscription =
      await this.subscriptionRepository.save(subscription);

    this.logger.log(`Successfully updated subscription with ID: ${id}`);
    return updatedSubscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    id: string,
    cancelDto: CancelSubscriptionDto,
  ): Promise<Subscription> {
    this.logger.log(`Cancelling subscription with ID: ${id}`);

    const subscription = await this.findSubscriptionById(id);

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    // Cancel in Authorize.Net ARB
    await this.cancelARBSubscription(subscription.gatewaySubscriptionId);

    // Update subscription status
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();

    if (cancelDto.cancelImmediately) {
      subscription.endedAt = new Date();
    } else {
      subscription.endedAt = subscription.currentPeriodEnd;
    }

    if (cancelDto.cancellationReason) {
      subscription.metadata = {
        ...subscription.metadata,
        cancellationReason: cancelDto.cancellationReason,
      };
    }

    const cancelledSubscription =
      await this.subscriptionRepository.save(subscription);

    this.logger.log(`Successfully cancelled subscription with ID: ${id}`);
    return cancelledSubscription;
  }

  private async cancelARBSubscription(
    gatewaySubscriptionId: string,
  ): Promise<void> {
    const merchantAuthenticationType = this.createMerchantAuth();

    const request = new this.apiContracts.ARBCancelSubscriptionRequest();
    request.setMerchantAuthentication(merchantAuthenticationType);
    request.setSubscriptionId(gatewaySubscriptionId);

    return new Promise((resolve, reject) => {
      const ctrl = new this.apiControllers.ARBCancelSubscriptionController(
        request.getJSON(),
      );

      if (this.config.environment === 'sandbox') {
        ctrl.setEnvironment(AuthorizeNet.Constants.endpoint.sandbox);
      } else {
        ctrl.setEnvironment(AuthorizeNet.Constants.endpoint.production);
      }

      ctrl.execute(() => {
        const apiResponse = ctrl.getResponse();
        const response = new this.apiContracts.ARBCancelSubscriptionResponse(
          apiResponse,
        );

        if (
          response.getMessages().getResultCode() ===
          this.apiContracts.MessageTypeEnum.OK
        ) {
          resolve();
        } else {
          const errorMessage = response.getMessages().getMessage()[0].getText();
          reject(
            new BadRequestException(
              `Failed to cancel subscription in gateway: ${errorMessage}`,
            ),
          );
        }
      });
    });
  }

  /**
   * Get active subscriptions due for billing
   */
  async getSubscriptionsDueForBilling(): Promise<Subscription[]> {
    const now = new Date();

    return await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: { $lte: now } as any,
      },
      relations: ['subscriptionPlan', 'paymentMethod'],
    });
  }
}
