import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Database configuration service
 */
@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Create TypeORM configuration options
   */
  createTypeOrmOptions(): TypeOrmModuleOptions {
    const toBool = (value: string | undefined, fallback: boolean): boolean => {
      if (value === undefined) return fallback;
      return value.toLowerCase() === 'true' || value === '1';
    };

    const toNum = (value: string | undefined, fallback: number): number => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = toNum(this.configService.get<string>('DB_PORT'), 5432);
    const username = this.configService.get<string>('DB_USERNAME', 'postgres');
    const password = this.configService.get<string>('DB_PASSWORD', 'password');
    const database = this.configService.get<string>(
      'DB_NAME',
      'payment_processing',
    );
    const synchronize = toBool(
      this.configService.get<string>('DB_SYNCHRONIZE'),
      false,
    );
    const logging = toBool(this.configService.get<string>('DB_LOGGING'), false);
    const ssl = toBool(this.configService.get<string>('DB_SSL'), false);
    const max = toNum(this.configService.get<string>('DB_MAX_CONNECTIONS'), 10);
    const idleTimeoutMillis = toNum(
      this.configService.get<string>('DB_IDLE_TIMEOUT'),
      30000,
    );
    const connectionTimeoutMillis = toNum(
      this.configService.get<string>('DB_CONNECTION_TIMEOUT'),
      2000,
    );

    return {
      type: 'postgres',
      host,
      port,
      username,
      password,
      database,
      // Rely on Nest autoLoadEntities to register entity classes, avoid requiring files via globs
      entities: [],
      // Only load compiled migrations at runtime
      migrations: [__dirname + '/../migrations/*{.js}'],
      synchronize,
      logging,
      ssl,
      retryAttempts: 1,
      retryDelay: 1000,
      autoLoadEntities: true,
      extra: {
        max,
        idleTimeoutMillis,
        connectionTimeoutMillis,
      },
    };
  }
}

/**
 * DataSource configuration for TypeORM CLI
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'payment_processing',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: (process.env.DB_LOGGING || '').toLowerCase() === 'true',
  ssl: (process.env.DB_SSL || '').toLowerCase() === 'true',
});
