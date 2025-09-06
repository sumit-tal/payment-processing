import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionPlanService } from './subscription-plan.service';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import { SubscriptionPlan, BillingInterval, SubscriptionPlanStatus } from '../entities/subscription-plan.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { SubscriptionPayment } from '../entities/subscription-payment.entity';
import { CreateSubscriptionDto, CancelSubscriptionDto } from '../dto/subscription.dto';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepository: jest.Mocked<Repository<Subscription>>;
  let subscriptionPlanRepository: jest.Mocked<Repository<SubscriptionPlan>>;
  let paymentMethodRepository: jest.Mocked<Repository<PaymentMethod>>;
  let subscriptionPlanService: jest.Mocked<SubscriptionPlanService>;
  let dataSource: jest.Mocked<DataSource>;
  let configService: jest.Mocked<ConfigService>;

  const mockSubscriptionPlan: SubscriptionPlan = {
    id: 'plan-123',
    name: 'Basic Plan',
    amount: 29.99,
    currency: 'USD',
    billingInterval: BillingInterval.MONTHLY,
    billingIntervalCount: 1,
    trialPeriodDays: 7,
    setupFee: 0,
    maxBillingCycles: undefined,
    isActive: true,
    status: SubscriptionPlanStatus.ACTIVE,
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
    gatewaySubscriptionId: 'gateway-sub-123',
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(),
    nextBillingDate: new Date(),
    billingCycleCount: 0,
    failedPaymentCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Subscription;

  beforeEach(async () => {
    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
      },
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'AUTHORIZENET_API_LOGIN_ID':
            return 'test-login-id';
          case 'AUTHORIZENET_TRANSACTION_KEY':
            return 'test-transaction-key';
          case 'AUTHORIZENET_ENVIRONMENT':
            return 'sandbox';
          default:
            return null;
        }
      }),
    };

    const mockSubscriptionPlanService = {
      findPlanById: jest.fn(),
      isPlanAvailable: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SubscriptionPlan),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PaymentMethod),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SubscriptionPayment),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: SubscriptionPlanService,
          useValue: mockSubscriptionPlanService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    subscriptionRepository = module.get(getRepositoryToken(Subscription));
    subscriptionPlanRepository = module.get(getRepositoryToken(SubscriptionPlan));
    paymentMethodRepository = module.get(getRepositoryToken(PaymentMethod));
    subscriptionPlanService = module.get(SubscriptionPlanService);
    dataSource = module.get(DataSource);
    configService = module.get(ConfigService);
  });

  describe('createSubscription', () => {
    const createSubscriptionDto: CreateSubscriptionDto = {
      customerId: 'customer-123',
      subscriptionPlanId: 'plan-123',
      paymentMethodId: 'pm-123',
      startDate: new Date().toISOString(),
      metadata: {},
    };

    it('should create subscription when all validations pass', async () => {
      subscriptionPlanService.findPlanById.mockResolvedValue(mockSubscriptionPlan);
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      // Mock the ARB creation (would need to mock the actual Authorize.Net calls)
      const createARBSpy = jest.spyOn(service as any, 'createARBSubscription');
      createARBSpy.mockResolvedValue({
        success: true,
        gatewaySubscriptionId: 'gateway-sub-123',
        rawResponse: {},
      });

      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.save = jest.fn().mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(createSubscriptionDto);

      expect(subscriptionPlanService.findPlanById).toHaveBeenCalledWith(createSubscriptionDto.subscriptionPlanId);
      expect(subscriptionPlanService.isPlanAvailable).toHaveBeenCalledWith(mockSubscriptionPlan.id);
      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: createSubscriptionDto.paymentMethodId,
          customerId: createSubscriptionDto.customerId,
          isActive: true,
        },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('should throw BadRequestException when subscription plan is not available', async () => {
      subscriptionPlanService.findPlanById.mockResolvedValue(mockSubscriptionPlan);
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(false);

      await expect(service.createSubscription(createSubscriptionDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when payment method not found', async () => {
      subscriptionPlanService.findPlanById.mockResolvedValue(mockSubscriptionPlan);
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(service.createSubscription(createSubscriptionDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findSubscriptionById', () => {
    it('should return subscription when found', async () => {
      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);

      const result = await service.findSubscriptionById(mockSubscription.id);

      expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        relations: ['subscriptionPlan', 'paymentMethod'],
      });
      expect(result).toEqual(mockSubscription);
    });

    it('should throw NotFoundException when subscription not found', async () => {
      subscriptionRepository.findOne.mockResolvedValue(null);

      await expect(service.findSubscriptionById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findSubscriptionsByCustomer', () => {
    it('should return customer subscriptions', async () => {
      subscriptionRepository.find.mockResolvedValue([mockSubscription]);

      const result = await service.findSubscriptionsByCustomer('customer-123');

      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: { customerId: 'customer-123' },
        relations: ['subscriptionPlan', 'paymentMethod'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockSubscription]);
    });
  });

  describe('cancelSubscription', () => {
    const cancelDto: CancelSubscriptionDto = {
      cancellationReason: 'Customer request',
      cancelImmediately: false,
    };

    it('should cancel subscription when valid', async () => {
      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      
      // Mock the ARB cancellation
      const cancelARBSpy = jest.spyOn(service as any, 'cancelARBSubscription');
      cancelARBSpy.mockResolvedValue(undefined);

      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        endedAt: mockSubscription.currentPeriodEnd,
      };
      subscriptionRepository.save.mockResolvedValue(cancelledSubscription);

      const result = await service.cancelSubscription(mockSubscription.id, cancelDto);

      expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        relations: ['subscriptionPlan', 'paymentMethod'],
      });
      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
    });

    it('should throw BadRequestException when subscription already cancelled', async () => {
      const cancelledSubscription = { ...mockSubscription, status: SubscriptionStatus.CANCELLED };
      subscriptionRepository.findOne.mockResolvedValue(cancelledSubscription);

      await expect(service.cancelSubscription(mockSubscription.id, cancelDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSubscriptionsDueForBilling', () => {
    it('should return active subscriptions due for billing', async () => {
      subscriptionRepository.find.mockResolvedValue([mockSubscription]);

      const result = await service.getSubscriptionsDueForBilling();

      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: {
          status: SubscriptionStatus.ACTIVE,
          nextBillingDate: { $lte: expect.any(Date) },
        },
        relations: ['subscriptionPlan', 'paymentMethod'],
      });
      expect(result).toEqual([mockSubscription]);
    });
  });
});
