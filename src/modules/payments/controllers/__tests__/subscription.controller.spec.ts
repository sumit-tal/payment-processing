// Unit tests for SubscriptionController
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionController } from '../subscription.controller';
import { SubscriptionService } from '../../services/subscription.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CancelSubscriptionDto,
  SubscriptionResponseDto,
} from '../../dto/subscription.dto';
import { HttpStatus } from '@nestjs/common';
import { Subscription } from '@/database/entities/subscription.entity';

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let subscriptionService: jest.Mocked<SubscriptionService>;

  const mockResponse: SubscriptionResponseDto = {
    id: 'test-id',
    customerId: 'customer-uuid',
    subscriptionPlanId: 'plan-uuid',
    status: 'ACTIVE',
    startDate: new Date(),
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const createDto: CreateSubscriptionDto = {
    customerId: 'customer-uuid',
    subscriptionPlanId: 'plan-uuid',
    paymentMethodId: 'pm-uuid',
  } as any;

  const updateDto: UpdateSubscriptionDto = {
    status: 'PAUSED',
  } as any;

  const cancelDto: CancelSubscriptionDto = {
    cancellationReason: 'User requested cancellation',
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        {
          provide: SubscriptionService,
          useValue: {
            createSubscription: jest.fn(),
            findSubscriptionById: jest.fn(),
            findSubscriptionsByCustomer: jest.fn(),
            updateSubscription: jest.fn(),
            cancelSubscription: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SubscriptionController>(SubscriptionController);
    subscriptionService = module.get(SubscriptionService);
  });

  describe('createSubscription (happy path)', () => {
    it('should return created subscription', async () => {
      subscriptionService.createSubscription.mockResolvedValue(
        mockResponse as unknown as Subscription,
      );
      const result = await controller.createSubscription(createDto);
      expect(result).toBe(mockResponse);
      expect(subscriptionService.createSubscription).toHaveBeenCalledWith(
        createDto,
      );
    });
  });

  describe('findSubscriptionById (happy path)', () => {
    it('should return subscription details', async () => {
      subscriptionService.findSubscriptionById.mockResolvedValue(
        mockResponse as unknown as Subscription,
      );
      const result = await controller.findSubscriptionById('test-id');
      expect(result).toBe(mockResponse);
      expect(subscriptionService.findSubscriptionById).toHaveBeenCalledWith(
        'test-id',
      );
    });
  });

  describe('findSubscriptionsByCustomer (happy path)', () => {
    it('should return list of subscriptions for a customer', async () => {
      subscriptionService.findSubscriptionsByCustomer.mockResolvedValue([
        mockResponse as unknown as Subscription,
      ]);
      const result =
        await controller.findSubscriptionsByCustomer('customer-uuid');
      expect(result).toEqual([mockResponse]);
      expect(
        subscriptionService.findSubscriptionsByCustomer,
      ).toHaveBeenCalledWith('customer-uuid');
    });
  });

  describe('updateSubscription (happy path)', () => {
    it('should return updated subscription', async () => {
      subscriptionService.updateSubscription.mockResolvedValue(
        mockResponse as unknown as Subscription,
      );
      const result = await controller.updateSubscription('test-id', updateDto);
      expect(result).toBe(mockResponse);
      expect(subscriptionService.updateSubscription).toHaveBeenCalledWith(
        'test-id',
        updateDto,
      );
    });
  });

  describe('cancelSubscription (happy path)', () => {
    it('should return cancelled subscription', async () => {
      subscriptionService.cancelSubscription.mockResolvedValue(
        mockResponse as unknown as Subscription,
      );
      const result = await controller.cancelSubscription('test-id', cancelDto);
      expect(result).toBe(mockResponse);
      expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith(
        'test-id',
        cancelDto,
      );
    });
  });

  // Negative scenarios
  describe('createSubscription (error handling)', () => {
    it('should propagate service errors', async () => {
      const error = new Error('Invalid input');
      subscriptionService.createSubscription.mockRejectedValue(error);
      await expect(controller.createSubscription(createDto)).rejects.toThrow(
        'Invalid input',
      );
    });
  });

  describe('findSubscriptionById (not found)', () => {
    it('should propagate not found error', async () => {
      const error = new Error('Subscription not found');
      subscriptionService.findSubscriptionById.mockRejectedValue(error);
      await expect(
        controller.findSubscriptionById('non-existent'),
      ).rejects.toThrow('Subscription not found');
    });
  });
});
