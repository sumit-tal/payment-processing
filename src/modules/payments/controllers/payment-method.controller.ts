import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentMethodService } from '../services/payment-method.service';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  PaymentMethodResponseDto,
} from '../dto/payment-method.dto';

@ApiTags('payment-methods')
@Controller('payment-methods')
@ApiBearerAuth()
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new payment method' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Payment method created successfully',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid payment method data',
  })
  async createPaymentMethod(
    @Body(ValidationPipe) createPaymentMethodDto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    return this.paymentMethodService.createPaymentMethod(
      createPaymentMethodDto,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment method by ID' })
  @ApiParam({
    name: 'id',
    description: 'Payment method ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment method details',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment method not found',
  })
  async getPaymentMethod(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentMethodResponseDto> {
    return this.paymentMethodService.getPaymentMethodById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get payment methods by customer ID' })
  @ApiQuery({
    name: 'customerId',
    description: 'Customer ID to filter payment methods',
    type: 'string',
    format: 'uuid',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of customer payment methods',
    type: [PaymentMethodResponseDto],
  })
  async getPaymentMethodsByCustomer(
    @Query('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<PaymentMethodResponseDto[]> {
    return this.paymentMethodService.getPaymentMethodsByCustomer(customerId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update payment method' })
  @ApiParam({
    name: 'id',
    description: 'Payment method ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment method updated successfully',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment method not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async updatePaymentMethod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updatePaymentMethodDto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    return this.paymentMethodService.updatePaymentMethod(
      id,
      updatePaymentMethodDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete payment method' })
  @ApiParam({
    name: 'id',
    description: 'Payment method ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Payment method deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment method not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete default payment method',
  })
  async deletePaymentMethod(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.paymentMethodService.deletePaymentMethod(id);
  }
}
