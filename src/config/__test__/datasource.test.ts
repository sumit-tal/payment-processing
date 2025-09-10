/**
 * Unit tests for datasource.ts
 */

describe('connectionSource (DataSource configured from configuration)', () => {
  const originalEnv: NodeJS.ProcessEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should wire URL and flags from configuration (happy path)', async () => {
    process.env.DB_URL = 'postgresql://a:b@h:5432/x';
    process.env.DB_SYNCHRONIZE = 'true';
    process.env.DB_LOGGING = 'true';

    jest.resetModules();

    const { default: connectionSource } = await import('../datasource');

    const options = (connectionSource as unknown as { options: any }).options;

    expect(options.type).toBe('postgres');
    expect(options.url).toBe('postgresql://a:b@h:5432/x');
    expect(options.synchronize).toBe(true);
    expect(options.logging).toBe(true);
    expect(options.migrationsTableName).toBe('migration_history');
    expect(options.migrations[0]).toMatch(
      /database\/migrations\/\*\{\.ts,\.js\}$/,
    );
  });

  it('should include all entity classes (edge case check)', async () => {
    jest.resetModules();
    const mod = await import('../datasource');
    const ds: any = mod.default as any;

    const entityNames = ds.options.entities.map((e: Function) => e.name).sort();
    expect(entityNames).toEqual(
      [
        'ApiKey',
        'AuditLog',
        'PaymentMethod',
        'Subscription',
        'SubscriptionPayment',
        'SubscriptionPlan',
        'Transaction',
        'WebhookEvent',
      ].sort(),
    );
  });
});
