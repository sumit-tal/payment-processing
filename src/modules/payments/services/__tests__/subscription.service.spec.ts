import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionService } from '../subscription.service';
import { SubscriptionPlanService } from '../subscription-plan.service';
import {
  Subscription,
  SubscriptionStatus,
} from '../../../../database/entities/subscription.entity';
import {
  SubscriptionPlan,
  BillingInterval,
  SubscriptionPlanStatus,
} from '../../../../database/entities/subscription-plan.entity';
import { PaymentMethod } from '../../../../database/entities/payment-method.entity';
import { SubscriptionPayment } from '../../../../database/entities/subscription-payment.entity';
import {
  CreateSubscriptionDto,
  CancelSubscriptionDto,
} from '../../dto/subscription.dto';

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
    subscriptionPlanRepository = module.get(
      getRepositoryToken(SubscriptionPlan),
    );
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

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create subscription when all validations pass', async () => {
      subscriptionPlanService.findPlanById.mockResolvedValue(
        mockSubscriptionPlan,
      );
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      const createARBSpy = jest.spyOn(service as any, 'createARBSubscription');
      createARBSpy.mockResolvedValue({
        success: true,
        gatewaySubscriptionId: 'gateway-sub-123',
        rawResponse: {},
      });

      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.save = jest.fn().mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(createSubscriptionDto);

      expect(subscriptionPlanService.findPlanById).toHaveBeenCalledWith(
        createSubscriptionDto.subscriptionPlanId,
      );
      expect(subscriptionPlanService.isPlanAvailable).toHaveBeenCalledWith(
        mockSubscriptionPlan.id,
      );
      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: createSubscriptionDto.paymentMethodId,
          customerId: createSubscriptionDto.customerId,
          isActive: true,
        },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('should create subscription with trial period when plan has trial days', async () => {
      const planWithTrial = {
        ...mockSubscriptionPlan,
        trialPeriodDays: 14,
      };
      subscriptionPlanService.findPlanById.mockResolvedValue(planWithTrial);
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      const createARBSpy = jest.spyOn(service as any, 'createARBSubscription');
      createARBSpy.mockResolvedValue({
        success: true,
        gatewaySubscriptionId: 'gateway-sub-123',
        rawResponse: {},
      });

      const queryRunner = dataSource.createQueryRunner();
      const subscriptionWithTrial = {
        ...mockSubscription,
        status: SubscriptionStatus.TRIAL,
        trialStart: expect.any(Date),
        trialEnd: expect.any(Date),
      };
      queryRunner.manager.save = jest
        .fn()
        .mockResolvedValue(subscriptionWithTrial);

      const result = await service.createSubscription(createSubscriptionDto);

      expect(result.status).toBe(SubscriptionStatus.TRIAL);
      expect(createARBSpy).toHaveBeenCalled();
    });

    it('should create subscription with custom trial end date when provided', async () => {
      const customTrialEnd = new Date();
      customTrialEnd.setDate(customTrialEnd.getDate() + 30);
      const dtoWithTrialEnd = {
        ...createSubscriptionDto,
        trialEnd: customTrialEnd.toISOString(),
      };

      subscriptionPlanService.findPlanById.mockResolvedValue(
        mockSubscriptionPlan,
      );
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      const createARBSpy = jest.spyOn(service as any, 'createARBSubscription');
      createARBSpy.mockResolvedValue({
        success: true,
        gatewaySubscriptionId: 'gateway-sub-123',
        rawResponse: {},
      });

      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.save = jest.fn().mockResolvedValue(mockSubscription);

      await service.createSubscription(dtoWithTrialEnd);

      expect(createARBSpy).toHaveBeenCalled();
    });

    it('should create subscription with metadata when provided', async () => {
      const dtoWithMetadata = {
        ...createSubscriptionDto,
        metadata: {
          source: 'web',
          campaign: 'summer2024',
          customField: 'value',
        },
      };

      subscriptionPlanService.findPlanById.mockResolvedValue(
        mockSubscriptionPlan,
      );
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      const createARBSpy = jest.spyOn(service as any, 'createARBSubscription');
      createARBSpy.mockResolvedValue({
        success: true,
        gatewaySubscriptionId: 'gateway-sub-123',
        rawResponse: {},
      });

      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.save = jest.fn().mockResolvedValue({
        ...mockSubscription,
        metadata: dtoWithMetadata.metadata,
      });

      const result = await service.createSubscription(dtoWithMetadata);

      expect(result.metadata).toEqual(dtoWithMetadata.metadata);
    });

    it('should throw BadRequestException when subscription plan is not available', async () => {
      subscriptionPlanService.findPlanById.mockResolvedValue(
        mockSubscriptionPlan,
      );
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(false);

      await expect(
        service.createSubscription(createSubscriptionDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createSubscription(createSubscriptionDto),
      ).rejects.toThrow('Subscription plan is not available');
    });

    it('should throw NotFoundException when payment method not found', async () => {
      subscriptionPlanService.findPlanById.mockResolvedValue(
        mockSubscriptionPlan,
      );
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createSubscription(createSubscriptionDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createSubscription(createSubscriptionDto),
      ).rejects.toThrow('Payment method not found or not active');
    });

    it('should throw NotFoundException when payment method belongs to different customer', async () => {
      const differentCustomerPaymentMethod = {
        ...mockPaymentMethod,
        customerId: 'different-customer',
      };

      subscriptionPlanService.findPlanById.mockResolvedValue(
        mockSubscriptionPlan,
      );
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createSubscription(createSubscriptionDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when payment method is inactive', async () => {
      const inactivePaymentMethod = {
        ...mockPaymentMethod,
        isActive: false,
      };

      subscriptionPlanService.findPlanById.mockResolvedValue(
        mockSubscriptionPlan,
      );
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createSubscription(createSubscriptionDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when ARB subscription creation fails', async () => {
      subscriptionPlanService.findPlanById.mockResolvedValue(
        mockSubscriptionPlan,
      );
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      const createARBSpy = jest.spyOn(service as any, 'createARBSubscription');
      createARBSpy.mockResolvedValue({
        success: false,
        errorMessage: 'Invalid payment method',
        rawResponse: {},
      });

      await expect(
        service.createSubscription(createSubscriptionDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createSubscription(createSubscriptionDto),
      ).rejects.toThrow(
        'Failed to create subscription: Invalid payment method',
      );
    });

    it('should rollback transaction when database save fails', async () => {
      subscriptionPlanService.findPlanById.mockResolvedValue(
        mockSubscriptionPlan,
      );
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      const createARBSpy = jest.spyOn(service as any, 'createARBSubscription');
      createARBSpy.mockResolvedValue({
        success: true,
        gatewaySubscriptionId: 'gateway-sub-123',
        rawResponse: {},
      });

      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.save = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(
        service.createSubscription(createSubscriptionDto),
      ).rejects.toThrow('Database error');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should handle subscription plan service errors', async () => {
      subscriptionPlanService.findPlanById.mockRejectedValue(
        new NotFoundException('Plan not found'),
      );

      await expect(
        service.createSubscription(createSubscriptionDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use current date as start date when not provided', async () => {
      const dtoWithoutStartDate = {
        customerId: 'customer-123',
        subscriptionPlanId: 'plan-123',
        paymentMethodId: 'pm-123',
        metadata: {},
      };

      subscriptionPlanService.findPlanById.mockResolvedValue(
        mockSubscriptionPlan,
      );
      subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      const createARBSpy = jest.spyOn(service as any, 'createARBSubscription');
      createARBSpy.mockResolvedValue({
        success: true,
        gatewaySubscriptionId: 'gateway-sub-123',
        rawResponse: {},
      });

      const queryRunner = dataSource.createQueryRunner();
      queryRunner.manager.save = jest.fn().mockResolvedValue(mockSubscription);

      await service.createSubscription(dtoWithoutStartDate);

      expect(createARBSpy).toHaveBeenCalled();
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

      await expect(
        service.findSubscriptionById('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
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

    it('should return empty array when customer has no subscriptions', async () => {
      subscriptionRepository.find.mockResolvedValue([]);

      const result = await service.findSubscriptionsByCustomer('customer-456');

      expect(result).toEqual([]);
    });

    it('should handle database errors when finding customer subscriptions', async () => {
      subscriptionRepository.find.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.findSubscriptionsByCustomer('customer-123'),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('updateSubscription', () => {
    const updateSubscriptionDto = {
      paymentMethodId: 'pm-456',
      status: SubscriptionStatus.ACTIVE,
      metadata: { updated: 'true' },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update subscription when valid data provided', async () => {
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(mockSubscription);
      paymentMethodRepository.findOne.mockResolvedValue({
        ...mockPaymentMethod,
        id: 'pm-456',
      });
      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        paymentMethodId: 'pm-456',
        metadata: { updated: 'true' },
      });

      const result = await service.updateSubscription(
        mockSubscription.id,
        updateSubscriptionDto,
      );

      expect(findByIdSpy).toHaveBeenCalledWith(mockSubscription.id);
      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 'pm-456',
          customerId: mockSubscription.customerId,
          isActive: true,
        },
      });
      expect(result.paymentMethodId).toBe('pm-456');
    });

    it('should update subscription status when provided', async () => {
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(mockSubscription);
      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
      });

      const result = await service.updateSubscription(mockSubscription.id, {
        status: SubscriptionStatus.CANCELLED,
      });

      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
    });

    it('should merge metadata when updating', async () => {
      const subscriptionWithMetadata = {
        ...mockSubscription,
        metadata: { existing: 'value', keep: 'this' },
      };
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(subscriptionWithMetadata);
      subscriptionRepository.save.mockResolvedValue({
        ...subscriptionWithMetadata,
        metadata: {
          existing: 'value',
          keep: 'this',
          new: 'field',
        },
      });

      const result = await service.updateSubscription(mockSubscription.id, {
        metadata: { new: 'field' },
      });

      expect(result.metadata).toEqual({
        existing: 'value',
        keep: 'this',
        new: 'field',
      });
    });

    it('should throw NotFoundException when subscription not found', async () => {
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockRejectedValue(
        new NotFoundException('Subscription not found'),
      );

      await expect(
        service.updateSubscription('non-existent-id', updateSubscriptionDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when payment method not found', async () => {
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(mockSubscription);
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateSubscription(mockSubscription.id, {
          paymentMethodId: 'non-existent-pm',
        }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateSubscription(mockSubscription.id, {
          paymentMethodId: 'non-existent-pm',
        }),
      ).rejects.toThrow('Payment method not found or not active');
    });

    it('should throw NotFoundException when payment method belongs to different customer', async () => {
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(mockSubscription);
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateSubscription(mockSubscription.id, {
          paymentMethodId: 'pm-different-customer',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle database save errors during update', async () => {
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(mockSubscription);
      subscriptionRepository.save.mockRejectedValue(
        new Error('Database save failed'),
      );

      await expect(
        service.updateSubscription(mockSubscription.id, {
          status: SubscriptionStatus.CANCELLED,
        }),
      ).rejects.toThrow('Database save failed');
    });

    it('should update subscription without payment method when not provided', async () => {
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(mockSubscription);
      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.SUSPENDED,
      });

      const result = await service.updateSubscription(mockSubscription.id, {
        status: SubscriptionStatus.SUSPENDED,
      });

      expect(paymentMethodRepository.findOne).not.toHaveBeenCalled();
      expect(result.status).toBe(SubscriptionStatus.SUSPENDED);
    });
  });

  describe('cancelSubscription', () => {
    const cancelDto: CancelSubscriptionDto = {
      cancellationReason: 'Customer request',
      cancelImmediately: false,
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should cancel subscription when valid', async () => {
      const activeSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      };
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(activeSubscription);

      const cancelARBSpy = jest.spyOn(service as any, 'cancelARBSubscription');
      cancelARBSpy.mockResolvedValue(undefined);

      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        endedAt: mockSubscription.currentPeriodEnd,
      };
      subscriptionRepository.save.mockResolvedValue(cancelledSubscription);

      const result = await service.cancelSubscription(
        mockSubscription.id,
        cancelDto,
      );

      expect(findByIdSpy).toHaveBeenCalledWith(mockSubscription.id);
      expect(cancelARBSpy).toHaveBeenCalledWith(
        mockSubscription.gatewaySubscriptionId,
      );
      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
      expect(result.endedAt).toBe(mockSubscription.currentPeriodEnd);
    });

    it('should cancel subscription immediately when requested', async () => {
      const activeSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      };
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(activeSubscription);

      const cancelARBSpy = jest.spyOn(service as any, 'cancelARBSubscription');
      cancelARBSpy.mockResolvedValue(undefined);

      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        endedAt: expect.any(Date),
      };
      subscriptionRepository.save.mockResolvedValue(cancelledSubscription);

      const immediateCancelDto = {
        ...cancelDto,
        cancelImmediately: true,
      };

      const result = await service.cancelSubscription(
        mockSubscription.id,
        immediateCancelDto,
      );

      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
      expect(result.endedAt).toEqual(expect.any(Date));
    });

    it('should add cancellation reason to metadata when provided', async () => {
      const activeSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      };
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(activeSubscription);

      const cancelARBSpy = jest.spyOn(service as any, 'cancelARBSubscription');
      cancelARBSpy.mockResolvedValue(undefined);

      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        metadata: {
          ...mockSubscription.metadata,
          cancellationReason: 'Customer request',
        },
      };
      subscriptionRepository.save.mockResolvedValue(cancelledSubscription);

      const result = await service.cancelSubscription(
        mockSubscription.id,
        cancelDto,
      );

      expect(result.metadata.cancellationReason).toBe('Customer request');
    });

    it('should cancel subscription without reason when not provided', async () => {
      const activeSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      };
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(activeSubscription);

      const cancelARBSpy = jest.spyOn(service as any, 'cancelARBSubscription');
      cancelARBSpy.mockResolvedValue(undefined);

      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
      };
      subscriptionRepository.save.mockResolvedValue(cancelledSubscription);

      const cancelDtoWithoutReason = {
        cancelImmediately: false,
      };

      const result = await service.cancelSubscription(
        mockSubscription.id,
        cancelDtoWithoutReason,
      );

      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
    });

    it('should throw BadRequestException when subscription already cancelled', async () => {
      const cancelledSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
      };
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(cancelledSubscription);

      await expect(
        service.cancelSubscription(mockSubscription.id, cancelDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancelSubscription(mockSubscription.id, cancelDto),
      ).rejects.toThrow('Subscription is already cancelled');
    });

    it('should throw NotFoundException when subscription not found', async () => {
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockRejectedValue(
        new NotFoundException('Subscription not found'),
      );

      await expect(
        service.cancelSubscription('non-existent-id', cancelDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle ARB cancellation failures', async () => {
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(mockSubscription);

      const cancelARBSpy = jest.spyOn(service as any, 'cancelARBSubscription');
      cancelARBSpy.mockRejectedValue(
        new BadRequestException('Failed to cancel subscription in gateway'),
      );

      await expect(
        service.cancelSubscription(mockSubscription.id, cancelDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle database save errors during cancellation', async () => {
      const activeSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      };
      const findByIdSpy = jest.spyOn(service, 'findSubscriptionById');
      findByIdSpy.mockResolvedValue(activeSubscription);

      const cancelARBSpy = jest.spyOn(service as any, 'cancelARBSubscription');
      cancelARBSpy.mockResolvedValue(undefined);

      subscriptionRepository.save.mockRejectedValue(
        new Error('Database save failed'),
      );

      await expect(
        service.cancelSubscription(mockSubscription.id, cancelDto),
      ).rejects.toThrow('Database save failed');
    });
  });

  describe('getSubscriptionsDueForBilling', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

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

    it('should return empty array when no subscriptions due for billing', async () => {
      subscriptionRepository.find.mockResolvedValue([]);

      const result = await service.getSubscriptionsDueForBilling();

      expect(result).toEqual([]);
    });

    it('should handle database errors when finding subscriptions due for billing', async () => {
      subscriptionRepository.find.mockRejectedValue(
        new Error('Database query failed'),
      );

      await expect(service.getSubscriptionsDueForBilling()).rejects.toThrow(
        'Database query failed',
      );
    });

    it('should only return active subscriptions', async () => {
      const activeSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      };

      subscriptionRepository.find.mockResolvedValue([activeSubscription]);

      const result = await service.getSubscriptionsDueForBilling();

      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: {
          status: SubscriptionStatus.ACTIVE,
          nextBillingDate: { $lte: expect.any(Date) },
        },
        relations: ['subscriptionPlan', 'paymentMethod'],
      });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(SubscriptionStatus.ACTIVE);
    });
  });

  describe('Private Helper Methods', () => {
    describe('calculateNextBillingDate', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');

      it('should calculate next billing date for daily interval', () => {
        const result = (service as any).calculateNextBillingDate(
          startDate,
          BillingInterval.DAILY,
          1,
        );
        const expected = new Date('2024-01-02T00:00:00Z');
        expect(result).toEqual(expected);
      });

      it('should calculate next billing date for weekly interval', () => {
        const result = (service as any).calculateNextBillingDate(
          startDate,
          BillingInterval.WEEKLY,
          1,
        );
        const expected = new Date('2024-01-08T00:00:00Z');
        expect(result).toEqual(expected);
      });

      it('should calculate next billing date for monthly interval', () => {
        const result = (service as any).calculateNextBillingDate(
          startDate,
          BillingInterval.MONTHLY,
          1,
        );
        const expected = new Date('2024-02-01T00:00:00Z');
        expect(result).toEqual(expected);
      });

      it('should calculate next billing date for quarterly interval', () => {
        const result = (service as any).calculateNextBillingDate(
          startDate,
          BillingInterval.QUARTERLY,
          1,
        );
        const expected = new Date('2024-04-01T00:00:00Z');
        expect(result).toEqual(expected);
      });

      it('should calculate next billing date for yearly interval', () => {
        const result = (service as any).calculateNextBillingDate(
          startDate,
          BillingInterval.YEARLY,
          1,
        );
        const expected = new Date('2025-01-01T00:00:00Z');
        expect(result).toEqual(expected);
      });

      it('should handle multiple interval counts', () => {
        const result = (service as any).calculateNextBillingDate(
          startDate,
          BillingInterval.MONTHLY,
          3,
        );
        const expected = new Date('2024-04-01T00:00:00Z');
        expect(result).toEqual(expected);
      });

      it('should handle edge case dates like end of month', () => {
        const endOfMonth = new Date('2024-01-31T00:00:00Z');
        const result = (service as any).calculateNextBillingDate(
          endOfMonth,
          BillingInterval.MONTHLY,
          1,
        );
        expect(result.getMonth()).toBe(2); // March (0-based indexing, Feb 31 -> Mar 2/3)
      });

      it('should handle leap year calculations', () => {
        const leapYearDate = new Date('2024-02-29T00:00:00Z');
        const result = (service as any).calculateNextBillingDate(
          leapYearDate,
          BillingInterval.YEARLY,
          1,
        );
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(2); // March (0-based indexing, Feb 29 -> Mar 1)
        expect(result.getDate()).toBe(1); // Non-leap year adjustment
      });
    });

    describe('mapBillingIntervalToAuthorizeNet', () => {
      it('should map daily interval correctly', () => {
        const result = (service as any).mapBillingIntervalToAuthorizeNet(
          BillingInterval.DAILY,
          1,
        );
        expect(result.getLength()).toBe(1);
      });

      it('should map weekly interval to days', () => {
        const result = (service as any).mapBillingIntervalToAuthorizeNet(
          BillingInterval.WEEKLY,
          1,
        );
        expect(result.getLength()).toBe(7);
      });

      it('should map monthly interval correctly', () => {
        const result = (service as any).mapBillingIntervalToAuthorizeNet(
          BillingInterval.MONTHLY,
          1,
        );
        expect(result.getLength()).toBe(1);
      });

      it('should map quarterly interval to months', () => {
        const result = (service as any).mapBillingIntervalToAuthorizeNet(
          BillingInterval.QUARTERLY,
          1,
        );
        expect(result.getLength()).toBe(3);
      });

      it('should map yearly interval to months', () => {
        const result = (service as any).mapBillingIntervalToAuthorizeNet(
          BillingInterval.YEARLY,
          1,
        );
        expect(result.getLength()).toBe(12);
      });

      it('should handle multiple interval counts', () => {
        const result = (service as any).mapBillingIntervalToAuthorizeNet(
          BillingInterval.MONTHLY,
          3,
        );
        expect(result.getLength()).toBe(3);
      });

      it('should throw BadRequestException for unsupported interval', () => {
        expect(() => {
          (service as any).mapBillingIntervalToAuthorizeNet(
            'UNSUPPORTED' as BillingInterval,
            1,
          );
        }).toThrow(BadRequestException);
        expect(() => {
          (service as any).mapBillingIntervalToAuthorizeNet(
            'UNSUPPORTED' as BillingInterval,
            1,
          );
        }).toThrow('Unsupported billing interval: UNSUPPORTED');
      });
    });

    describe('validateConfig', () => {
      it('should throw error when API login ID is missing', () => {
        const invalidConfigService = {
          get: jest.fn().mockImplementation((key: string) => {
            if (key === 'AUTHORIZENET_API_LOGIN_ID') return null;
            if (key === 'AUTHORIZENET_TRANSACTION_KEY') return 'test-key';
            return null;
          }),
        };

        expect(() => {
          new SubscriptionService(
            subscriptionRepository,
            subscriptionPlanRepository,
            paymentMethodRepository,
            {} as any,
            subscriptionPlanService,
            dataSource,
            invalidConfigService as any,
          );
        }).toThrow('Authorize.Net API credentials are required');
      });

      it('should throw error when transaction key is missing', () => {
        const invalidConfigService = {
          get: jest.fn().mockImplementation((key: string) => {
            if (key === 'AUTHORIZENET_API_LOGIN_ID') return 'test-login';
            if (key === 'AUTHORIZENET_TRANSACTION_KEY') return null;
            return null;
          }),
        };

        expect(() => {
          new SubscriptionService(
            subscriptionRepository,
            subscriptionPlanRepository,
            paymentMethodRepository,
            {} as any,
            subscriptionPlanService,
            dataSource,
            invalidConfigService as any,
          );
        }).toThrow('Authorize.Net API credentials are required');
      });
    });
  });

  describe('Authorize.Net Integration Edge Cases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('createARBSubscription', () => {
      it('should handle invalid payment method ID format', async () => {
        const invalidPaymentMethod = {
          ...mockPaymentMethod,
          gatewayPaymentMethodId: 'invalid-format',
        };

        subscriptionPlanService.findPlanById.mockResolvedValue(
          mockSubscriptionPlan,
        );
        subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
        paymentMethodRepository.findOne.mockResolvedValue(invalidPaymentMethod);

        const createSubscriptionDto = {
          customerId: 'customer-123',
          subscriptionPlanId: 'plan-123',
          paymentMethodId: 'pm-123',
          metadata: {},
        };

        await expect(
          service.createSubscription(createSubscriptionDto),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.createSubscription(createSubscriptionDto),
        ).rejects.toThrow('Invalid payment method ID format');
      });

      it('should handle payment method ID with missing parts', async () => {
        const invalidPaymentMethod = {
          ...mockPaymentMethod,
          gatewayPaymentMethodId: 'profile123|',
        };

        subscriptionPlanService.findPlanById.mockResolvedValue(
          mockSubscriptionPlan,
        );
        subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
        paymentMethodRepository.findOne.mockResolvedValue(invalidPaymentMethod);

        const createSubscriptionDto = {
          customerId: 'customer-123',
          subscriptionPlanId: 'plan-123',
          paymentMethodId: 'pm-123',
          metadata: {},
        };

        await expect(
          service.createSubscription(createSubscriptionDto),
        ).rejects.toThrow(BadRequestException);
      });

      it('should handle ARB subscription with unlimited billing cycles', async () => {
        const unlimitedPlan = {
          ...mockSubscriptionPlan,
          maxBillingCycles: null,
        };

        subscriptionPlanService.findPlanById.mockResolvedValue(unlimitedPlan);
        subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
        paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

        const createARBSpy = jest.spyOn(
          service as any,
          'createARBSubscription',
        );
        createARBSpy.mockResolvedValue({
          success: true,
          gatewaySubscriptionId: 'gateway-sub-123',
          rawResponse: {},
        });

        const queryRunner = dataSource.createQueryRunner();
        queryRunner.manager.save = jest
          .fn()
          .mockResolvedValue(mockSubscription);

        const createSubscriptionDto = {
          customerId: 'customer-123',
          subscriptionPlanId: 'plan-123',
          paymentMethodId: 'pm-123',
          metadata: {},
        };

        await service.createSubscription(createSubscriptionDto);

        expect(createARBSpy).toHaveBeenCalled();
      });

      it('should handle special characters in customer and plan IDs', async () => {
        const specialCharacterDto = {
          customerId: 'customer-123-äöü-测试',
          subscriptionPlanId: 'plan-123-éñ-тест',
          paymentMethodId: 'pm-123-ñ',
          metadata: { emoji: '🎉', unicode: 'café' },
        };

        subscriptionPlanService.findPlanById.mockResolvedValue(
          mockSubscriptionPlan,
        );
        subscriptionPlanService.isPlanAvailable.mockResolvedValue(true);
        paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

        const createARBSpy = jest.spyOn(
          service as any,
          'createARBSubscription',
        );
        createARBSpy.mockResolvedValue({
          success: true,
          gatewaySubscriptionId: 'gateway-sub-123',
          rawResponse: {},
        });

        const queryRunner = dataSource.createQueryRunner();
        queryRunner.manager.save = jest.fn().mockResolvedValue({
          ...mockSubscription,
          customerId: specialCharacterDto.customerId,
          metadata: specialCharacterDto.metadata,
        });

        const result = await service.createSubscription(specialCharacterDto);

        expect(result.customerId).toBe(specialCharacterDto.customerId);
        expect(result.metadata).toEqual(specialCharacterDto.metadata);
      });
    });
  });
});
