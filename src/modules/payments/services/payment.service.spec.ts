import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { AuthorizeNetService } from './authorizenet.service';
import { Transaction, TransactionType, TransactionStatus, PaymentMethodType } from '../entities';
import { CreatePaymentDto, CapturePaymentDto, RefundPaymentDto, CancelPaymentDto } from '../dto';

describe('PaymentService', () => {
  let service: PaymentService;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let authorizeNetService: jest.Mocked<AuthorizeNetService>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;

  const mockTransaction: Transaction = {
    id: 'test-transaction-id',
    merchantTransactionId: 'merchant-123',
    gatewayTransactionId: 'gateway-123',
    type: TransactionType.PURCHASE,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethodType.CREDIT_CARD,
    amount: 100.00,
    refundedAmount: 0,
    currency: 'USD',
    idempotencyKey: 'test-idempotency-key',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Transaction;

  const mockCreatePaymentDto: CreatePaymentDto = {
    amount: 100.00,
    currency: 'USD',
    paymentMethod: PaymentMethodType.CREDIT_CARD,
    creditCard: {
      cardNumber: '4111111111111111',
      expiryMonth: 12,
      expiryYear: 2025,
      cvv: '123',
      cardholderName: 'John Doe',
      billingAddress: {
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
        country: 'US',
      },
    },
    idempotencyKey: 'test-idempotency-key',
  };

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: AuthorizeNetService,
          useValue: {
            createPurchaseTransaction: jest.fn(),
            createAuthorizationTransaction: jest.fn(),
            captureTransaction: jest.fn(),
            refundTransaction: jest.fn(),
            voidTransaction: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    transactionRepository = module.get(getRepositoryToken(Transaction));
    authorizeNetService = module.get(AuthorizeNetService);
    dataSource = module.get(DataSource);
  });

  describe('When creating a purchase transaction', () => {
    it('Then should process payment successfully', async () => {
      // Arrange
      transactionRepository.findOne.mockResolvedValue(null);
      (queryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce({ ...mockTransaction, status: TransactionStatus.PROCESSING })
        .mockResolvedValueOnce(mockTransaction);
      authorizeNetService.createPurchaseTransaction.mockResolvedValue({
        success: true,
        transactionId: 'gateway-123',
        authCode: 'AUTH123',
        responseText: 'Success',
      });

      // Act
      const result = await service.createPurchase(mockCreatePaymentDto);

      // Assert
      expect(result).toEqual({
        transactionId: mockTransaction.id,
        status: TransactionStatus.COMPLETED,
        amount: 100.00,
        currency: 'USD',
        gatewayTransactionId: 'gateway-123',
        authCode: 'AUTH123',
        responseText: 'Success',
        createdAt: mockTransaction.createdAt,
      });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('Then should handle payment failure', async () => {
      // Arrange
      transactionRepository.findOne.mockResolvedValue(null);
      const failedTransaction = { ...mockTransaction, status: TransactionStatus.FAILED };
      (queryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce({ ...mockTransaction, status: TransactionStatus.PROCESSING })
        .mockResolvedValueOnce(failedTransaction);
      authorizeNetService.createPurchaseTransaction.mockResolvedValue({
        success: false,
        errorMessage: 'Payment declined',
      });

      // Act
      const result = await service.createPurchase(mockCreatePaymentDto);

      // Assert
      expect(result.status).toBe(TransactionStatus.FAILED);
      expect(result.responseText).toBe('Payment declined');
    });

    it('Then should handle idempotency conflict', async () => {
      // Arrange
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.PROCESSING,
      });

      // Act & Assert
      await expect(service.createPurchase(mockCreatePaymentDto)).rejects.toThrow(ConflictException);
    });

    it('Then should return existing transaction for duplicate idempotency key', async () => {
      // Arrange
      transactionRepository.findOne.mockResolvedValue(mockTransaction);

      // Act
      const result = await service.createPurchase(mockCreatePaymentDto);

      // Assert
      expect(result.transactionId).toBe(mockTransaction.id);
      expect(result.responseText).toBe('Duplicate request - returning existing transaction');
    });
  });

  describe('When creating an authorization transaction', () => {
    it('Then should authorize payment successfully', async () => {
      // Arrange
      transactionRepository.findOne.mockResolvedValue(null);
      const authTransaction = { ...mockTransaction, type: TransactionType.AUTHORIZATION };
      (queryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce({ ...authTransaction, status: TransactionStatus.PROCESSING })
        .mockResolvedValueOnce(authTransaction);
      authorizeNetService.createAuthorizationTransaction.mockResolvedValue({
        success: true,
        transactionId: 'gateway-123',
        authCode: 'AUTH123',
        responseText: 'Authorized',
      });

      // Act
      const result = await service.createAuthorization(mockCreatePaymentDto);

      // Assert
      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(result.authCode).toBe('AUTH123');
    });
  });

  describe('When capturing a payment', () => {
    const mockCaptureDto: CapturePaymentDto = {
      transactionId: 'test-transaction-id',
      amount: 50.00,
      idempotencyKey: 'capture-key',
    };

    it('Then should capture authorized payment successfully', async () => {
      // Arrange
      const authTransaction = { ...mockTransaction, type: TransactionType.AUTHORIZATION };
      transactionRepository.findOne
        .mockResolvedValueOnce(null) // For idempotency check
        .mockResolvedValueOnce(authTransaction); // For finding original transaction
      
      const captureTransaction = { 
        ...mockTransaction, 
        type: TransactionType.CAPTURE,
        amount: 50.00,
        parentTransactionId: authTransaction.id,
      };
      
      (queryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce({ ...captureTransaction, status: TransactionStatus.PROCESSING })
        .mockResolvedValueOnce(captureTransaction);
      
      authorizeNetService.captureTransaction.mockResolvedValue({
        success: true,
        transactionId: 'capture-gateway-123',
        responseText: 'Captured',
      });

      // Act
      const result = await service.capturePayment(mockCaptureDto);

      // Assert
      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(result.amount).toBe(50.00);
    });

    it('Then should reject capture of non-authorization transaction', async () => {
      // Arrange
      transactionRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTransaction); // Purchase transaction

      // Act & Assert
      await expect(service.capturePayment(mockCaptureDto)).rejects.toThrow(BadRequestException);
    });

    it('Then should reject capture of incomplete transaction', async () => {
      // Arrange
      const incompleteTransaction = { 
        ...mockTransaction, 
        type: TransactionType.AUTHORIZATION,
        status: TransactionStatus.FAILED,
      };
      transactionRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(incompleteTransaction);

      // Act & Assert
      await expect(service.capturePayment(mockCaptureDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('When refunding a payment', () => {
    const mockRefundDto: RefundPaymentDto = {
      transactionId: 'test-transaction-id',
      amount: 25.00,
      reason: 'Customer request',
      idempotencyKey: 'refund-key',
    };

    it('Then should process partial refund successfully', async () => {
      // Arrange
      transactionRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTransaction);
      
      const refundTransaction = {
        ...mockTransaction,
        type: TransactionType.REFUND,
        amount: 25.00,
        parentTransactionId: mockTransaction.id,
      };
      
      (queryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce({ ...refundTransaction, status: TransactionStatus.PROCESSING })
        .mockResolvedValueOnce(refundTransaction)
        .mockResolvedValueOnce({ ...mockTransaction, refundedAmount: 25.00, status: TransactionStatus.PARTIALLY_REFUNDED });
      
      authorizeNetService.refundTransaction.mockResolvedValue({
        success: true,
        transactionId: 'refund-gateway-123',
        responseText: 'Refunded',
      });

      // Act
      const result = await service.refundPayment(mockRefundDto);

      // Assert
      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(result.amount).toBe(25.00);
    });

    it('Then should reject refund exceeding available amount', async () => {
      // Arrange
      const partiallyRefundedTransaction = {
        ...mockTransaction,
        refundedAmount: 80.00,
      };
      transactionRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(partiallyRefundedTransaction);

      const excessiveRefundDto = { ...mockRefundDto, amount: 50.00 };

      // Act & Assert
      await expect(service.refundPayment(excessiveRefundDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('When cancelling a payment', () => {
    const mockCancelDto: CancelPaymentDto = {
      transactionId: 'test-transaction-id',
      reason: 'Order cancelled',
      idempotencyKey: 'cancel-key',
    };

    it('Then should cancel authorized payment successfully', async () => {
      // Arrange
      const authTransaction = { ...mockTransaction, type: TransactionType.AUTHORIZATION };
      transactionRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(authTransaction);
      
      const voidTransaction = {
        ...mockTransaction,
        type: TransactionType.VOID,
        parentTransactionId: authTransaction.id,
      };
      
      (queryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce({ ...voidTransaction, status: TransactionStatus.PROCESSING })
        .mockResolvedValueOnce(voidTransaction)
        .mockResolvedValueOnce({ ...authTransaction, status: TransactionStatus.CANCELLED });
      
      authorizeNetService.voidTransaction.mockResolvedValue({
        success: true,
        transactionId: 'void-gateway-123',
        responseText: 'Voided',
      });

      // Act
      const result = await service.cancelPayment(mockCancelDto);

      // Assert
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });

    it('Then should reject cancellation of purchase transaction', async () => {
      // Arrange
      transactionRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTransaction); // Purchase transaction

      // Act & Assert
      await expect(service.cancelPayment(mockCancelDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('When getting a transaction', () => {
    it('Then should return transaction successfully', async () => {
      // Arrange
      transactionRepository.findOne.mockResolvedValue(mockTransaction);

      // Act
      const result = await service.getTransaction('test-transaction-id');

      // Assert
      expect(result).toBe(mockTransaction);
    });

    it('Then should throw NotFoundException for non-existent transaction', async () => {
      // Arrange
      transactionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getTransaction('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('When handling database errors', () => {
    it('Then should rollback transaction on error', async () => {
      // Arrange
      transactionRepository.findOne.mockResolvedValue(null);
      (queryRunner.manager.save as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.createPurchase(mockCreatePaymentDto)).rejects.toThrow();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });
});
