import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from '../app.service';

describe('AppService', () => {
  let service: AppService;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('When getting application information', () => {
    it('Then should return the correct message and version', () => {
      // Arrange
      const mockDate = new Date('2025-01-01T12:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // Act
      const result = service.getHello();

      // Assert
      expect(result).toEqual({
        message: 'Payment Processing System API',
        version: '1.0.0',
        timestamp: mockDate.toISOString(),
      });
    });

    it('Then should return a valid ISO timestamp', () => {
      // Act
      const result = service.getHello();

      // Assert
      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
      );
    });

    it('Then should return the correct message structure', () => {
      // Act
      const result = service.getHello();

      // Assert
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.message).toBe('string');
      expect(typeof result.version).toBe('string');
      expect(typeof result.timestamp).toBe('string');
    });
  });
});
