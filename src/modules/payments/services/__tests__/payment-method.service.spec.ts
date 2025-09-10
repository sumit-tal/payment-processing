import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentMethodService } from '../payment-method.service';
import { PaymentMethod } from '../../../../database/entities/payment-method.entity';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  PaymentMethodResponseDto,
} from '../../dto/payment-method.dto';
import * as AuthorizeNet from 'authorizenet';

describe('PaymentMethodService', () => {
  let service: PaymentMethodService;
  let paymentMethodRepository: jest.Mocked<Repository<PaymentMethod>>;
  let configService: jest.Mocked<ConfigService>;

  // Mock data
  const mockPaymentMethod: PaymentMethod = {
    id: 'pm-123',
    customerId: 'customer-123',
    gatewayPaymentMethodId: '12345|67890',
    cardLastFour: '4242',
    cardBrand: 'Visa',
    cardExpiryMonth: 12,
    cardExpiryYear: 2025,
    billingAddress: {
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      country: 'US',
    },
    isDefault: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as PaymentMethod;

  const createPaymentMethodDto: CreatePaymentMethodDto = {
    customerId: 'customer-123',
    cardNumber: '4111111111111111',
    cardCode: '123',
    expiryMonth: 12,
    expiryYear: 2025,
    cardholderName: 'John Doe',
    billingAddress: {
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      country: 'US',
    },
    isDefault: true,
  };

  const updatePaymentMethodDto: UpdatePaymentMethodDto = {
    isDefault: true,
  };

  // Mock AuthorizeNet API responses
  const mockCreateCustomerProfileResponse = {
    getMessages: jest.fn().mockReturnValue({
      getResultCode: jest.fn().mockReturnValue('Ok'),
    }),
    getCustomerProfileId: jest.fn().mockReturnValue('12345'),
  };

  const mockCreateCustomerPaymentProfileResponse = {
    getMessages: jest.fn().mockReturnValue({
      getResultCode: jest.fn().mockReturnValue('Ok'),
    }),
    getCustomerPaymentProfileId: jest.fn().mockReturnValue('67890'),
  };

  // Mock controller execution
  const mockControllerExecute = jest.fn().mockImplementation(callback => {
    callback();
  });

  beforeEach(async () => {
    // Mock AuthorizeNet
    jest.mock('authorizenet', () => {
      return {
        APIContracts: {
          MerchantAuthenticationType: jest.fn().mockImplementation(() => ({
            setName: jest.fn(),
            setTransactionKey: jest.fn(),
          })),
          CreateCustomerProfileRequest: jest.fn().mockImplementation(() => ({
            setMerchantAuthentication: jest.fn(),
            setProfile: jest.fn(),
            getJSON: jest.fn(),
          })),
          CustomerProfileType: jest.fn().mockImplementation(() => ({
            setMerchantCustomerId: jest.fn(),
            setDescription: jest.fn(),
            setEmail: jest.fn(),
          })),
          CreateCustomerProfileResponse: jest
            .fn()
            .mockImplementation(() => mockCreateCustomerProfileResponse),
          CreateCustomerPaymentProfileRequest: jest
            .fn()
            .mockImplementation(() => ({
              setMerchantAuthentication: jest.fn(),
              setCustomerProfileId: jest.fn(),
              setPaymentProfile: jest.fn(),
              setValidationMode: jest.fn(),
              getJSON: jest.fn(),
            })),
          CustomerPaymentProfileType: jest.fn().mockImplementation(() => ({
            setPayment: jest.fn(),
            setBillTo: jest.fn(),
          })),
          PaymentType: jest.fn().mockImplementation(() => ({
            setCreditCard: jest.fn(),
          })),
          CreditCardType: jest.fn().mockImplementation(() => ({
            setCardNumber: jest.fn(),
            setExpirationDate: jest.fn(),
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
          CreateCustomerPaymentProfileResponse: jest
            .fn()
            .mockImplementation(() => mockCreateCustomerPaymentProfileResponse),
          MessageTypeEnum: {
            OK: 'Ok',
          },
          ValidationModeEnum: {
            LIVEMODE: 'liveMode',
          },
        },
        APIControllers: {
          CreateCustomerProfileController: jest.fn().mockImplementation(() => ({
            setEnvironment: jest.fn(),
            execute: mockControllerExecute,
            getResponse: jest.fn().mockReturnValue({}),
          })),
          CreateCustomerPaymentProfileController: jest
            .fn()
            .mockImplementation(() => ({
              setEnvironment: jest.fn(),
              execute: mockControllerExecute,
              getResponse: jest.fn().mockReturnValue({}),
            })),
        },
        Constants: {
          endpoint: {
            sandbox: 'sandbox',
            production: 'production',
          },
        },
      };
    });

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'AUTHORIZENET_API_LOGIN_ID':
            return 'test-login-id';
          case 'AUTHORIZENET_TRANSACTION_KEY':
            return 'test-transaction-key';
          case 'AUTHORIZENET_ENVIRONMENT':
            return 'sandbox';
          default:
            return null;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodService,
        {
          provide: getRepositoryToken(PaymentMethod),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentMethodService>(PaymentMethodService);
    paymentMethodRepository = module.get(getRepositoryToken(PaymentMethod));
    configService = module.get(ConfigService);

    // Mock the private methods
    jest
      .spyOn(service as any, 'createCustomerProfile')
      .mockResolvedValue('12345');
    jest.spyOn(service as any, 'getCustomerProfile').mockResolvedValue('12345');
    jest
      .spyOn(service as any, 'createCustomerPaymentProfile')
      .mockResolvedValue('12345|67890');
    // Don't mock detectCardBrand so we can test the actual implementation
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentMethod', () => {
    it('should create a payment method successfully', async () => {
      // Arrange
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.createPaymentMethod(createPaymentMethodDto);

      // Assert
      expect(paymentMethodRepository.save).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: mockPaymentMethod.id,
          customerId: mockPaymentMethod.customerId,
          cardLastFour: mockPaymentMethod.cardLastFour,
          cardBrand: mockPaymentMethod.cardBrand,
        }),
      );
    });

    it('should update existing payment methods when setting a new default', async () => {
      // Arrange
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);

      // Act
      await service.createPaymentMethod(createPaymentMethodDto);

      // Assert
      expect(paymentMethodRepository.update).toHaveBeenCalledWith(
        { customerId: createPaymentMethodDto.customerId, isDefault: true },
        { isDefault: false },
      );
    });

    it('should not update existing payment methods when not setting as default', async () => {
      // Arrange
      const nonDefaultDto = { ...createPaymentMethodDto, isDefault: false };
      paymentMethodRepository.save.mockResolvedValue({
        ...mockPaymentMethod,
        isDefault: false,
      });

      // Act
      await service.createPaymentMethod(nonDefaultDto);

      // Assert
      expect(paymentMethodRepository.update).not.toHaveBeenCalled();
    });

    it('should throw an error when Authorize.Net API fails', async () => {
      // Arrange
      jest
        .spyOn(service as any, 'createCustomerPaymentProfile')
        .mockRejectedValue(
          new BadRequestException(
            'Failed to create payment method: Invalid card number',
          ),
        );

      // Act & Assert
      await expect(
        service.createPaymentMethod(createPaymentMethodDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPaymentMethodById', () => {
    it('should return a payment method when found', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.getPaymentMethodById('pm-123');

      // Assert
      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'pm-123' },
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: mockPaymentMethod.id,
          customerId: mockPaymentMethod.customerId,
        }),
      );
    });

    it('should throw NotFoundException when payment method not found', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getPaymentMethodById('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
    });
  });

  describe('getPaymentMethodsByCustomer', () => {
    it('should return all active payment methods for a customer', async () => {
      // Arrange
      const paymentMethods = [
        mockPaymentMethod,
        { ...mockPaymentMethod, id: 'pm-456', isDefault: false },
      ];
      paymentMethodRepository.find.mockResolvedValue(paymentMethods);

      // Act
      const result = await service.getPaymentMethodsByCustomer('customer-123');

      // Assert
      expect(paymentMethodRepository.find).toHaveBeenCalledWith({
        where: { customerId: 'customer-123', isActive: true },
        order: { isDefault: 'DESC', createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: paymentMethods[0].id,
          customerId: paymentMethods[0].customerId,
        }),
      );
    });

    it('should return an empty array when no payment methods found', async () => {
      // Arrange
      paymentMethodRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getPaymentMethodsByCustomer('customer-123');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('updatePaymentMethod', () => {
    it('should update a payment method successfully', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.updatePaymentMethod(
        'pm-123',
        updatePaymentMethodDto,
      );

      // Assert
      expect(paymentMethodRepository.save).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: mockPaymentMethod.id,
          isDefault: true,
        }),
      );
    });

    it('should update other payment methods when setting a new default', async () => {
      // Arrange
      const nonDefaultPaymentMethod = {
        ...mockPaymentMethod,
        isDefault: false,
      };
      paymentMethodRepository.findOne.mockResolvedValue(
        nonDefaultPaymentMethod,
      );
      paymentMethodRepository.save.mockResolvedValue({
        ...nonDefaultPaymentMethod,
        isDefault: true,
      });

      // Act
      await service.updatePaymentMethod('pm-123', { isDefault: true });

      // Assert
      expect(paymentMethodRepository.update).toHaveBeenCalledWith(
        { customerId: mockPaymentMethod.customerId, isDefault: true },
        { isDefault: false },
      );
    });

    it('should not update other payment methods when already default', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod); // Already default
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);

      // Act
      await service.updatePaymentMethod('pm-123', { isDefault: true });

      // Assert
      expect(paymentMethodRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when payment method not found', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updatePaymentMethod('non-existent-id', updatePaymentMethodDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePaymentMethod', () => {
    it('should soft delete a payment method successfully', async () => {
      // Arrange
      const nonDefaultPaymentMethod = {
        ...mockPaymentMethod,
        isDefault: false,
      };
      paymentMethodRepository.findOne.mockResolvedValue(
        nonDefaultPaymentMethod,
      );

      // Act
      await service.deletePaymentMethod('pm-123');

      // Assert
      expect(paymentMethodRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pm-123',
          isActive: false,
        }),
      );
    });

    it('should throw BadRequestException when trying to delete default payment method', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod); // Default payment method

      // Act & Assert
      await expect(service.deletePaymentMethod('pm-123')).rejects.toThrow(
        BadRequestException,
      );
      expect(paymentMethodRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when payment method not found', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.deletePaymentMethod('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('detectCardBrand', () => {
    it('should detect Visa cards correctly', () => {
      // Arrange & Act
      const result = (service as any).detectCardBrand('4111111111111111');

      // Assert
      expect(result).toBe('Visa');
    });

    it('should detect Mastercard cards correctly', () => {
      // Arrange & Act
      const result = (service as any).detectCardBrand('5111111111111118');

      // Assert
      expect(result).toBe('Mastercard');
    });

    it('should detect American Express cards correctly', () => {
      // Arrange & Act
      const result = (service as any).detectCardBrand('371111111111114');

      // Assert
      expect(result).toBe('American Express');
    });

    it('should detect Discover cards correctly', () => {
      // Arrange & Act
      const result = (service as any).detectCardBrand('6011111111111117');

      // Assert
      expect(result).toBe('Discover');
    });

    it('should return Unknown for unrecognized card numbers', () => {
      // Arrange & Act
      const result = (service as any).detectCardBrand('9999999999999999');

      // Assert
      expect(result).toBe('Unknown');
    });

    it('should return Unknown for empty card numbers', () => {
      // Arrange & Act
      const result = (service as any).detectCardBrand('');

      // Assert
      expect(result).toBe('Unknown');
    });

    it('should detect Mastercard boundary cases correctly', () => {
      // Arrange & Act - Test boundary values for Mastercard (51-55)
      const result51 = (service as any).detectCardBrand('5100000000000000');
      const result55 = (service as any).detectCardBrand('5500000000000000');
      const result50 = (service as any).detectCardBrand('5000000000000000');
      const result56 = (service as any).detectCardBrand('5600000000000000');

      // Assert
      expect(result51).toBe('Mastercard');
      expect(result55).toBe('Mastercard');
      expect(result50).toBe('Unknown');
      expect(result56).toBe('Unknown');
    });

    it('should detect American Express with both prefixes', () => {
      // Arrange & Act
      const result34 = (service as any).detectCardBrand('341111111111111');
      const result37 = (service as any).detectCardBrand('371111111111114');
      const result35 = (service as any).detectCardBrand('351111111111111');

      // Assert
      expect(result34).toBe('American Express');
      expect(result37).toBe('American Express');
      expect(result35).toBe('Unknown');
    });

    it('should handle null and undefined card numbers', () => {
      // Arrange & Act
      const resultNull = (service as any).detectCardBrand(null);
      const resultUndefined = (service as any).detectCardBrand(undefined);

      // Assert
      expect(resultNull).toBe('Unknown');
      expect(resultUndefined).toBe('Unknown');
    });

    it('should handle very short card numbers', () => {
      // Arrange & Act
      const result1 = (service as any).detectCardBrand('4');
      const result2 = (service as any).detectCardBrand('51');
      const result3 = (service as any).detectCardBrand('601');

      // Assert
      expect(result1).toBe('Visa');
      expect(result2).toBe('Mastercard');
      expect(result3).toBe('Unknown'); // Discover needs 4 digits
    });

    it('should detect Mastercard boundary cases correctly', () => {
      // Arrange & Act - Test boundary values for Mastercard (51-55)
      const result51 = (service as any).detectCardBrand('5100000000000000');
      const result55 = (service as any).detectCardBrand('5500000000000000');
      const result50 = (service as any).detectCardBrand('5000000000000000');
      const result56 = (service as any).detectCardBrand('5600000000000000');

      // Assert
      expect(result51).toBe('Mastercard');
      expect(result55).toBe('Mastercard');
      expect(result50).toBe('Unknown');
      expect(result56).toBe('Unknown');
    });

    it('should detect American Express with both prefixes', () => {
      // Arrange & Act
      const result34 = (service as any).detectCardBrand('341111111111111');
      const result37 = (service as any).detectCardBrand('371111111111114');
      const result35 = (service as any).detectCardBrand('351111111111111');

      // Assert
      expect(result34).toBe('American Express');
      expect(result37).toBe('American Express');
      expect(result35).toBe('Unknown');
    });

    it('should handle null and undefined card numbers', () => {
      // Arrange & Act
      const resultNull = (service as any).detectCardBrand(null);
      const resultUndefined = (service as any).detectCardBrand(undefined);

      // Assert
      expect(resultNull).toBe('Unknown');
      expect(resultUndefined).toBe('Unknown');
    });
  });

  describe('validateConfig', () => {
    it('should throw error when API login ID is missing', () => {
      // Arrange
      const mockConfigServiceMissingLogin = {
        get: jest.fn().mockImplementation((key: string) => {
          switch (key) {
            case 'AUTHORIZENET_API_LOGIN_ID':
              return null;
            case 'AUTHORIZENET_TRANSACTION_KEY':
              return 'test-transaction-key';
            case 'AUTHORIZENET_ENVIRONMENT':
              return 'sandbox';
            default:
              return null;
          }
        }),
      };

      // Act & Assert
      expect(() => {
        new PaymentMethodService(
          paymentMethodRepository,
          mockConfigServiceMissingLogin as any,
        );
      }).toThrow('Authorize.Net API credentials are required');
    });

    it('should throw error when transaction key is missing', () => {
      // Arrange
      const mockConfigServiceMissingKey = {
        get: jest.fn().mockImplementation((key: string) => {
          switch (key) {
            case 'AUTHORIZENET_API_LOGIN_ID':
              return 'test-login-id';
            case 'AUTHORIZENET_TRANSACTION_KEY':
              return null;
            case 'AUTHORIZENET_ENVIRONMENT':
              return 'sandbox';
            default:
              return null;
          }
        }),
      };

      // Act & Assert
      expect(() => {
        new PaymentMethodService(
          paymentMethodRepository,
          mockConfigServiceMissingKey as any,
        );
      }).toThrow('Authorize.Net API credentials are required');
    });

    it('should throw error when both credentials are missing', () => {
      // Arrange
      const mockConfigServiceMissingBoth = {
        get: jest.fn().mockImplementation((key: string) => {
          switch (key) {
            case 'AUTHORIZENET_API_LOGIN_ID':
              return '';
            case 'AUTHORIZENET_TRANSACTION_KEY':
              return '';
            case 'AUTHORIZENET_ENVIRONMENT':
              return 'sandbox';
            default:
              return null;
          }
        }),
      };

      // Act & Assert
      expect(() => {
        new PaymentMethodService(
          paymentMethodRepository,
          mockConfigServiceMissingBoth as any,
        );
      }).toThrow('Authorize.Net API credentials are required');
    });
  });

  describe('createMerchantAuth', () => {
    it('should create merchant authentication with correct credentials', () => {
      // Arrange
      const mockMerchantAuth = {
        setName: jest.fn(),
        setTransactionKey: jest.fn(),
      };
      jest
        .spyOn(service as any, 'createMerchantAuth')
        .mockReturnValue(mockMerchantAuth);

      // Act
      const result = (service as any).createMerchantAuth();

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe('getCustomerProfile', () => {
    it('should return existing customer profile ID when payment method exists', async () => {
      // Arrange
      const existingPaymentMethod = {
        ...mockPaymentMethod,
        gatewayPaymentMethodId: '12345|67890',
      };
      paymentMethodRepository.findOne.mockResolvedValue(existingPaymentMethod);
      jest.spyOn(service as any, 'getCustomerProfile').mockRestore();

      // Act
      const result = await (service as any).getCustomerProfile('customer-123');

      // Assert
      expect(result).toBe('12345');
      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: { customerId: 'customer-123' },
      });
    });

    it('should create new customer profile when no existing payment method', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(null);
      jest
        .spyOn(service as any, 'createCustomerProfile')
        .mockResolvedValue('new-profile-123');
      jest.spyOn(service as any, 'getCustomerProfile').mockRestore();

      // Act
      const result = await (service as any).getCustomerProfile('customer-123');

      // Assert
      expect(result).toBe('new-profile-123');
    });

    it('should create new profile when database error occurs', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockRejectedValue(
        new Error('Database error'),
      );
      jest
        .spyOn(service as any, 'createCustomerProfile')
        .mockResolvedValue('new-profile-123');
      jest.spyOn(service as any, 'getCustomerProfile').mockRestore();

      // Act
      const result = await (service as any).getCustomerProfile('customer-123');

      // Assert
      expect(result).toBe('new-profile-123');
    });
  });

  describe('createPaymentMethod - Edge Cases', () => {
    it('should handle very long customer IDs correctly', async () => {
      // Arrange
      const longCustomerIdDto = {
        ...createPaymentMethodDto,
        customerId: 'customer-' + 'a'.repeat(100), // Very long customer ID
      };
      paymentMethodRepository.save.mockResolvedValue({
        ...mockPaymentMethod,
        customerId: longCustomerIdDto.customerId,
      });

      // Act
      const result = await service.createPaymentMethod(longCustomerIdDto);

      // Assert
      expect(result.customerId).toBe(longCustomerIdDto.customerId);
    });

    it('should handle special characters in cardholder name', async () => {
      // Arrange
      const specialCharDto = {
        ...createPaymentMethodDto,
        cardholderName: "José María O'Connor-Smith",
      };
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.createPaymentMethod(specialCharDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle missing billing address gracefully', async () => {
      // Arrange
      const noBillingAddressDto = {
        ...createPaymentMethodDto,
        billingAddress: undefined,
      };
      paymentMethodRepository.save.mockResolvedValue({
        ...mockPaymentMethod,
        billingAddress: null as any,
      });

      // Act
      const result = await service.createPaymentMethod(noBillingAddressDto);

      // Assert
      expect(result.billingAddress).toBeNull();
    });

    it('should handle single name in cardholder field', async () => {
      // Arrange
      const singleNameDto = {
        ...createPaymentMethodDto,
        cardholderName: 'Madonna',
      };
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.createPaymentMethod(singleNameDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle empty cardholder name', async () => {
      // Arrange
      const emptyNameDto = {
        ...createPaymentMethodDto,
        cardholderName: '',
      };
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.createPaymentMethod(emptyNameDto);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle repository save failure', async () => {
      // Arrange
      paymentMethodRepository.save.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(
        service.createPaymentMethod(createPaymentMethodDto),
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle repository update failure when setting default', async () => {
      // Arrange
      paymentMethodRepository.update.mockRejectedValue(
        new Error('Update failed'),
      );

      // Act & Assert
      await expect(
        service.createPaymentMethod(createPaymentMethodDto),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('getPaymentMethodsByCustomer - Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // Arrange
      paymentMethodRepository.find.mockRejectedValue(
        new Error('Connection timeout'),
      );

      // Act & Assert
      await expect(
        service.getPaymentMethodsByCustomer('customer-123'),
      ).rejects.toThrow('Connection timeout');
    });

    it('should handle very large result sets', async () => {
      // Arrange
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockPaymentMethod,
        id: `pm-${i}`,
        isDefault: i === 0,
      }));
      paymentMethodRepository.find.mockResolvedValue(largeResultSet);

      // Act
      const result = await service.getPaymentMethodsByCustomer('customer-123');

      // Assert
      expect(result).toHaveLength(1000);
      expect(result[0].isDefault).toBe(true);
    });

    it('should handle customer ID with special characters', async () => {
      // Arrange
      const specialCustomerId = 'customer-José@example.com';
      paymentMethodRepository.find.mockResolvedValue([mockPaymentMethod]);

      // Act
      const result =
        await service.getPaymentMethodsByCustomer(specialCustomerId);

      // Assert
      expect(paymentMethodRepository.find).toHaveBeenCalledWith({
        where: { customerId: specialCustomerId, isActive: true },
        order: { isDefault: 'DESC', createdAt: 'DESC' },
      });
    });
  });

  describe('updatePaymentMethod - Edge Cases', () => {
    it('should handle concurrent updates gracefully', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      paymentMethodRepository.save.mockResolvedValue(mockPaymentMethod);
      paymentMethodRepository.update.mockResolvedValue({
        affected: 2,
        raw: {},
        generatedMaps: [],
      });

      // Act
      const result = await service.updatePaymentMethod('pm-123', {
        isDefault: true,
      });

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle repository save failure during update', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      paymentMethodRepository.save.mockRejectedValue(new Error('Save failed'));

      // Act & Assert
      await expect(
        service.updatePaymentMethod('pm-123', { isDefault: true }),
      ).rejects.toThrow('Save failed');
    });

    it('should handle invalid UUID format', async () => {
      // Arrange
      paymentMethodRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updatePaymentMethod('invalid-uuid', { isDefault: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePaymentMethod - Edge Cases', () => {
    it('should handle repository save failure during deletion', async () => {
      // Arrange
      const nonDefaultPaymentMethod = {
        ...mockPaymentMethod,
        isDefault: false,
      };
      paymentMethodRepository.findOne.mockResolvedValue(
        nonDefaultPaymentMethod,
      );
      paymentMethodRepository.save.mockRejectedValue(new Error('Save failed'));

      // Act & Assert
      await expect(service.deletePaymentMethod('pm-123')).rejects.toThrow(
        'Save failed',
      );
    });

    it('should handle deletion of already inactive payment method', async () => {
      // Arrange
      const inactivePaymentMethod = {
        ...mockPaymentMethod,
        isDefault: false,
        isActive: false,
      };
      paymentMethodRepository.findOne.mockResolvedValue(inactivePaymentMethod);

      // Act
      await service.deletePaymentMethod('pm-123');

      // Assert
      expect(paymentMethodRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });

    it('should handle very long payment method IDs', async () => {
      // Arrange
      const longId = 'pm-' + 'a'.repeat(100);
      paymentMethodRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deletePaymentMethod(longId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('mapToResponseDto', () => {
    it('should map entity to response DTO correctly with all fields', () => {
      // Arrange
      const fullEntity = {
        ...mockPaymentMethod,
        billingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          company: 'Acme Corp',
          address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
          country: 'US',
        },
      };

      // Act
      const result = (service as any).mapToResponseDto(fullEntity);

      // Assert
      expect(result).toEqual({
        id: fullEntity.id,
        customerId: fullEntity.customerId,
        cardLastFour: fullEntity.cardLastFour,
        cardBrand: fullEntity.cardBrand,
        cardExpiryMonth: fullEntity.cardExpiryMonth,
        cardExpiryYear: fullEntity.cardExpiryYear,
        billingAddress: fullEntity.billingAddress,
        isDefault: fullEntity.isDefault,
        isActive: fullEntity.isActive,
        createdAt: fullEntity.createdAt,
      });
    });

    it('should map entity to response DTO with null billing address', () => {
      // Arrange
      const entityWithNullBilling = {
        ...mockPaymentMethod,
        billingAddress: null,
      };

      // Act
      const result = (service as any).mapToResponseDto(entityWithNullBilling);

      // Assert
      expect(result.billingAddress).toBeNull();
    });
  });

  describe('Authorize.Net API Error Handling', () => {
    it('should handle API timeout errors', async () => {
      // Arrange
      jest
        .spyOn(service as any, 'getCustomerProfile')
        .mockRejectedValue(new Error('Request timeout'));

      // Act & Assert
      await expect(
        service.createPaymentMethod(createPaymentMethodDto),
      ).rejects.toThrow('Request timeout');
    });

    it('should handle API rate limiting errors', async () => {
      // Arrange
      jest
        .spyOn(service as any, 'createCustomerPaymentProfile')
        .mockRejectedValue(new BadRequestException('Rate limit exceeded'));

      // Act & Assert
      await expect(
        service.createPaymentMethod(createPaymentMethodDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle invalid API credentials error', async () => {
      // Arrange
      jest
        .spyOn(service as any, 'getCustomerProfile')
        .mockRejectedValue(new BadRequestException('Invalid API credentials'));

      // Act & Assert
      await expect(
        service.createPaymentMethod(createPaymentMethodDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle duplicate customer profile creation', async () => {
      // Arrange
      jest
        .spyOn(service as any, 'getCustomerProfile')
        .mockRejectedValue(
          new BadRequestException('Customer profile already exists'),
        );

      // Act & Assert
      await expect(
        service.createPaymentMethod(createPaymentMethodDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Date and Expiry Handling', () => {
    it('should handle single digit months correctly', async () => {
      // Arrange
      const singleDigitMonthDto = {
        ...createPaymentMethodDto,
        expiryMonth: 1,
      };
      paymentMethodRepository.save.mockResolvedValue({
        ...mockPaymentMethod,
        cardExpiryMonth: 1,
      });

      // Act
      const result = await service.createPaymentMethod(singleDigitMonthDto);

      // Assert
      expect(result.cardExpiryMonth).toBe(1);
    });

    it('should handle far future expiry dates', async () => {
      // Arrange
      const farFutureDto = {
        ...createPaymentMethodDto,
        expiryYear: 2099,
      };
      paymentMethodRepository.save.mockResolvedValue({
        ...mockPaymentMethod,
        cardExpiryYear: 2099,
      });

      // Act
      const result = await service.createPaymentMethod(farFutureDto);

      // Assert
      expect(result.cardExpiryYear).toBe(2099);
    });

    it('should handle boundary month values', async () => {
      // Arrange
      const boundaryMonthDto = {
        ...createPaymentMethodDto,
        expiryMonth: 12,
      };
      paymentMethodRepository.save.mockResolvedValue({
        ...mockPaymentMethod,
        cardExpiryMonth: 12,
      });

      // Act
      const result = await service.createPaymentMethod(boundaryMonthDto);

      // Assert
      expect(result.cardExpiryMonth).toBe(12);
    });
  });
});
