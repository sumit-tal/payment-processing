import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService, PaymentResponse } from '../services';
import { CreatePaymentDto, CapturePaymentDto, RefundPaymentDto, CancelPaymentDto } from '../dto';
import { Transaction, TransactionType, TransactionStatus, PaymentMethodType } from '../entities';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: jest.Mocked<PaymentService>;

  const mockPaymentResponse: PaymentResponse = {
    transactionId: 'test-transaction-id',
    status: TransactionStatus.COMPLETED,
    amount: 100.00,
    currency: 'USD',
    gatewayTransactionId: 'gateway-123',
    authCode: 'AUTH123',
    responseText: 'Success',
    createdAt: new Date(),
  };

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
    idempotencyKey: 'test-key',
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
    idempotencyKey: 'test-key',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            createPurchase: jest.fn(),
            createAuthorization: jest.fn(),
            capturePayment: jest.fn(),
            refundPayment: jest.fn(),
            cancelPayment: jest.fn(),
            getTransaction: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    paymentService = module.get(PaymentService);
  });

  describe('When creating a purchase', () => {
    it('Then should return payment response', async () => {
      // Arrange
      paymentService.createPurchase.mockResolvedValue(mockPaymentResponse);

      // Act
      const result = await controller.createPurchase(mockCreatePaymentDto);

      // Assert
      expect(result).toBe(mockPaymentResponse);
      expect(paymentService.createPurchase).toHaveBeenCalledWith(mockCreatePaymentDto);
    });
  });

  describe('When creating an authorization', () => {
    it('Then should return payment response', async () => {
      // Arrange
      const authResponse = { ...mockPaymentResponse, status: TransactionStatus.COMPLETED };
      paymentService.createAuthorization.mockResolvedValue(authResponse);

      // Act
      const result = await controller.createAuthorization(mockCreatePaymentDto);

      // Assert
      expect(result).toBe(authResponse);
      expect(paymentService.createAuthorization).toHaveBeenCalledWith(mockCreatePaymentDto);
    });
  });

  describe('When capturing a payment', () => {
    it('Then should return capture response', async () => {
      // Arrange
      const captureDto: CapturePaymentDto = {
        transactionId: 'test-transaction-id',
        amount: 50.00,
        idempotencyKey: 'capture-key',
      };
      const captureResponse = { ...mockPaymentResponse, amount: 50.00 };
      paymentService.capturePayment.mockResolvedValue(captureResponse);

      // Act
      const result = await controller.capturePayment(captureDto);

      // Assert
      expect(result).toBe(captureResponse);
      expect(paymentService.capturePayment).toHaveBeenCalledWith(captureDto);
    });
  });

  describe('When refunding a payment', () => {
    it('Then should return refund response', async () => {
      // Arrange
      const refundDto: RefundPaymentDto = {
        transactionId: 'test-transaction-id',
        amount: 25.00,
        reason: 'Customer request',
        idempotencyKey: 'refund-key',
      };
      const refundResponse = { ...mockPaymentResponse, amount: 25.00 };
      paymentService.refundPayment.mockResolvedValue(refundResponse);

      // Act
      const result = await controller.refundPayment(refundDto);

      // Assert
      expect(result).toBe(refundResponse);
      expect(paymentService.refundPayment).toHaveBeenCalledWith(refundDto);
    });
  });

  describe('When cancelling a payment', () => {
    it('Then should return cancellation response', async () => {
      // Arrange
      const cancelDto: CancelPaymentDto = {
        transactionId: 'test-transaction-id',
        reason: 'Order cancelled',
        idempotencyKey: 'cancel-key',
      };
      paymentService.cancelPayment.mockResolvedValue(mockPaymentResponse);

      // Act
      const result = await controller.cancelPayment(cancelDto);

      // Assert
      expect(result).toBe(mockPaymentResponse);
      expect(paymentService.cancelPayment).toHaveBeenCalledWith(cancelDto);
    });
  });

  describe('When getting a transaction', () => {
    it('Then should return transaction details', async () => {
      // Arrange
      paymentService.getTransaction.mockResolvedValue(mockTransaction);

      // Act
      const result = await controller.getTransaction('test-transaction-id');

      // Assert
      expect(result).toBe(mockTransaction);
      expect(paymentService.getTransaction).toHaveBeenCalledWith('test-transaction-id');
    });
  });
});
