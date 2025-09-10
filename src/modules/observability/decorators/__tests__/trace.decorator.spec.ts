import { SetMetadata } from '@nestjs/common';
import {
  TRACE_METADATA,
  Trace,
  TraceOptions,
  TracePayment,
  TraceSecurity,
} from '../trace.decorator';

// Mock the SetMetadata function from @nestjs/common
jest.mock('@nestjs/common', () => ({
  SetMetadata: jest.fn().mockImplementation((key, value) => {
    return { key, value };
  }),
}));

describe('Trace Decorators', () => {
  const mockSetMetadata = SetMetadata as jest.Mock;

  beforeEach(() => {
    mockSetMetadata.mockClear();
  });

  describe('When using Trace decorator', () => {
    it('Then should set metadata with provided options', () => {
      // Arrange
      const options: TraceOptions = {
        operationName: 'test-operation',
        component: 'test-component',
        tags: { key: 'value' },
      };

      // Act
      const result = Trace(options);

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(TRACE_METADATA, options);
      expect(result).toEqual({ key: TRACE_METADATA, value: options });
    });

    it('Then should set metadata with empty object when no options provided', () => {
      // Act
      const result = Trace();

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(TRACE_METADATA, {});
      expect(result).toEqual({ key: TRACE_METADATA, value: {} });
    });

    it('Then should handle partial options', () => {
      // Arrange
      const options: TraceOptions = {
        operationName: 'test-operation',
      };

      // Act
      const result = Trace(options);

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(TRACE_METADATA, options);
      expect(result).toEqual({ key: TRACE_METADATA, value: options });
    });
  });

  describe('When using TracePayment decorator', () => {
    it('Then should create trace with payment operation details', () => {
      // Arrange
      const operationType = 'authorize';
      const expectedOptions = {
        operationName: `payment.${operationType}`,
        component: 'payment',
        tags: { 'payment.type': operationType },
      };

      // Act
      const result = TracePayment(operationType);

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(
        TRACE_METADATA,
        expectedOptions,
      );
      expect(result).toEqual({ key: TRACE_METADATA, value: expectedOptions });
    });

    it('Then should handle empty operation type', () => {
      // Arrange
      const operationType = '';
      const expectedOptions = {
        operationName: 'payment.',
        component: 'payment',
        tags: { 'payment.type': '' },
      };

      // Act
      const result = TracePayment(operationType);

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(
        TRACE_METADATA,
        expectedOptions,
      );
      expect(result).toEqual({ key: TRACE_METADATA, value: expectedOptions });
    });

    it('Then should handle special characters in operation type', () => {
      // Arrange
      const operationType = 'refund-partial';
      const expectedOptions = {
        operationName: `payment.${operationType}`,
        component: 'payment',
        tags: { 'payment.type': operationType },
      };

      // Act
      const result = TracePayment(operationType);

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(
        TRACE_METADATA,
        expectedOptions,
      );
      expect(result).toEqual({ key: TRACE_METADATA, value: expectedOptions });
    });
  });

  describe('When using TraceSecurity decorator', () => {
    it('Then should create trace with security operation details', () => {
      // Arrange
      const operationType = 'authentication';
      const expectedOptions = {
        operationName: `security.${operationType}`,
        component: 'security',
        tags: { 'security.type': operationType },
      };

      // Act
      const result = TraceSecurity(operationType);

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(
        TRACE_METADATA,
        expectedOptions,
      );
      expect(result).toEqual({ key: TRACE_METADATA, value: expectedOptions });
    });

    it('Then should handle empty operation type', () => {
      // Arrange
      const operationType = '';
      const expectedOptions = {
        operationName: 'security.',
        component: 'security',
        tags: { 'security.type': '' },
      };

      // Act
      const result = TraceSecurity(operationType);

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(
        TRACE_METADATA,
        expectedOptions,
      );
      expect(result).toEqual({ key: TRACE_METADATA, value: expectedOptions });
    });

    it('Then should handle complex operation types', () => {
      // Arrange
      const operationType = 'pci-dss-validation';
      const expectedOptions = {
        operationName: `security.${operationType}`,
        component: 'security',
        tags: { 'security.type': operationType },
      };

      // Act
      const result = TraceSecurity(operationType);

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(
        TRACE_METADATA,
        expectedOptions,
      );
      expect(result).toEqual({ key: TRACE_METADATA, value: expectedOptions });
    });
  });

  describe('When using decorators with edge cases', () => {
    it('Then should handle undefined tags in options', () => {
      // Arrange
      const options: TraceOptions = {
        operationName: 'test-operation',
        component: 'test-component',
        tags: undefined,
      };

      // Act
      const result = Trace(options);

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(TRACE_METADATA, options);
      expect(result).toEqual({ key: TRACE_METADATA, value: options });
    });

    it('Then should handle null operation name in options', () => {
      // Arrange
      const options: TraceOptions = {
        operationName: null as unknown as string,
        component: 'test-component',
      };

      // Act
      const result = Trace(options);

      // Assert
      expect(mockSetMetadata).toHaveBeenCalledTimes(1);
      expect(mockSetMetadata).toHaveBeenCalledWith(TRACE_METADATA, options);
      expect(result).toEqual({ key: TRACE_METADATA, value: options });
    });
  });
});
