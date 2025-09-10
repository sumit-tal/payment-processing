import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';

describe('AppController', () => {
  let controller: AppController;
  let mockAppService: jest.Mocked<AppService>;

  beforeEach(async () => {
    const mockAppServiceValue = {
      getHello: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: mockAppServiceValue },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    mockAppService = module.get(AppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When getting application information', () => {
    it('Then should return the application information from the service', () => {
      // Arrange
      const expectedResult = {
        message: 'Payment Processing System API',
        version: '1.0.0',
        timestamp: '2025-01-01T12:00:00.000Z',
      };
      mockAppService.getHello.mockReturnValue(expectedResult);

      // Act
      const result = controller.getHello();

      // Assert
      expect(mockAppService.getHello).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('Then should handle service returning different values', () => {
      // Arrange
      const expectedResult = {
        message: 'Custom Message',
        version: '2.0.0',
        timestamp: '2025-02-02T12:00:00.000Z',
      };
      mockAppService.getHello.mockReturnValue(expectedResult);

      // Act
      const result = controller.getHello();

      // Assert
      expect(mockAppService.getHello).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
      expect(result.message).toBe('Custom Message');
      expect(result.version).toBe('2.0.0');
    });

    it('Then should handle service returning empty values', () => {
      // Arrange
      const expectedResult = {
        message: '',
        version: '',
        timestamp: '',
      };
      mockAppService.getHello.mockReturnValue(expectedResult);

      // Act
      const result = controller.getHello();

      // Assert
      expect(mockAppService.getHello).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
      expect(result.message).toBe('');
      expect(result.version).toBe('');
      expect(result.timestamp).toBe('');
    });
  });
});
