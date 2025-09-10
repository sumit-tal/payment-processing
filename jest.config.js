module.exports = {
  maxWorkers: 1,
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.(spec|test)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/*.entity.ts',
    '!**/*.dto.ts',
    '!**/database/migrations/**/*.(t|j)s',
    '!**/index.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/common/(.*)$': '<rootDir>/common/$1',
    '^@/modules/(.*)$': '<rootDir>/modules/$1',
    '^@/config/(.*)$': '<rootDir>/config/$1',
    '^@/database/(.*)$': '<rootDir>/database/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ],
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: '<rootDir>/../tsconfig.spec.json'
    }
  }
};
