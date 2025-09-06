import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SubscriptionService } from '../services/subscription.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CancelSubscriptionDto,
  SubscriptionResponseDto,
} from '../dto/subscription.dto';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subscription created successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or subscription plan not available',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment method not found',
  })
  async createSubscription(@Body() createSubscriptionDto: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    return await this.subscriptionService.createSubscription(createSubscriptionDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription details',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  async findSubscriptionById(@Param('id', ParseUUIDPipe) id: string): Promise<SubscriptionResponseDto> {
    return await this.subscriptionService.findSubscriptionById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get subscriptions by customer ID' })
  @ApiQuery({
    name: 'customerId',
    description: 'Customer ID to filter subscriptions',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of customer subscriptions',
    type: [SubscriptionResponseDto],
  })
  async findSubscriptionsByCustomer(
    @Query('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<SubscriptionResponseDto[]> {
    return await this.subscriptionService.findSubscriptionsByCustomer(customerId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update subscription' })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription updated successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async updateSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return await this.subscriptionService.updateSubscription(id, updateSubscriptionDto);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription cancelled successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Subscription already cancelled',
  })
  async cancelSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelSubscriptionDto: CancelSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return await this.subscriptionService.cancelSubscription(id, cancelSubscriptionDto);
  }
}
