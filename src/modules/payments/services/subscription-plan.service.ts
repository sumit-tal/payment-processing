import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan, SubscriptionPlanStatus } from '../entities/subscription-plan.entity';
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from '../dto/subscription-plan.dto';

@Injectable()
export class SubscriptionPlanService {
  private readonly logger = new Logger(SubscriptionPlanService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepository: Repository<SubscriptionPlan>,
  ) {}

  /**
   * Create a new subscription plan
   */
  async createPlan(createPlanDto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    this.logger.log(`Creating subscription plan: ${createPlanDto.name}`);

    try {
      const existingPlan = await this.subscriptionPlanRepository.findOne({
        where: { name: createPlanDto.name },
      });

      if (existingPlan) {
        throw new ConflictException(`Subscription plan with name '${createPlanDto.name}' already exists`);
      }

      const subscriptionPlan = new SubscriptionPlan({
        name: createPlanDto.name,
        description: createPlanDto.description,
        amount: createPlanDto.amount,
        currency: createPlanDto.currency || 'USD',
        billingInterval: createPlanDto.billingInterval,
        billingIntervalCount: createPlanDto.billingIntervalCount || 1,
        trialPeriodDays: createPlanDto.trialPeriodDays,
        setupFee: createPlanDto.setupFee || 0,
        maxBillingCycles: createPlanDto.maxBillingCycles,
        metadata: createPlanDto.metadata,
        status: SubscriptionPlanStatus.ACTIVE,
        isActive: true,
      });

      const savedPlan = await this.subscriptionPlanRepository.save(subscriptionPlan);
      
      this.logger.log(`Successfully created subscription plan with ID: ${savedPlan.id}`);
      return savedPlan;
    } catch (error) {
      this.logger.error(`Failed to create subscription plan: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all subscription plans with optional filtering
   */
  async findAllPlans(options?: {
    isActive?: boolean;
    status?: SubscriptionPlanStatus;
  }): Promise<SubscriptionPlan[]> {
    this.logger.log('Retrieving subscription plans');

    const queryBuilder = this.subscriptionPlanRepository.createQueryBuilder('plan');

    if (options?.isActive !== undefined) {
      queryBuilder.andWhere('plan.isActive = :isActive', { isActive: options.isActive });
    }

    if (options?.status) {
      queryBuilder.andWhere('plan.status = :status', { status: options.status });
    }

    queryBuilder.orderBy('plan.createdAt', 'DESC');

    return await queryBuilder.getMany();
  }

  /**
   * Get subscription plan by ID
   */
  async findPlanById(id: string): Promise<SubscriptionPlan> {
    this.logger.log(`Retrieving subscription plan with ID: ${id}`);

    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    }

    return plan;
  }

  /**
   * Get subscription plan by name
   */
  async findPlanByName(name: string): Promise<SubscriptionPlan> {
    this.logger.log(`Retrieving subscription plan with name: ${name}`);

    const plan = await this.subscriptionPlanRepository.findOne({
      where: { name },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan with name '${name}' not found`);
    }

    return plan;
  }

  /**
   * Update subscription plan
   */
  async updatePlan(id: string, updatePlanDto: UpdateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    this.logger.log(`Updating subscription plan with ID: ${id}`);

    try {
      const existingPlan = await this.findPlanById(id);

      // Update only provided fields
      Object.keys(updatePlanDto).forEach(key => {
        if (updatePlanDto[key] !== undefined) {
          existingPlan[key] = updatePlanDto[key];
        }
      });

      const updatedPlan = await this.subscriptionPlanRepository.save(existingPlan);
      
      this.logger.log(`Successfully updated subscription plan with ID: ${id}`);
      return updatedPlan;
    } catch (error) {
      this.logger.error(`Failed to update subscription plan: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Deactivate subscription plan (soft delete)
   */
  async deactivatePlan(id: string): Promise<SubscriptionPlan> {
    this.logger.log(`Deactivating subscription plan with ID: ${id}`);

    try {
      const plan = await this.findPlanById(id);
      
      plan.isActive = false;
      plan.status = SubscriptionPlanStatus.INACTIVE;

      const deactivatedPlan = await this.subscriptionPlanRepository.save(plan);
      
      this.logger.log(`Successfully deactivated subscription plan with ID: ${id}`);
      return deactivatedPlan;
    } catch (error) {
      this.logger.error(`Failed to deactivate subscription plan: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Archive subscription plan
   */
  async archivePlan(id: string): Promise<SubscriptionPlan> {
    this.logger.log(`Archiving subscription plan with ID: ${id}`);

    try {
      const plan = await this.findPlanById(id);
      
      plan.status = SubscriptionPlanStatus.ARCHIVED;

      const archivedPlan = await this.subscriptionPlanRepository.save(plan);
      
      this.logger.log(`Successfully archived subscription plan with ID: ${id}`);
      return archivedPlan;
    } catch (error) {
      this.logger.error(`Failed to archive subscription plan: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete subscription plan (hard delete - use with caution)
   */
  async deletePlan(id: string): Promise<void> {
    this.logger.log(`Deleting subscription plan with ID: ${id}`);

    try {
      const plan = await this.findPlanById(id);
      
      await this.subscriptionPlanRepository.remove(plan);
      
      this.logger.log(`Successfully deleted subscription plan with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete subscription plan: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if plan is available for new subscriptions
   */
  async isPlanAvailable(id: string): Promise<boolean> {
    const plan = await this.findPlanById(id);
    return plan.isActive && plan.status === SubscriptionPlanStatus.ACTIVE;
  }
}
