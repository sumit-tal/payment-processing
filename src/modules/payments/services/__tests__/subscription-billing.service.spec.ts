import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, LessThanOrEqual } from 'typeorm';
import { Logger } from '@nestjs/common';
import { SubscriptionBillingService } from '../subscription-billing.service';
import { PaymentService } from '../payment.service';
import {
  Subscription,
  SubscriptionStatus,
} from '../../../../database/entities/subscription.entity';
import {
  SubscriptionPayment,
  SubscriptionPaymentStatus,
} from '../../../../database/entities/subscription-payment.entity';
import {
  Transaction,
  TransactionStatus,
  PaymentMethodType,
} from '../../../../database/entities';
import { SubscriptionPlan } from '../../../../database/entities/subscription-plan.entity';
import { PaymentMethod } from '../../../../database/entities/payment-method.entity';

describe('SubscriptionBillingService', () => {
  let service: SubscriptionBillingService;
  let subscriptionRepository: jest.Mocked<Repository<Subscription>>;
  let subscriptionPaymentRepository: jest.Mocked<
    Repository<SubscriptionPayment>
  >;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let paymentService: jest.Mocked<PaymentService>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;

  const mockSubscriptionPlan: SubscriptionPlan = {
    id: 'plan-123',
    name: 'Basic Plan',
    amount: 29.99,
    currency: 'USD',
    billingInterval: 'monthly',
    billingIntervalCount: 1,
    maxBillingCycles: undefined,
    setupFee: 0,
    status: 'active',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as SubscriptionPlan;

  const mockPaymentMethod: PaymentMethod = {
    id: 'pm-123',
    customerId: 'customer-123',
    gatewayPaymentMethodId: 'gateway-pm-123',
    isActive: true,
  } as PaymentMethod;

  const mockSubscription: Subscription = {
    id: 'sub-123',
    customerId: 'customer-123',
    subscriptionPlanId: 'plan-123',
    paymentMethodId: 'pm-123',
    status: SubscriptionStatus.ACTIVE,
    nextBillingDate: new Date('2024-01-15'),
    billingCycleCount: 5,
    failedPaymentCount: 0,
    currentPeriodStart: new Date('2023-12-15'),
    currentPeriodEnd: new Date('2024-01-15'),
    subscriptionPlan: mockSubscriptionPlan,
    paymentMethod: mockPaymentMethod,
  } as Subscription;

  const mockSubscriptionPayment: SubscriptionPayment = {
    id: 'payment-123',
    subscriptionId: 'sub-123',
    amount: 29.99,
    currency: 'USD',
    billingDate: new Date(),
    billingCycleNumber: 6,
    status: SubscriptionPaymentStatus.PENDING,
    retryCount: 0,
    maxRetryAttempts: 3,
    subscription: mockSubscription,
  } as SubscriptionPayment;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
        findOne: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionBillingService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SubscriptionPayment),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: PaymentService,
          useValue: {
            createPurchase: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionBillingService>(
      SubscriptionBillingService,
    );
    subscriptionRepository = module.get(getRepositoryToken(Subscription));
    subscriptionPaymentRepository = module.get(
      getRepositoryToken(SubscriptionPayment),
    );
    transactionRepository = module.get(getRepositoryToken(Transaction));
    paymentService = module.get(PaymentService);
    dataSource = module.get(DataSource);

    // Mock logger to avoid console output during tests
    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  describe('When processing recurring billing', () => {
    it('Then should process all due subscriptions successfully', async () => {
      // Arrange
      const dueSubscriptions = [mockSubscription];
      subscriptionRepository.find.mockResolvedValue(dueSubscriptions);

      const processSubscriptionBillingSpy = jest.spyOn(
        service as any,
        'processSubscriptionBilling',
      );
      processSubscriptionBillingSpy.mockResolvedValue(undefined);

      // Act
      await service.processRecurringBilling();

      // Assert
      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: {
          status: SubscriptionStatus.ACTIVE,
          nextBillingDate: LessThanOrEqual(expect.any(Date)),
        },
        relations: ['subscriptionPlan', 'paymentMethod'],
      });
      expect(processSubscriptionBillingSpy).toHaveBeenCalledWith(
        mockSubscription,
      );
    });

    it('Then should handle errors gracefully and continue processing', async () => {
      // Arrange
      subscriptionRepository.find.mockRejectedValue(
        new Error('Database error'),
      );

      // Act
      await service.processRecurringBilling();

      // Assert
      expect(service['logger'].error).toHaveBeenCalledWith(
        'Error in recurring billing process: Database error',
        expect.any(String),
      );
    });

    it('Then should process empty subscription list without errors', async () => {
      // Arrange
      subscriptionRepository.find.mockResolvedValue([]);

      // Act
      await service.processRecurringBilling();

      // Assert
      expect(subscriptionRepository.find).toHaveBeenCalled();
      expect(service['logger'].log).toHaveBeenCalledWith(
        'Found 0 subscriptions due for billing',
      );
    });
  });

  describe('When calculating next billing date', () => {
    const currentDate = new Date('2024-01-15');

    it('Then should calculate daily billing correctly', () => {
      // Act
      const result = (service as any).calculateNextBillingDate(
        currentDate,
        'daily',
        1,
      );

      // Assert
      expect(result).toEqual(new Date('2024-01-16'));
    });

    it('Then should calculate weekly billing correctly', () => {
      // Act
      const result = (service as any).calculateNextBillingDate(
        currentDate,
        'weekly',
        2,
      );

      // Assert
      expect(result).toEqual(new Date('2024-01-29'));
    });

    it('Then should calculate monthly billing correctly', () => {
      // Act
      const result = (service as any).calculateNextBillingDate(
        currentDate,
        'monthly',
        1,
      );

      // Assert
      expect(result).toEqual(new Date('2024-02-15'));
    });

    it('Then should calculate quarterly billing correctly', () => {
      // Act
      const result = (service as any).calculateNextBillingDate(
        currentDate,
        'quarterly',
        1,
      );

      // Assert
      expect(result).toEqual(new Date('2024-04-15'));
    });

    it('Then should calculate yearly billing correctly', () => {
      // Act
      const result = (service as any).calculateNextBillingDate(
        currentDate,
        'yearly',
        1,
      );

      // Assert
      expect(result).toEqual(new Date('2025-01-15'));
    });

    it('Then should handle multiple interval counts', () => {
      // Act
      const result = (service as any).calculateNextBillingDate(
        currentDate,
        'monthly',
        3,
      );

      // Assert
      expect(result).toEqual(new Date('2024-04-15'));
    });
  });

  describe('When calculating retry date', () => {
    it('Then should calculate exponential backoff correctly', () => {
      // Act
      const result1 = (service as any).calculateRetryDate(0);
      const result2 = (service as any).calculateRetryDate(1);
      const result3 = (service as any).calculateRetryDate(2);

      // Assert
      const now = new Date();
      expect(result1.getTime()).toBeGreaterThan(now.getTime() + 29 * 60 * 1000); // ~30 minutes
      expect(result2.getTime()).toBeGreaterThan(now.getTime() + 59 * 60 * 1000); // ~60 minutes
      expect(result3.getTime()).toBeGreaterThan(
        now.getTime() + 119 * 60 * 1000,
      ); // ~120 minutes
    });

    it('Then should cap retry delay at maximum', () => {
      // Act
      const result = (service as any).calculateRetryDate(10); // Very high retry count

      // Assert
      const now = new Date();
      const maxDelay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      expect(result.getTime()).toBeLessThanOrEqual(
        now.getTime() + maxDelay + 60000,
      ); // Allow 1 minute buffer
    });
  });

  describe('When updating subscription after successful payment', () => {
    it('Then should update subscription fields correctly', async () => {
      // Arrange
      const subscription = { ...mockSubscription };
      const nextBillingDate = new Date('2024-02-15');

      const calculateNextBillingDateSpy = jest.spyOn(
        service as any,
        'calculateNextBillingDate',
      );
      calculateNextBillingDateSpy.mockReturnValue(nextBillingDate);

      // Act
      await (service as any).updateSubscriptionAfterSuccessfulPayment(
        subscription,
        queryRunner,
      );

      // Assert
      expect(subscription.billingCycleCount).toBe(6);
      expect(subscription.failedPaymentCount).toBe(0);
      expect(subscription.lastPaymentDate).toBeInstanceOf(Date);
      expect(subscription.lastPaymentAmount).toBe(29.99);
      expect(subscription.nextBillingDate).toEqual(nextBillingDate);
      expect(queryRunner.manager.save).toHaveBeenCalledWith(subscription);
    });

    it('Then should expire subscription when max billing cycles reached', async () => {
      // Arrange
      const subscription = {
        ...mockSubscription,
        billingCycleCount: 11,
        subscriptionPlan: {
          ...mockSubscriptionPlan,
          maxBillingCycles: 12,
        },
      };

      const calculateNextBillingDateSpy = jest.spyOn(
        service as any,
        'calculateNextBillingDate',
      );
      calculateNextBillingDateSpy.mockReturnValue(new Date('2024-02-15'));

      // Act
      await (service as any).updateSubscriptionAfterSuccessfulPayment(
        subscription,
        queryRunner,
      );

      // Assert
      expect(subscription.status).toBe(SubscriptionStatus.EXPIRED);
      expect(subscription.endedAt).toBeInstanceOf(Date);
    });
  });

  describe('When handling payment failure', () => {
    it('Then should mark payment as failed and schedule retry', async () => {
      // Arrange
      const payment = { ...mockSubscriptionPayment, retryCount: 0 };
      const subscription = { ...mockSubscription, failedPaymentCount: 0 };

      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(
        subscription,
      );
      const calculateRetryDateSpy = jest.spyOn(
        service as any,
        'calculateRetryDate',
      );
      calculateRetryDateSpy.mockReturnValue(new Date('2024-01-16'));

      // Act
      await (service as any).handlePaymentFailure(
        payment,
        'Card declined',
        queryRunner,
      );

      // Assert
      expect(payment.status).toBe(SubscriptionPaymentStatus.RETRYING);
      expect(payment.failureReason).toBe('Card declined');
      expect(payment.nextRetryDate).toBeInstanceOf(Date);
      expect(subscription.failedPaymentCount).toBe(1);
    });

    it('Then should mark payment as permanently failed when retry limit reached', async () => {
      // Arrange
      const payment = {
        ...mockSubscriptionPayment,
        retryCount: 3,
        maxRetryAttempts: 3,
      };
      const subscription = { ...mockSubscription, failedPaymentCount: 2 };

      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(
        subscription,
      );

      // Act
      await (service as any).handlePaymentFailure(
        payment,
        'Card declined',
        queryRunner,
      );

      // Assert
      expect(payment.status).toBe(SubscriptionPaymentStatus.FAILED);
      expect(payment.nextRetryDate).toBeUndefined();
      expect(subscription.status).toBe(SubscriptionStatus.PAST_DUE);
    });
  });

  describe('When retrying failed payment', () => {
    it('Then should successfully retry and update payment', async () => {
      // Arrange
      const failedPayment = {
        ...mockSubscriptionPayment,
        status: SubscriptionPaymentStatus.FAILED,
        retryCount: 1,
        subscription: mockSubscription,
      };

      const processSubscriptionPaymentSpy = jest.spyOn(
        service as any,
        'processSubscriptionPayment',
      );
      processSubscriptionPaymentSpy.mockResolvedValue({
        success: true,
        transactionId: 'retry-txn-123',
      });

      const updateSubscriptionSpy = jest.spyOn(
        service as any,
        'updateSubscriptionAfterSuccessfulPayment',
      );
      updateSubscriptionSpy.mockResolvedValue(undefined);

      // Act
      await (service as any).retryFailedPayment(failedPayment);

      // Assert
      expect(failedPayment.retryCount).toBe(2);
      expect(failedPayment.status).toBe(SubscriptionPaymentStatus.COMPLETED);
      expect(failedPayment.transactionId).toBe('retry-txn-123');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('Then should handle retry failure and schedule next retry', async () => {
      // Arrange
      const failedPayment = {
        ...mockSubscriptionPayment,
        status: SubscriptionPaymentStatus.FAILED,
        retryCount: 1,
        maxRetryAttempts: 3,
        subscription: mockSubscription,
      };

      const processSubscriptionPaymentSpy = jest.spyOn(
        service as any,
        'processSubscriptionPayment',
      );
      processSubscriptionPaymentSpy.mockResolvedValue({
        success: false,
        errorMessage: 'Still declined',
      });

      const calculateRetryDateSpy = jest.spyOn(
        service as any,
        'calculateRetryDate',
      );
      calculateRetryDateSpy.mockReturnValue(new Date('2024-01-17'));

      // Act
      await (service as any).retryFailedPayment(failedPayment);

      // Assert
      expect(failedPayment.retryCount).toBe(2);
      expect(failedPayment.status).toBe(SubscriptionPaymentStatus.RETRYING);
      expect(failedPayment.failureReason).toBe('Still declined');
      expect(failedPayment.nextRetryDate).toBeInstanceOf(Date);
    });

    it('Then should mark as permanently failed when max retries exceeded', async () => {
      // Arrange
      const failedPayment = {
        ...mockSubscriptionPayment,
        status: SubscriptionPaymentStatus.FAILED,
        retryCount: 2,
        maxRetryAttempts: 3,
        subscription: mockSubscription,
      };

      const processSubscriptionPaymentSpy = jest.spyOn(
        service as any,
        'processSubscriptionPayment',
      );
      processSubscriptionPaymentSpy.mockResolvedValue({
        success: false,
        errorMessage: 'Final decline',
      });

      // Act
      await (service as any).retryFailedPayment(failedPayment);

      // Assert
      expect(failedPayment.retryCount).toBe(3);
      expect(failedPayment.status).toBe(SubscriptionPaymentStatus.FAILED);
      expect(failedPayment.nextRetryDate).toBeNull();
    });

    it('Then should rollback transaction on retry error', async () => {
      // Arrange
      const failedPayment = {
        ...mockSubscriptionPayment,
        subscription: mockSubscription,
      };

      (queryRunner.manager.save as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      // Act
      await (service as any).retryFailedPayment(failedPayment);

      // Assert
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('When processing subscription payment with PaymentService', () => {
    it('Then should create payment DTO correctly and process successfully', async () => {
      // Arrange
      paymentService.createPurchase.mockResolvedValue({
        transactionId: 'txn-123',
        status: TransactionStatus.COMPLETED,
        amount: 29.99,
        currency: 'USD',
      } as any);

      // Act
      const result = await (service as any).processSubscriptionPayment(
        mockSubscription,
        mockSubscriptionPayment,
      );

      // Assert
      expect(paymentService.createPurchase).toHaveBeenCalledWith({
        amount: mockSubscription.subscriptionPlan.amount,
        currency: mockSubscription.subscriptionPlan.currency,
        paymentMethod: PaymentMethodType.CREDIT_CARD,
        customerId: mockSubscription.customerId,
        description: `Subscription payment for ${mockSubscription.subscriptionPlan.name}`,
        idempotencyKey: expect.stringContaining(
          `sub_${mockSubscription.id}_cycle_${mockSubscriptionPayment.billingCycleNumber}`,
        ),
        metadata: {
          subscriptionId: mockSubscription.id,
          subscriptionPaymentId: mockSubscriptionPayment.id,
          billingCycle: mockSubscriptionPayment.billingCycleNumber,
        },
        creditCard: expect.any(Object),
      });
      expect(result).toEqual({
        success: true,
        transactionId: 'txn-123',
      });
    });

    it('Then should handle payment service failure', async () => {
      // Arrange
      paymentService.createPurchase.mockResolvedValue({
        status: TransactionStatus.FAILED,
      } as any);

      // Act
      const result = await (service as any).processSubscriptionPayment(
        mockSubscription,
        mockSubscriptionPayment,
      );

      // Assert
      expect(result).toEqual({
        success: false,
        errorMessage: 'Payment failed',
      });
    });

    it('Then should handle payment service exception', async () => {
      // Arrange
      paymentService.createPurchase.mockRejectedValue(
        new Error('Service unavailable'),
      );

      // Act
      const result = await (service as any).processSubscriptionPayment(
        mockSubscription,
        mockSubscriptionPayment,
      );

      // Assert
      expect(result).toEqual({
        success: false,
        errorMessage: 'Service unavailable',
      });
    });
  });
});
