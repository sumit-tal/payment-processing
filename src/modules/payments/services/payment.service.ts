import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '@/database/entities';
import {
  CreatePaymentDto,
  CapturePaymentDto,
  RefundPaymentDto,
  CancelPaymentDto,
} from '../dto';
import { AuthorizeNetService, PaymentResult } from './authorizenet.service';
import { LoggingService } from '../../observability/services/logging.service';
import { MetricsService } from '../../observability/services/metrics.service';
import { TracingService } from '../../observability/services/tracing.service';
import { TracePayment } from '../../observability/decorators/trace.decorator';

export interface PaymentResponse {
  readonly transactionId: string;
  readonly status: TransactionStatus;
  readonly amount: number;
  readonly currency: string;
  readonly gatewayTransactionId?: string;
  readonly authCode?: string;
  readonly responseText?: string;
  readonly createdAt: Date;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly authorizeNetService: AuthorizeNetService,
    private readonly dataSource: DataSource,
    private readonly loggingService: LoggingService,
    private readonly metricsService: MetricsService,
    private readonly tracingService: TracingService,
  ) {}

  async createPurchase(
    paymentData: CreatePaymentDto,
  ): Promise<PaymentResponse> {
    return this.executeWithIdempotency(paymentData.idempotencyKey, async () => {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Create transaction record
        const transaction = new Transaction({
          merchantTransactionId: randomUUID(),
          type: TransactionType.PURCHASE,
          status: TransactionStatus.PROCESSING,
          paymentMethod: paymentData.paymentMethod,
          amount: paymentData.amount,
          currency: paymentData.currency,
          customerId: paymentData.customerId,
          orderId: paymentData.orderId,
          description: paymentData.description,
          metadata: paymentData.metadata,
          idempotencyKey: paymentData.idempotencyKey,
        });

        const savedTransaction = await queryRunner.manager.save(transaction);

        // Process payment with Authorize.Net
        const result =
          await this.authorizeNetService.createPurchaseTransaction(paymentData);

        // Update transaction with result
        savedTransaction.status = result.success
          ? TransactionStatus.COMPLETED
          : TransactionStatus.FAILED;
        savedTransaction.gatewayTransactionId = result.transactionId;
        savedTransaction.gatewayResponse = result.rawResponse;
        savedTransaction.failureReason = result.errorMessage;
        savedTransaction.processedAt = new Date();

        await queryRunner.manager.save(savedTransaction);
        await queryRunner.commitTransaction();

        this.logger.log(
          `Purchase transaction ${savedTransaction.id} ${result.success ? 'completed' : 'failed'}`,
        );

        return this.mapToPaymentResponse(savedTransaction, result);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error('Purchase transaction failed', error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    });
  }

  async createAuthorization(
    paymentData: CreatePaymentDto,
  ): Promise<PaymentResponse> {
    return this.executeWithIdempotency(paymentData.idempotencyKey, async () => {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const transaction = new Transaction({
          merchantTransactionId: randomUUID(),
          type: TransactionType.AUTHORIZATION,
          status: TransactionStatus.PROCESSING,
          paymentMethod: paymentData.paymentMethod,
          amount: paymentData.amount,
          currency: paymentData.currency,
          customerId: paymentData.customerId,
          orderId: paymentData.orderId,
          description: paymentData.description,
          metadata: paymentData.metadata,
          idempotencyKey: paymentData.idempotencyKey,
        });

        const savedTransaction = await queryRunner.manager.save(transaction);

        const result =
          await this.authorizeNetService.createAuthorizationTransaction(
            paymentData,
          );

        savedTransaction.status = result.success
          ? TransactionStatus.COMPLETED
          : TransactionStatus.FAILED;
        savedTransaction.gatewayTransactionId = result.transactionId;
        savedTransaction.gatewayResponse = result.rawResponse;
        savedTransaction.failureReason = result.errorMessage;
        savedTransaction.processedAt = new Date();

        await queryRunner.manager.save(savedTransaction);
        await queryRunner.commitTransaction();

        this.logger.log(
          `Authorization transaction ${savedTransaction.id} ${result.success ? 'completed' : 'failed'}`,
        );

        return this.mapToPaymentResponse(savedTransaction, result);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error('Authorization transaction failed', error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    });
  }

  async capturePayment(
    captureData: CapturePaymentDto,
  ): Promise<PaymentResponse> {
    return this.executeWithIdempotency(captureData.idempotencyKey, async () => {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Find original authorization transaction
        const originalTransaction = await this.findTransactionById(
          captureData.transactionId,
        );

        if (originalTransaction.type !== TransactionType.AUTHORIZATION) {
          throw new BadRequestException(
            'Can only capture authorization transactions',
          );
        }

        if (originalTransaction.status !== TransactionStatus.COMPLETED) {
          throw new BadRequestException(
            'Cannot capture transaction that is not completed',
          );
        }

        // Create capture transaction
        const captureTransaction = new Transaction({
          merchantTransactionId: randomUUID(),
          parentTransactionId: originalTransaction.id,
          type: TransactionType.CAPTURE,
          status: TransactionStatus.PROCESSING,
          paymentMethod: originalTransaction.paymentMethod,
          amount: captureData.amount || originalTransaction.amount,
          currency: originalTransaction.currency,
          customerId: originalTransaction.customerId,
          orderId: originalTransaction.orderId,
          description: captureData.description || 'Payment capture',
          idempotencyKey: captureData.idempotencyKey,
        });

        const savedCaptureTransaction =
          await queryRunner.manager.save(captureTransaction);

        const result = await this.authorizeNetService.captureTransaction(
          captureData,
          originalTransaction.amount,
          originalTransaction.gatewayTransactionId,
        );

        savedCaptureTransaction.status = result.success
          ? TransactionStatus.COMPLETED
          : TransactionStatus.FAILED;
        savedCaptureTransaction.gatewayTransactionId = result.transactionId;
        savedCaptureTransaction.gatewayResponse = result.rawResponse;
        savedCaptureTransaction.failureReason = result.errorMessage;
        savedCaptureTransaction.processedAt = new Date();

        await queryRunner.manager.save(savedCaptureTransaction);
        await queryRunner.commitTransaction();

        this.logger.log(
          `Capture transaction ${savedCaptureTransaction.id} ${result.success ? 'completed' : 'failed'}`,
        );

        return this.mapToPaymentResponse(savedCaptureTransaction, result);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error('Capture transaction failed', error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    });
  }

  async refundPayment(refundData: RefundPaymentDto): Promise<PaymentResponse> {
    return this.executeWithIdempotency(refundData.idempotencyKey, async () => {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const originalTransaction = await this.findTransactionById(
          refundData.transactionId,
        );

        if (!this.canRefundTransaction(originalTransaction)) {
          throw new BadRequestException('Transaction cannot be refunded');
        }

        const refundAmount = refundData.amount || originalTransaction.amount;
        const availableRefundAmount =
          originalTransaction.amount - originalTransaction.refundedAmount;

        if (refundAmount > availableRefundAmount) {
          throw new BadRequestException(
            'Refund amount exceeds available refund amount',
          );
        }

        const refundTransaction = new Transaction({
          merchantTransactionId: randomUUID(),
          parentTransactionId: originalTransaction.id,
          type: TransactionType.REFUND,
          status: TransactionStatus.PROCESSING,
          paymentMethod: originalTransaction.paymentMethod,
          amount: refundAmount,
          currency: originalTransaction.currency,
          customerId: originalTransaction.customerId,
          orderId: originalTransaction.orderId,
          description: refundData.reason || 'Payment refund',
          idempotencyKey: refundData.idempotencyKey,
        });

        const savedRefundTransaction =
          await queryRunner.manager.save(refundTransaction);

        // Extract last 4 digits from gateway response (simplified for demo)
        const lastFourDigits = this.extractLastFourDigits(
          originalTransaction.gatewayResponse,
        );

        const result = await this.authorizeNetService.refundTransaction(
          refundData,
          originalTransaction.amount,
          lastFourDigits,
        );

        savedRefundTransaction.status = result.success
          ? TransactionStatus.COMPLETED
          : TransactionStatus.FAILED;
        savedRefundTransaction.gatewayTransactionId = result.transactionId;
        savedRefundTransaction.gatewayResponse = result.rawResponse;
        savedRefundTransaction.failureReason = result.errorMessage;
        savedRefundTransaction.processedAt = new Date();

        await queryRunner.manager.save(savedRefundTransaction);

        // Update original transaction refunded amount
        if (result.success) {
          originalTransaction.refundedAmount += refundAmount;
          if (
            originalTransaction.refundedAmount >= originalTransaction.amount
          ) {
            originalTransaction.status = TransactionStatus.REFUNDED;
          } else {
            originalTransaction.status = TransactionStatus.PARTIALLY_REFUNDED;
          }
          await queryRunner.manager.save(originalTransaction);
        }

        await queryRunner.commitTransaction();

        this.logger.log(
          `Refund transaction ${savedRefundTransaction.id} ${result.success ? 'completed' : 'failed'}`,
        );

        return this.mapToPaymentResponse(savedRefundTransaction, result);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error('Refund transaction failed', error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    });
  }

  async cancelPayment(cancelData: CancelPaymentDto): Promise<PaymentResponse> {
    return this.executeWithIdempotency(cancelData.idempotencyKey, async () => {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const originalTransaction = await this.findTransactionById(
          cancelData.transactionId,
        );

        if (!this.canCancelTransaction(originalTransaction)) {
          throw new BadRequestException('Transaction cannot be cancelled');
        }

        const voidTransaction = new Transaction({
          merchantTransactionId: randomUUID(),
          parentTransactionId: originalTransaction.id,
          type: TransactionType.VOID,
          status: TransactionStatus.PROCESSING,
          paymentMethod: originalTransaction.paymentMethod,
          amount: originalTransaction.amount,
          currency: originalTransaction.currency,
          customerId: originalTransaction.customerId,
          orderId: originalTransaction.orderId,
          description: cancelData.reason || 'Payment cancellation',
          idempotencyKey: cancelData.idempotencyKey,
        });

        const savedVoidTransaction =
          await queryRunner.manager.save(voidTransaction);

        const result = await this.authorizeNetService.voidTransaction(
          cancelData,
          originalTransaction.gatewayTransactionId,
        );

        savedVoidTransaction.status = result.success
          ? TransactionStatus.COMPLETED
          : TransactionStatus.FAILED;
        savedVoidTransaction.gatewayTransactionId = result.transactionId;
        savedVoidTransaction.gatewayResponse = result.rawResponse;
        savedVoidTransaction.failureReason = result.errorMessage;
        savedVoidTransaction.processedAt = new Date();

        await queryRunner.manager.save(savedVoidTransaction);

        // Update original transaction status
        if (result.success) {
          originalTransaction.status = TransactionStatus.CANCELLED;
          await queryRunner.manager.save(originalTransaction);
        }

        await queryRunner.commitTransaction();

        this.logger.log(
          `Void transaction ${savedVoidTransaction.id} ${result.success ? 'completed' : 'failed'}`,
        );

        return this.mapToPaymentResponse(savedVoidTransaction, result);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error('Void transaction failed', error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    });
  }

  async getTransaction(transactionId: string): Promise<Transaction> {
    return this.findTransactionById(transactionId);
  }

  private async executeWithIdempotency<T>(
    idempotencyKey: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    // Check if transaction with this idempotency key already exists
    const existingTransaction = await this.transactionRepository.findOne({
      where: { idempotencyKey },
    });

    if (existingTransaction) {
      if (existingTransaction.status === TransactionStatus.PROCESSING) {
        throw new ConflictException('Transaction is already being processed');
      }

      // Return existing completed transaction
      const result: PaymentResult = {
        success: existingTransaction.status === TransactionStatus.COMPLETED,
        transactionId: existingTransaction.gatewayTransactionId,
        responseText: 'Duplicate request - returning existing transaction',
      };

      return this.mapToPaymentResponse(existingTransaction, result) as T;
    }

    return operation();
  }

  private async findTransactionById(
    transactionId: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  private canRefundTransaction(transaction: Transaction): boolean {
    return (
      [
        TransactionStatus.COMPLETED,
        TransactionStatus.PARTIALLY_REFUNDED,
      ].includes(transaction.status) &&
      [TransactionType.PURCHASE, TransactionType.CAPTURE].includes(
        transaction.type,
      )
    );
  }

  private canCancelTransaction(transaction: Transaction): boolean {
    return (
      transaction.status === TransactionStatus.COMPLETED &&
      transaction.type === TransactionType.AUTHORIZATION
    );
  }

  private extractLastFourDigits(gatewayResponse: any): string {
    // Simplified implementation - in real scenario, you'd extract from gateway response
    // or store masked card number during transaction creation
    return 'XXXX';
  }

  private mapToPaymentResponse(
    transaction: Transaction,
    result: PaymentResult,
  ): PaymentResponse {
    return {
      transactionId: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      gatewayTransactionId: transaction.gatewayTransactionId,
      authCode: result.authCode,
      responseText: result.responseText || transaction.failureReason,
      createdAt: transaction.createdAt,
    };
  }
}
