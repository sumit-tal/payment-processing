import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentService, PaymentResponse } from '../services';
import {
  CreatePaymentDto,
  CapturePaymentDto,
  RefundPaymentDto,
  CancelPaymentDto,
} from '../dto';
import { Transaction } from '@/database/entities';

@ApiTags('payments')
@Controller('payments')
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('purchase')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a purchase transaction (Auth + Capture)',
    description: 'Process a payment by authorizing and capturing funds in a single step',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment processed successfully',
    type: 'PaymentResponse',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid payment data',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate transaction (idempotency conflict)',
  })
  async createPurchase(
    @Body(ValidationPipe) createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentService.createPurchase(createPaymentDto);
  }

  @Post('authorize')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an authorization transaction',
    description: 'Authorize funds without capturing them immediately',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment authorized successfully',
    type: 'PaymentResponse',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid payment data',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate transaction (idempotency conflict)',
  })
  async createAuthorization(
    @Body(ValidationPipe) createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentService.createAuthorization(createPaymentDto);
  }

  @Post('capture')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Capture an authorized payment',
    description: 'Capture funds from a previously authorized transaction',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment captured successfully',
    type: 'PaymentResponse',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid capture data or transaction cannot be captured',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate capture request (idempotency conflict)',
  })
  async capturePayment(
    @Body(ValidationPipe) capturePaymentDto: CapturePaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentService.capturePayment(capturePaymentDto);
  }

  @Post('refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refund a payment (full or partial)',
    description: 'Process a refund for a completed transaction',
  })
  @ApiResponse({
    status: 200,
    description: 'Refund processed successfully',
    type: 'PaymentResponse',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid refund data or transaction cannot be refunded',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate refund request (idempotency conflict)',
  })
  async refundPayment(
    @Body(ValidationPipe) refundPaymentDto: RefundPaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentService.refundPayment(refundPaymentDto);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel/void an authorized payment',
    description: 'Cancel an authorized transaction before it is captured',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment cancelled successfully',
    type: 'PaymentResponse',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid cancellation data or transaction cannot be cancelled',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate cancellation request (idempotency conflict)',
  })
  async cancelPayment(
    @Body(ValidationPipe) cancelPaymentDto: CancelPaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentService.cancelPayment(cancelPaymentDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get transaction details',
    description: 'Retrieve details of a specific transaction',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully',
    type: Transaction,
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async getTransaction(@Param('id') id: string): Promise<Transaction> {
    return this.paymentService.getTransaction(id);
  }
}
