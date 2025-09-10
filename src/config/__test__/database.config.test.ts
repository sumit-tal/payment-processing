import { DatabaseConfig, AppDataSource } from '../database.config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Unit tests for database.config.ts
 */

describe('DatabaseConfig.createTypeOrmOptions', () => {
  const originalEnv: NodeJS.ProcessEnv = process.env;

  const mockConfigService = (map: Record<string, string | undefined>) => ({
    get: (key: string, defaultValue?: string) =>
      (map[key] !== undefined ? map[key] : defaultValue) as string | undefined,
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return expected options with provided values (happy path)', () => {
    const cfg = new DatabaseConfig(
      // @ts-expect-error - minimal mock for ConfigService
      mockConfigService({
        DB_HOST: 'db.example.com',
        DB_PORT: '5433',
        DB_USERNAME: 'alice',
        DB_PASSWORD: 'secret',
        DB_NAME: 'payments',
        DB_SYNCHRONIZE: 'true',
        DB_LOGGING: 'false',
        DB_SSL: '1',
        DB_MAX_CONNECTIONS: '20',
        DB_IDLE_TIMEOUT: '15000',
        DB_CONNECTION_TIMEOUT: '5000',
      }),
    );

    const options: TypeOrmModuleOptions = cfg.createTypeOrmOptions();

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'db.example.com',
      port: 5433,
      username: 'alice',
      password: 'secret',
      database: 'payments',
      synchronize: true,
      logging: false,
      ssl: true,
      autoLoadEntities: true,
      retryAttempts: 1,
      retryDelay: 1000,
      extra: {
        max: 20,
        idleTimeoutMillis: 15000,
        connectionTimeoutMillis: 5000,
      },
    });
    expect(options).toHaveProperty(
      'migrations',
      expect.arrayContaining([
        expect.stringMatching(/migrations\/\*\{\.js\}$/),
      ]),
    );
  });

  it('should fallback on invalid numbers and booleans (negative scenario)', () => {
    const cfg = new DatabaseConfig(
      // @ts-expect-error - minimal mock for ConfigService
      mockConfigService({
        DB_PORT: 'invalid',
        DB_SYNCHRONIZE: 'notbool',
        DB_LOGGING: '',
        DB_SSL: 'nope',
        DB_MAX_CONNECTIONS: 'NaN',
        DB_IDLE_TIMEOUT: 'abc',
        DB_CONNECTION_TIMEOUT: 'xyz',
      }),
    );

    const options: TypeOrmModuleOptions = cfg.createTypeOrmOptions();

    expect(options).toMatchObject({
      port: 5432,
      synchronize: false,
      logging: false,
      ssl: false,
      extra: {
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
    });
  });
});

describe('AppDataSource (static configuration)', () => {
  const originalEnv: NodeJS.ProcessEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use defaults when env is missing (happy path defaults)', async () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DB_LOGGING;
    delete process.env.DB_SSL;

    const mod = await import('../database.config');
    const ds = mod.AppDataSource;

    expect(ds.options).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'payment_processing',
      synchronize: false,
      logging: false,
      ssl: false,
    });

    expect(ds.options.entities).toEqual([
      expect.stringMatching(/\*\*\/\*\.entity\{\.ts,\.js\}$/),
    ]);
    expect(ds.options.migrations).toEqual([
      expect.stringMatching(/migrations\/\*\{\.ts,\.js\}$/),
    ]);
  });

  it('should reflect env overrides (edge case)', async () => {
    process.env.DB_HOST = 'host';
    process.env.DB_PORT = '6543';
    process.env.DB_USERNAME = 'user';
    process.env.DB_PASSWORD = 'pass';
    process.env.DB_NAME = 'db';
    process.env.DB_LOGGING = 'true';
    process.env.DB_SSL = 'true';

    jest.resetModules();
    const { AppDataSource: ds } = await import('../database.config');

    expect(ds.options).toMatchObject({
      host: 'host',
      port: 6543,
      username: 'user',
      password: 'pass',
      database: 'db',
      logging: true,
      ssl: true,
    });
  });
});
