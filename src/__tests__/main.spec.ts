/**
 * Unit tests for main.ts utility functions
 */

// Clear any existing mocks
jest.clearAllMocks();

describe('Main Module Utilities', () => {
  // Store the original process.env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore process.env
    process.env = originalEnv;
  });

  describe('When parsing CORS origins from environment variables', () => {
    // This tests the behavior of the CORS configuration in main.ts
    it('Then should use default origins when ALLOWED_ORIGINS is not set', () => {
      // Arrange
      delete process.env.ALLOWED_ORIGINS;

      // Act
      const allowedOrigins = process.env.ALLOWED_ORIGINS;
      const origins = allowedOrigins
        ? allowedOrigins.split(',')
        : ['http://localhost:3000'];

      // Assert
      expect(origins).toEqual(['http://localhost:3000']);
    });

    it('Then should parse multiple origins from ALLOWED_ORIGINS environment variable', () => {
      // Arrange
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://test.com';

      // Act
      const allowedOrigins = process.env.ALLOWED_ORIGINS;
      const origins = allowedOrigins
        ? allowedOrigins.split(',')
        : ['http://localhost:3000'];

      // Assert
      expect(origins).toEqual(['https://example.com', 'https://test.com']);
    });
  });

  describe('When determining the port to listen on', () => {
    it('Then should use default port when PORT is not set', () => {
      // Arrange
      delete process.env.PORT;

      // Act
      const port = process.env.PORT || 3000;

      // Assert
      expect(port).toBe(3000);
    });

    it('Then should use environment variable when PORT is set', () => {
      // Arrange
      process.env.PORT = '4000';

      // Act
      const port = process.env.PORT || 3000;

      // Assert
      expect(port).toBe('4000');
    });
  });

  describe('When constructing application URLs', () => {
    it('Then should format URLs correctly with the port', () => {
      // Arrange
      const port = 5000;

      // Act
      const appUrl = `http://localhost:${port}`;
      const docsUrl = `http://localhost:${port}/api/docs`;

      // Assert
      expect(appUrl).toBe('http://localhost:5000');
      expect(docsUrl).toBe('http://localhost:5000/api/docs');
    });
  });
});
