import {
  RequirePermissions,
  SkipAuth,
  PERMISSIONS_KEY,
  SKIP_AUTH_KEY,
  Permissions,
} from '../auth.decorator';
import { SetMetadata } from '@nestjs/common';

jest.mock('@nestjs/common', () => ({
  SetMetadata: jest.fn().mockImplementation((key, value) => {
    return () => {};
  })
}));

describe('Auth Decorators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RequirePermissions', () => {
    it('When called with single permission, should set metadata with that permission', () => {
      // Arrange
      const permission = 'payments:read';

      // Act
      RequirePermissions(permission)(class TestController {});

      // Assert
      expect(SetMetadata).toHaveBeenCalledWith(PERMISSIONS_KEY, [permission]);
    });

    it('When called with multiple permissions, should set metadata with those permissions', () => {
      // Arrange
      const permissions = ['payments:read', 'payments:write'];

      // Act
      RequirePermissions(...permissions)(class TestController {});

      // Assert
      expect(SetMetadata).toHaveBeenCalledWith(PERMISSIONS_KEY, permissions);
    });

    it('When called with empty permissions, should set metadata with empty array', () => {
      // Act
      RequirePermissions()(class TestController {});

      // Assert
      expect(SetMetadata).toHaveBeenCalledWith(PERMISSIONS_KEY, []);
    });

    it('When called with duplicate permissions, should set metadata with duplicates', () => {
      // Arrange
      const permissions = ['payments:read', 'payments:read'];

      // Act
      RequirePermissions(...permissions)(class TestController {});

      // Assert
      expect(SetMetadata).toHaveBeenCalledWith(PERMISSIONS_KEY, permissions);
    });
  });

  describe('SkipAuth', () => {
    it('When called, should set metadata to skip auth', () => {
      // Act
      SkipAuth()(class TestController {});

      // Assert
      expect(SetMetadata).toHaveBeenCalledWith(SKIP_AUTH_KEY, true);
    });
  });

  describe('Permissions constants', () => {
    it('When accessing Permissions.PAYMENTS_READ, should return correct value', () => {
      // Assert
      expect(Permissions.PAYMENTS_READ).toBe('payments:read');
    });

    it('When accessing Permissions.ALL, should return wildcard', () => {
      // Assert
      expect(Permissions.ALL).toBe('*');
    });
  });
});
