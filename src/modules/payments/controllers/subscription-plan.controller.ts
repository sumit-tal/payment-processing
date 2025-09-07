import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  ParseUUIDPipe,
  ParseBoolPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SubscriptionPlanService } from '../services/subscription-plan.service';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
  SubscriptionPlanResponseDto,
} from '../dto/subscription-plan.dto';
import { SubscriptionPlanStatus } from '@/database/entities/subscription-plan.entity';

@ApiTags('Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionPlanController {
  constructor(private readonly subscriptionPlanService: SubscriptionPlanService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new subscription plan' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subscription plan created successfully',
    type: SubscriptionPlanResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Subscription plan with this name already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async createPlan(@Body() createPlanDto: CreateSubscriptionPlanDto): Promise<SubscriptionPlanResponseDto> {
    return await this.subscriptionPlanService.createPlan(createPlanDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscription plans' })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: SubscriptionPlanStatus,
    description: 'Filter by plan status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of subscription plans',
    type: [SubscriptionPlanResponseDto],
  })
  async findAllPlans(
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
    @Query('status', new ParseEnumPipe(SubscriptionPlanStatus, { optional: true })) status?: SubscriptionPlanStatus,
  ): Promise<SubscriptionPlanResponseDto[]> {
    return await this.subscriptionPlanService.findAllPlans({ isActive, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription plan by ID' })
  @ApiParam({
    name: 'id',
    description: 'Subscription plan ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription plan details',
    type: SubscriptionPlanResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription plan not found',
  })
  async findPlanById(@Param('id', ParseUUIDPipe) id: string): Promise<SubscriptionPlanResponseDto> {
    return await this.subscriptionPlanService.findPlanById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update subscription plan' })
  @ApiParam({
    name: 'id',
    description: 'Subscription plan ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription plan updated successfully',
    type: SubscriptionPlanResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription plan not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlanDto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return await this.subscriptionPlanService.updatePlan(id, updatePlanDto);
  }

  @Put(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate subscription plan' })
  @ApiParam({
    name: 'id',
    description: 'Subscription plan ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription plan deactivated successfully',
    type: SubscriptionPlanResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription plan not found',
  })
  async deactivatePlan(@Param('id', ParseUUIDPipe) id: string): Promise<SubscriptionPlanResponseDto> {
    return await this.subscriptionPlanService.deactivatePlan(id);
  }

  @Put(':id/archive')
  @ApiOperation({ summary: 'Archive subscription plan' })
  @ApiParam({
    name: 'id',
    description: 'Subscription plan ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription plan archived successfully',
    type: SubscriptionPlanResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription plan not found',
  })
  async archivePlan(@Param('id', ParseUUIDPipe) id: string): Promise<SubscriptionPlanResponseDto> {
    return await this.subscriptionPlanService.archivePlan(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription plan (permanent)' })
  @ApiParam({
    name: 'id',
    description: 'Subscription plan ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Subscription plan deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription plan not found',
  })
  async deletePlan(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.subscriptionPlanService.deletePlan(id);
  }
}
