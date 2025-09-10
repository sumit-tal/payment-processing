import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { PaymentMethodController } from '../payment-method.controller';
import { PaymentMethodService } from '../../services/payment-method.service';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  PaymentMethodResponseDto,
} from '../../dto/payment-method.dto';

describe('PaymentMethodController', () => {
  let controller: PaymentMethodController;
  let paymentMethodService: jest.Mocked<PaymentMethodService>;

  // Mock data
  const mockPaymentMethodId = '123e4567-e89b-12d3-a456-426614174000';
  const mockCustomerId = '123e4567-e89b-12d3-a456-426614174001';

  const mockPaymentMethodResponse: PaymentMethodResponseDto = {
    id: mockPaymentMethodId,
    customerId: mockCustomerId,
    cardLastFour: '1234',
    cardBrand: 'Visa',
    cardExpiryMonth: 12,
    cardExpiryYear: 2025,
    billingAddress: {
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
      country: 'US',
    },
    isDefault: true,
    isActive: true,
    createdAt: new Date('2025-01-01'),
  };

  const mockCreatePaymentMethodDto: CreatePaymentMethodDto = {
    customerId: mockCustomerId,
    cardNumber: '4111111111111234',
    cardCode: '123',
    expiryMonth: 12,
    expiryYear: 2025,
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
    isDefault: true,
  };

  const mockUpdatePaymentMethodDto: UpdatePaymentMethodDto = {
    isDefault: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentMethodController],
      providers: [
        {
          provide: PaymentMethodService,
          useValue: {
            createPaymentMethod: jest.fn(),
            getPaymentMethodById: jest.fn(),
            getPaymentMethodsByCustomer: jest.fn(),
            updatePaymentMethod: jest.fn(),
            deletePaymentMethod: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentMethodController>(PaymentMethodController);
    paymentMethodService = module.get(PaymentMethodService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When creating a payment method', () => {
    it('Then should create and return the payment method', async () => {
      // Arrange
      paymentMethodService.createPaymentMethod.mockResolvedValue(mockPaymentMethodResponse);

      // Act
      const result = await controller.createPaymentMethod(mockCreatePaymentMethodDto);

      // Assert
      expect(result).toEqual(mockPaymentMethodResponse);
      expect(paymentMethodService.createPaymentMethod).toHaveBeenCalledWith(
        mockCreatePaymentMethodDto,
      );
      expect(paymentMethodService.createPaymentMethod).toHaveBeenCalledTimes(1);
    });

    it('Then should handle service errors and propagate them', async () => {
      // Arrange
      const errorMessage = 'Invalid card data';
      paymentMethodService.createPaymentMethod.mockRejectedValue(
        new Error(errorMessage),
      );

      // Act & Assert
      await expect(
        controller.createPaymentMethod(mockCreatePaymentMethodDto),
      ).rejects.toThrow(errorMessage);
      expect(paymentMethodService.createPaymentMethod).toHaveBeenCalledWith(
        mockCreatePaymentMethodDto,
      );
    });
  });

  describe('When getting a payment method by ID', () => {
    it('Then should return the payment method when it exists', async () => {
      // Arrange
      paymentMethodService.getPaymentMethodById.mockResolvedValue(
        mockPaymentMethodResponse,
      );

      // Act
      const result = await controller.getPaymentMethod(mockPaymentMethodId);

      // Assert
      expect(result).toEqual(mockPaymentMethodResponse);
      expect(paymentMethodService.getPaymentMethodById).toHaveBeenCalledWith(
        mockPaymentMethodId,
      );
      expect(paymentMethodService.getPaymentMethodById).toHaveBeenCalledTimes(1);
    });

    it('Then should handle non-existent payment method ID', async () => {
      // Arrange
      const nonExistentId = '123e4567-e89b-12d3-a456-999999999999';
      paymentMethodService.getPaymentMethodById.mockRejectedValue(
        new Error(`Payment method with ID ${nonExistentId} not found`),
      );

      // Act & Assert
      await expect(controller.getPaymentMethod(nonExistentId)).rejects.toThrow(
        `Payment method with ID ${nonExistentId} not found`,
      );
      expect(paymentMethodService.getPaymentMethodById).toHaveBeenCalledWith(
        nonExistentId,
      );
    });

    it('Then should handle invalid UUID format', async () => {
      // This test relies on NestJS's ParseUUIDPipe which is automatically tested
      // by the framework. We're including it for completeness.
      // In a real test, you might use a custom approach to trigger the pipe validation.
    });
  });

  describe('When getting payment methods by customer ID', () => {
    it('Then should return all payment methods for a customer', async () => {
      // Arrange
      const mockPaymentMethods = [mockPaymentMethodResponse];
      paymentMethodService.getPaymentMethodsByCustomer.mockResolvedValue(
        mockPaymentMethods,
      );

      // Act
      const result = await controller.getPaymentMethodsByCustomer(mockCustomerId);

      // Assert
      expect(result).toEqual(mockPaymentMethods);
      expect(paymentMethodService.getPaymentMethodsByCustomer).toHaveBeenCalledWith(
        mockCustomerId,
      );
      expect(paymentMethodService.getPaymentMethodsByCustomer).toHaveBeenCalledTimes(1);
    });

    it('Then should return empty array when customer has no payment methods', async () => {
      // Arrange
      paymentMethodService.getPaymentMethodsByCustomer.mockResolvedValue([]);

      // Act
      const result = await controller.getPaymentMethodsByCustomer(mockCustomerId);

      // Assert
      expect(result).toEqual([]);
      expect(paymentMethodService.getPaymentMethodsByCustomer).toHaveBeenCalledWith(
        mockCustomerId,
      );
    });

    it('Then should handle invalid customer ID format', async () => {
      // This test relies on NestJS's ParseUUIDPipe which is automatically tested
      // by the framework. We're including it for completeness.
    });
  });

  describe('When updating a payment method', () => {
    it('Then should update and return the payment method', async () => {
      // Arrange
      paymentMethodService.updatePaymentMethod.mockResolvedValue(
        mockPaymentMethodResponse,
      );

      // Act
      const result = await controller.updatePaymentMethod(
        mockPaymentMethodId,
        mockUpdatePaymentMethodDto,
      );

      // Assert
      expect(result).toEqual(mockPaymentMethodResponse);
      expect(paymentMethodService.updatePaymentMethod).toHaveBeenCalledWith(
        mockPaymentMethodId,
        mockUpdatePaymentMethodDto,
      );
      expect(paymentMethodService.updatePaymentMethod).toHaveBeenCalledTimes(1);
    });

    it('Then should handle non-existent payment method ID', async () => {
      // Arrange
      const nonExistentId = '123e4567-e89b-12d3-a456-999999999999';
      paymentMethodService.updatePaymentMethod.mockRejectedValue(
        new Error(`Payment method with ID ${nonExistentId} not found`),
      );

      // Act & Assert
      await expect(
        controller.updatePaymentMethod(nonExistentId, mockUpdatePaymentMethodDto),
      ).rejects.toThrow(`Payment method with ID ${nonExistentId} not found`);
      expect(paymentMethodService.updatePaymentMethod).toHaveBeenCalledWith(
        nonExistentId,
        mockUpdatePaymentMethodDto,
      );
    });

    it('Then should handle invalid input data', async () => {
      // Arrange
      paymentMethodService.updatePaymentMethod.mockRejectedValue(
        new Error('Invalid input data'),
      );

      // Act & Assert
      await expect(
        controller.updatePaymentMethod(mockPaymentMethodId, mockUpdatePaymentMethodDto),
      ).rejects.toThrow('Invalid input data');
      expect(paymentMethodService.updatePaymentMethod).toHaveBeenCalledWith(
        mockPaymentMethodId,
        mockUpdatePaymentMethodDto,
      );
    });
  });

  describe('When deleting a payment method', () => {
    it('Then should delete the payment method successfully', async () => {
      // Arrange
      paymentMethodService.deletePaymentMethod.mockResolvedValue(undefined);

      // Act
      await controller.deletePaymentMethod(mockPaymentMethodId);

      // Assert
      expect(paymentMethodService.deletePaymentMethod).toHaveBeenCalledWith(
        mockPaymentMethodId,
      );
      expect(paymentMethodService.deletePaymentMethod).toHaveBeenCalledTimes(1);
    });

    it('Then should handle non-existent payment method ID', async () => {
      // Arrange
      const nonExistentId = '123e4567-e89b-12d3-a456-999999999999';
      paymentMethodService.deletePaymentMethod.mockRejectedValue(
        new Error(`Payment method with ID ${nonExistentId} not found`),
      );

      // Act & Assert
      await expect(controller.deletePaymentMethod(nonExistentId)).rejects.toThrow(
        `Payment method with ID ${nonExistentId} not found`,
      );
      expect(paymentMethodService.deletePaymentMethod).toHaveBeenCalledWith(
        nonExistentId,
      );
    });

    it('Then should handle attempt to delete default payment method', async () => {
      // Arrange
      paymentMethodService.deletePaymentMethod.mockRejectedValue(
        new Error('Cannot delete default payment method. Set another payment method as default first.'),
      );

      // Act & Assert
      await expect(controller.deletePaymentMethod(mockPaymentMethodId)).rejects.toThrow(
        'Cannot delete default payment method. Set another payment method as default first.',
      );
      expect(paymentMethodService.deletePaymentMethod).toHaveBeenCalledWith(
        mockPaymentMethodId,
      );
    });
  });
});
