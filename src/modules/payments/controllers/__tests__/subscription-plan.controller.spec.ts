// Unit tests for SubscriptionPlanController
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlanController } from '../subscription-plan.controller';
import { SubscriptionPlanService } from '../../services/subscription-plan.service';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
  SubscriptionPlanResponseDto,
} from '../../dto/subscription-plan.dto';
import { HttpStatus } from '@nestjs/common';
import { SubscriptionPlanStatus } from '@/database/entities/subscription-plan.entity';

describe('SubscriptionPlanController', () => {
  let controller: SubscriptionPlanController;
  let planService: jest.Mocked<SubscriptionPlanService>;

  const mockResponse: SubscriptionPlanResponseDto = {
    id: 'plan-id',
    name: 'Basic Plan',
    description: 'A basic subscription plan',
    amount: 9.99,
    currency: 'USD',
    billingInterval: 'MONTHLY' as any,
    billingIntervalCount: 1,
    trialPeriodDays: 14,
    setupFee: 0,
    maxBillingCycles: undefined,
    status: SubscriptionPlanStatus.ACTIVE,
    isActive: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const createDto: CreateSubscriptionPlanDto = {
    name: 'Basic Plan',
    amount: 9.99,
    currency: 'USD',
    billingInterval: 'MONTHLY' as any,
    billingIntervalCount: 1,
  } as any;

  const updateDto: UpdateSubscriptionPlanDto = {
    description: 'Updated description',
    trialPeriodDays: 30,
    isActive: false,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionPlanController],
      providers: [
        {
          provide: SubscriptionPlanService,
          useValue: {
            createPlan: jest.fn(),
            findAllPlans: jest.fn(),
            findPlanById: jest.fn(),
            updatePlan: jest.fn(),
            deactivatePlan: jest.fn(),
            archivePlan: jest.fn(),
            deletePlan: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SubscriptionPlanController>(
      SubscriptionPlanController,
    );
    planService = module.get(SubscriptionPlanService);
  });

  // Happy path tests
  describe('createPlan (happy)', () => {
    it('should return created plan', async () => {
      planService.createPlan.mockResolvedValue(mockResponse);
      const result = await controller.createPlan(createDto);
      expect(result).toBe(mockResponse);
      expect(planService.createPlan).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAllPlans (happy)', () => {
    it('should return list of plans without filters', async () => {
      planService.findAllPlans.mockResolvedValue([mockResponse]);
      const result = await controller.findAllPlans(undefined, undefined);
      expect(result).toEqual([mockResponse]);
      expect(planService.findAllPlans).toHaveBeenCalledWith({
        isActive: undefined,
        status: undefined,
      });
    });

    it('should apply filter parameters', async () => {
      planService.findAllPlans.mockResolvedValue([mockResponse]);
      const result = await controller.findAllPlans(
        true,
        SubscriptionPlanStatus.ACTIVE,
      );
      expect(result).toEqual([mockResponse]);
      expect(planService.findAllPlans).toHaveBeenCalledWith({
        isActive: true,
        status: SubscriptionPlanStatus.ACTIVE,
      });
    });
  });

  describe('findPlanById (happy)', () => {
    it('should return plan details', async () => {
      planService.findPlanById.mockResolvedValue(mockResponse);
      const result = await controller.findPlanById('plan-id');
      expect(result).toBe(mockResponse);
      expect(planService.findPlanById).toHaveBeenCalledWith('plan-id');
    });
  });

  describe('updatePlan (happy)', () => {
    it('should return updated plan', async () => {
      planService.updatePlan.mockResolvedValue(mockResponse);
      const result = await controller.updatePlan('plan-id', updateDto);
      expect(result).toBe(mockResponse);
      expect(planService.updatePlan).toHaveBeenCalledWith('plan-id', updateDto);
    });
  });

  describe('deactivatePlan (happy)', () => {
    it('should return deactivated plan', async () => {
      planService.deactivatePlan.mockResolvedValue(mockResponse);
      const result = await controller.deactivatePlan('plan-id');
      expect(result).toBe(mockResponse);
      expect(planService.deactivatePlan).toHaveBeenCalledWith('plan-id');
    });
  });

  describe('archivePlan (happy)', () => {
    it('should return archived plan', async () => {
      planService.archivePlan.mockResolvedValue(mockResponse);
      const result = await controller.archivePlan('plan-id');
      expect(result).toBe(mockResponse);
      expect(planService.archivePlan).toHaveBeenCalledWith('plan-id');
    });
  });

  describe('deletePlan (happy)', () => {
    it('should call service delete without returning', async () => {
      planService.deletePlan.mockResolvedValue(undefined);
      await controller.deletePlan('plan-id');
      expect(planService.deletePlan).toHaveBeenCalledWith('plan-id');
    });
  });

  // Negative scenarios
  describe('createPlan (error)', () => {
    it('should propagate service errors', async () => {
      const error = new Error('Conflict: Plan name exists');
      planService.createPlan.mockRejectedValue(error);
      await expect(controller.createPlan(createDto)).rejects.toThrow(
        'Conflict: Plan name exists',
      );
    });
  });

  describe('findPlanById (not found)', () => {
    it('should propagate not found error', async () => {
      const error = new Error('Plan not found');
      planService.findPlanById.mockRejectedValue(error);
      await expect(controller.findPlanById('non-existent')).rejects.toThrow(
        'Plan not found',
      );
    });
  });
});
