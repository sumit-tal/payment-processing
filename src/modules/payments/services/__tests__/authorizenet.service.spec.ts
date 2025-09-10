import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { AuthorizeNetService } from '../authorizenet.service';
import {
  CreatePaymentDto,
  CapturePaymentDto,
  RefundPaymentDto,
  CancelPaymentDto,
} from '../../dto';
import { PaymentMethodType } from '@/database/entities';

// Mock the authorizenet module
jest.mock('authorizenet', () => ({
  APIContracts: {
    MerchantAuthenticationType: jest.fn().mockImplementation(() => ({
      setName: jest.fn(),
      setTransactionKey: jest.fn(),
    })),
    CreditCardType: jest.fn().mockImplementation(() => ({
      setCardNumber: jest.fn(),
      setExpirationDate: jest.fn(),
      setCardCode: jest.fn(),
    })),
    CustomerAddressType: jest.fn().mockImplementation(() => ({
      setFirstName: jest.fn(),
      setLastName: jest.fn(),
      setCompany: jest.fn(),
      setAddress: jest.fn(),
      setCity: jest.fn(),
      setState: jest.fn(),
      setZip: jest.fn(),
      setCountry: jest.fn(),
    })),
    PaymentType: jest.fn().mockImplementation(() => ({
      setCreditCard: jest.fn(),
    })),
    OrderType: jest.fn().mockImplementation(() => ({
      setInvoiceNumber: jest.fn(),
      setDescription: jest.fn(),
    })),
    TransactionRequestType: jest.fn().mockImplementation(() => ({
      setTransactionType: jest.fn(),
      setAmount: jest.fn(),
      setPayment: jest.fn(),
      setOrder: jest.fn(),
      setBillTo: jest.fn(),
      setRefTransId: jest.fn(),
    })),
    CreateTransactionRequest: jest.fn().mockImplementation(() => ({
      setMerchantAuthentication: jest.fn(),
      setTransactionRequest: jest.fn(),
      getJSON: jest.fn().mockReturnValue({}),
    })),
    CreateTransactionResponse: jest.fn().mockImplementation(() => ({
      getMessages: jest.fn().mockReturnValue({
        getResultCode: jest.fn(),
        getMessage: jest
          .fn()
          .mockReturnValue([
            { getText: jest.fn().mockReturnValue('Error message') },
          ]),
      }),
      getTransactionResponse: jest.fn(),
    })),
    TransactionTypeEnum: {
      AUTHCAPTURETRANSACTION: 'authCaptureTransaction',
      AUTHONLYTRANSACTION: 'authOnlyTransaction',
      PRIORAUTHCAPTURETRANSACTION: 'priorAuthCaptureTransaction',
      REFUNDTRANSACTION: 'refundTransaction',
      VOIDTRANSACTION: 'voidTransaction',
    },
    MessageTypeEnum: {
      OK: 'Ok',
    },
  },
  APIControllers: {
    CreateTransactionController: jest.fn().mockImplementation(() => ({
      setEnvironment: jest.fn(),
      execute: jest.fn(),
      getResponse: jest.fn(),
    })),
  },
  Constants: {
    endpoint: {
      sandbox: 'https://apitest.authorize.net/xml/v1/request.api',
      production: 'https://api.authorize.net/xml/v1/request.api',
    },
  },
}));

describe('AuthorizeNetService', () => {
  let service: AuthorizeNetService;
  let configService: jest.Mocked<ConfigService>;

  const mockCreatePaymentDto: CreatePaymentDto = {
    amount: 100.0,
    currency: 'USD',
    paymentMethod: PaymentMethodType.CREDIT_CARD,
    creditCard: {
      cardNumber: '4111111111111111',
      expiryMonth: 12,
      expiryYear: 2025,
      cvv: '123',
      cardholderName: 'John Doe',
      billingAddress: {
        firstName: 'John',
        lastName: 'Doe',
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
      providers: [
        AuthorizeNetService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'AUTHORIZENET_API_LOGIN_ID':
                  return 'test-api-login';
                case 'AUTHORIZENET_TRANSACTION_KEY':
                  return 'test-transaction-key';
                case 'AUTHORIZENET_ENVIRONMENT':
                  return 'sandbox';
                default:
                  return null;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthorizeNetService>(AuthorizeNetService);
    configService = module.get(ConfigService);
  });

  describe('When service is initialized', () => {
    it('Then should validate configuration successfully', () => {
      expect(service).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith(
        'AUTHORIZENET_API_LOGIN_ID',
      );
      expect(configService.get).toHaveBeenCalledWith(
        'AUTHORIZENET_TRANSACTION_KEY',
      );
    });

    it('Then should throw error for missing configuration', () => {
      configService.get.mockReturnValue(null);

      expect(() => {
        new AuthorizeNetService(configService);
      }).toThrow('Authorize.Net API credentials are required');
    });
  });

  describe('When creating purchase transaction', () => {
    it('Then should process successful payment', async () => {
      // Arrange
      const mockController = {
        setEnvironment: jest.fn(),
        execute: jest.fn(callback => callback()),
        getResponse: jest.fn().mockReturnValue({
          messages: {
            resultCode: 'Ok',
            message: [{ text: 'Success' }],
          },
          transactionResponse: {
            transId: 'gateway-123',
            authCode: 'AUTH123',
            responseCode: '1',
            messages: {
              message: [{ description: 'This transaction has been approved.' }],
            },
            avsResultCode: 'Y',
            cvvResultCode: 'M',
          },
        }),
      };

      const AuthorizeNet = require('authorizenet');
      AuthorizeNet.APIControllers.CreateTransactionController.mockReturnValue(
        mockController,
      );

      const mockResponse = {
        getMessages: jest.fn().mockReturnValue({
          getResultCode: jest.fn().mockReturnValue('Ok'),
        }),
        getTransactionResponse: jest.fn().mockReturnValue({
          getTransId: jest.fn().mockReturnValue('gateway-123'),
          getAuthCode: jest.fn().mockReturnValue('AUTH123'),
          getResponseCode: jest.fn().mockReturnValue('1'),
          getMessages: jest.fn().mockReturnValue({
            getMessage: jest.fn().mockReturnValue([
              {
                getDescription: jest
                  .fn()
                  .mockReturnValue('This transaction has been approved.'),
              },
            ]),
          }),
          getAvsResultCode: jest.fn().mockReturnValue('Y'),
          getCvvResultCode: jest.fn().mockReturnValue('M'),
        }),
      };

      AuthorizeNet.APIContracts.CreateTransactionResponse.mockReturnValue(
        mockResponse,
      );

      // Act
      const result =
        await service.createPurchaseTransaction(mockCreatePaymentDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('gateway-123');
      expect(result.authCode).toBe('AUTH123');
    });

    it('Then should handle payment failure', async () => {
      // Arrange
      const mockController = {
        setEnvironment: jest.fn(),
        execute: jest.fn(callback => callback()),
        getResponse: jest.fn().mockReturnValue({}),
      };

      const AuthorizeNet = require('authorizenet');
      AuthorizeNet.APIControllers.CreateTransactionController.mockReturnValue(
        mockController,
      );

      const mockResponse = {
        getMessages: jest.fn().mockReturnValue({
          getResultCode: jest.fn().mockReturnValue('Error'),
          getMessage: jest.fn().mockReturnValue([
            {
              getText: jest.fn().mockReturnValue('Transaction failed'),
            },
          ]),
        }),
      };

      AuthorizeNet.APIContracts.CreateTransactionResponse.mockReturnValue(
        mockResponse,
      );

      // Act
      const result =
        await service.createPurchaseTransaction(mockCreatePaymentDto);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Transaction failed');
    });
  });

  describe('When creating authorization transaction', () => {
    it('Then should authorize payment successfully', async () => {
      // Arrange
      const mockController = {
        setEnvironment: jest.fn(),
        execute: jest.fn(callback => callback()),
        getResponse: jest.fn().mockReturnValue({}),
      };

      const AuthorizeNet = require('authorizenet');
      AuthorizeNet.APIControllers.CreateTransactionController.mockReturnValue(
        mockController,
      );

      const mockResponse = {
        getMessages: jest.fn().mockReturnValue({
          getResultCode: jest.fn().mockReturnValue('Ok'),
        }),
        getTransactionResponse: jest.fn().mockReturnValue({
          getTransId: jest.fn().mockReturnValue('auth-123'),
          getAuthCode: jest.fn().mockReturnValue('AUTH456'),
          getResponseCode: jest.fn().mockReturnValue('1'),
          getMessages: jest.fn().mockReturnValue({
            getMessage: jest.fn().mockReturnValue([
              {
                getDescription: jest
                  .fn()
                  .mockReturnValue('This transaction has been approved.'),
              },
            ]),
          }),
          getAvsResultCode: jest.fn().mockReturnValue('Y'),
          getCvvResultCode: jest.fn().mockReturnValue('M'),
        }),
      };

      AuthorizeNet.APIContracts.CreateTransactionResponse.mockReturnValue(
        mockResponse,
      );

      // Act
      const result =
        await service.createAuthorizationTransaction(mockCreatePaymentDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('auth-123');
    });
  });

  describe('When capturing transaction', () => {
    const mockCaptureDto: CapturePaymentDto = {
      transactionId: 'auth-123',
      amount: 50.0,
      idempotencyKey: 'capture-key',
    };

    it('Then should capture payment successfully', async () => {
      // Arrange
      const mockController = {
        setEnvironment: jest.fn(),
        execute: jest.fn(callback => callback()),
        getResponse: jest.fn().mockReturnValue({}),
      };

      const AuthorizeNet = require('authorizenet');
      AuthorizeNet.APIControllers.CreateTransactionController.mockReturnValue(
        mockController,
      );

      const mockResponse = {
        getMessages: jest.fn().mockReturnValue({
          getResultCode: jest.fn().mockReturnValue('Ok'),
        }),
        getTransactionResponse: jest.fn().mockReturnValue({
          getTransId: jest.fn().mockReturnValue('capture-123'),
          getMessages: jest.fn().mockReturnValue({
            getMessage: jest.fn().mockReturnValue([
              {
                getDescription: jest
                  .fn()
                  .mockReturnValue('This transaction has been approved.'),
              },
            ]),
          }),
        }),
      };

      AuthorizeNet.APIContracts.CreateTransactionResponse.mockReturnValue(
        mockResponse,
      );

      // Act
      const result = await service.captureTransaction(mockCaptureDto, 100.0);

      // Assert
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('capture-123');
    });

    it('Then should reject capture amount exceeding authorized amount', async () => {
      // Arrange
      const excessiveCaptureDto = { ...mockCaptureDto, amount: 150.0 };

      // Act & Assert
      await expect(
        service.captureTransaction(excessiveCaptureDto, 100.0),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('When refunding transaction', () => {
    const mockRefundDto: RefundPaymentDto = {
      transactionId: 'purchase-123',
      amount: 25.0,
      reason: 'Customer request',
      idempotencyKey: 'refund-key',
    };

    it('Then should process refund successfully', async () => {
      // Arrange
      const mockController = {
        setEnvironment: jest.fn(),
        execute: jest.fn(callback => callback()),
        getResponse: jest.fn().mockReturnValue({}),
      };

      const AuthorizeNet = require('authorizenet');
      AuthorizeNet.APIControllers.CreateTransactionController.mockReturnValue(
        mockController,
      );

      const mockResponse = {
        getMessages: jest.fn().mockReturnValue({
          getResultCode: jest.fn().mockReturnValue('Ok'),
        }),
        getTransactionResponse: jest.fn().mockReturnValue({
          getTransId: jest.fn().mockReturnValue('refund-123'),
          getMessages: jest.fn().mockReturnValue({
            getMessage: jest.fn().mockReturnValue([
              {
                getDescription: jest
                  .fn()
                  .mockReturnValue('This transaction has been approved.'),
              },
            ]),
          }),
        }),
      };

      AuthorizeNet.APIContracts.CreateTransactionResponse.mockReturnValue(
        mockResponse,
      );

      // Act
      const result = await service.refundTransaction(
        mockRefundDto,
        100.0,
        '1111',
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('refund-123');
    });

    it('Then should reject refund amount exceeding original amount', async () => {
      // Arrange
      const excessiveRefundDto = { ...mockRefundDto, amount: 150.0 };

      // Act & Assert
      await expect(
        service.refundTransaction(excessiveRefundDto, 100.0, '1111'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('When voiding transaction', () => {
    const mockCancelDto: CancelPaymentDto = {
      transactionId: 'auth-123',
      reason: 'Order cancelled',
      idempotencyKey: 'void-key',
    };

    it('Then should void transaction successfully', async () => {
      // Arrange
      const mockController = {
        setEnvironment: jest.fn(),
        execute: jest.fn(callback => callback()),
        getResponse: jest.fn().mockReturnValue({}),
      };

      const AuthorizeNet = require('authorizenet');
      AuthorizeNet.APIControllers.CreateTransactionController.mockReturnValue(
        mockController,
      );

      const mockResponse = {
        getMessages: jest.fn().mockReturnValue({
          getResultCode: jest.fn().mockReturnValue('Ok'),
        }),
        getTransactionResponse: jest.fn().mockReturnValue({
          getTransId: jest.fn().mockReturnValue('void-123'),
          getMessages: jest.fn().mockReturnValue({
            getMessage: jest.fn().mockReturnValue([
              {
                getDescription: jest
                  .fn()
                  .mockReturnValue('This transaction has been approved.'),
              },
            ]),
          }),
        }),
      };

      AuthorizeNet.APIContracts.CreateTransactionResponse.mockReturnValue(
        mockResponse,
      );

      // Act
      const result = await service.voidTransaction(mockCancelDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('void-123');
    });
  });

  describe('When handling errors', () => {
    it('Then should handle service errors gracefully', async () => {
      // Arrange
      const AuthorizeNet = require('authorizenet');
      AuthorizeNet.APIControllers.CreateTransactionController.mockImplementation(
        () => {
          throw new Error('Network error');
        },
      );

      // Act & Assert
      await expect(
        service.createPurchaseTransaction(mockCreatePaymentDto),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
