import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { SubscriptionPlanService } from '../subscription-plan.service';
import {
  SubscriptionPlan,
  SubscriptionPlanStatus,
  BillingInterval,
} from '../../../../database/entities/subscription-plan.entity';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from '../../dto/subscription-plan.dto';

describe('SubscriptionPlanService', () => {
  let service: SubscriptionPlanService;
  let repository: jest.Mocked<Repository<SubscriptionPlan>>;

  const mockSubscriptionPlan = new SubscriptionPlan({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Basic Plan',
    description: 'Basic subscription plan',
    amount: 29.99,
    currency: 'USD',
    billingInterval: BillingInterval.MONTHLY,
    billingIntervalCount: 1,
    trialPeriodDays: 7,
    setupFee: 0,
    maxBillingCycles: undefined,
    status: SubscriptionPlanStatus.ACTIVE,
    isActive: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPlanService,
        {
          provide: getRepositoryToken(SubscriptionPlan),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SubscriptionPlanService>(SubscriptionPlanService);
    repository = module.get(getRepositoryToken(SubscriptionPlan));
  });

  describe('createPlan', () => {
    const createPlanDto: CreateSubscriptionPlanDto = {
      name: 'Basic Plan',
      description: 'Basic subscription plan',
      amount: 29.99,
      currency: 'USD',
      billingInterval: BillingInterval.MONTHLY,
      billingIntervalCount: 1,
      trialPeriodDays: 7,
      setupFee: 0,
      maxBillingCycles: undefined,
      metadata: {},
    };

    it('should create a subscription plan when name is unique', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.save.mockResolvedValue(mockSubscriptionPlan);

      const result = await service.createPlan(createPlanDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { name: createPlanDto.name },
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockSubscriptionPlan);
    });

    it('should throw ConflictException when plan name already exists', async () => {
      repository.findOne.mockResolvedValue(mockSubscriptionPlan);

      await expect(service.createPlan(createPlanDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findPlanById', () => {
    it('should return subscription plan when found', async () => {
      repository.findOne.mockResolvedValue(mockSubscriptionPlan);

      const result = await service.findPlanById(mockSubscriptionPlan.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockSubscriptionPlan.id },
      });
      expect(result).toEqual(mockSubscriptionPlan);
    });

    it('should throw NotFoundException when plan not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findPlanById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllPlans', () => {
    it('should return all plans when no filters provided', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubscriptionPlan]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAllPlans();

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('plan');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'plan.createdAt',
        'DESC',
      );
      expect(result).toEqual([mockSubscriptionPlan]);
    });

    it('should filter by isActive when provided', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubscriptionPlan]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.findAllPlans({ isActive: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'plan.isActive = :isActive',
        { isActive: true },
      );
    });

    it('should filter by status when provided', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSubscriptionPlan]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.findAllPlans({ status: SubscriptionPlanStatus.ACTIVE });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'plan.status = :status',
        { status: SubscriptionPlanStatus.ACTIVE },
      );
    });
  });

  describe('updatePlan', () => {
    const updatePlanDto: UpdateSubscriptionPlanDto = {
      description: 'Updated description',
      setupFee: 5.0,
    };

    it('should update subscription plan when found', async () => {
      const updatedPlan = new SubscriptionPlan({
        ...mockSubscriptionPlan,
        description: updatePlanDto.description,
        setupFee: updatePlanDto.setupFee,
      });
      repository.findOne.mockResolvedValue(mockSubscriptionPlan);
      repository.save.mockResolvedValue(updatedPlan);

      const result = await service.updatePlan(
        mockSubscriptionPlan.id,
        updatePlanDto,
      );

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockSubscriptionPlan.id },
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedPlan);
    });

    it('should throw NotFoundException when plan not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePlan('non-existent-id', updatePlanDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivatePlan', () => {
    it('should deactivate subscription plan when found', async () => {
      const deactivatedPlan = new SubscriptionPlan({
        ...mockSubscriptionPlan,
        isActive: false,
        status: SubscriptionPlanStatus.INACTIVE,
      });
      repository.findOne.mockResolvedValue(mockSubscriptionPlan);
      repository.save.mockResolvedValue(deactivatedPlan);

      const result = await service.deactivatePlan(mockSubscriptionPlan.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockSubscriptionPlan.id },
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result.isActive).toBe(false);
      expect(result.status).toBe(SubscriptionPlanStatus.INACTIVE);
    });

    it('should throw NotFoundException when plan not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.deactivatePlan('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('isPlanAvailable', () => {
    it('should return true when plan is active and available', async () => {
      // Make sure the mock plan has both isActive=true and status=ACTIVE
      const activePlan = {
        ...mockSubscriptionPlan,
        isActive: true,
        status: SubscriptionPlanStatus.ACTIVE
      };
      repository.findOne.mockResolvedValue(activePlan);

      const result = await service.isPlanAvailable(mockSubscriptionPlan.id);

      expect(result).toBe(true);
    });

    it('should return false when plan is inactive', async () => {
      const inactivePlan = { ...mockSubscriptionPlan, isActive: false };
      repository.findOne.mockResolvedValue(inactivePlan);

      const result = await service.isPlanAvailable(mockSubscriptionPlan.id);

      expect(result).toBe(false);
    });
  });
});
