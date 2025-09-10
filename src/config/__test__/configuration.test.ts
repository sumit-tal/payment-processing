import configuration from "../configuration";

/**
 * Unit tests for configuration.ts
 */

describe("configuration (env parsing and defaults)", () => {
  const originalEnv: NodeJS.ProcessEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use defaults when env vars are not set (happy path defaults)", async () => {
    delete process.env.DB_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DB_SYNCHRONIZE;
    delete process.env.DB_MAX_CONNECTIONS;
    delete process.env.DB_LOGGING;

    jest.resetModules();
    const cfg = (await import("../configuration")).default;

    expect(cfg.db.dbConnectionString).toBe(
      "postgresql://postgres:password@localhost:5432/payment_processing"
    );
    expect(cfg.db.synchronize).toBe(false);
    expect(cfg.db.poolsize).toBe(10);
    expect(cfg.db.logging).toBe(false);
  });

  it("should respect DB_URL when provided", async () => {
    process.env.DB_URL = "postgresql://user:pass@host:6543/db";
    const cfg = (await import("../configuration")).default;
    expect(cfg.db.dbConnectionString).toBe("postgresql://user:pass@host:6543/db");
  });

  it("should build connection string from parts with proper encoding (edge case)", async () => {
    delete process.env.DB_URL;
    process.env.DB_USERNAME = "user name"; // space should be encoded
    process.env.DB_PASSWORD = "p@ss:word"; // special chars should be encoded
    process.env.DB_HOST = "db.example.com";
    process.env.DB_PORT = "6543";
    process.env.DB_NAME = "my-db";

    const cfg = (await import("../configuration")).default;
    expect(cfg.db.dbConnectionString).toBe(
      "postgresql://user%20name:p%40ss%3Aword@db.example.com:6543/my-db"
    );
  });

  it("should parse booleans for synchronize and logging (happy path)", async () => {
    process.env.DB_SYNCHRONIZE = "true";
    process.env.DB_LOGGING = "1";
    const cfg = (await import("../configuration")).default;
    expect(cfg.db.synchronize).toBe(true);
    expect(cfg.db.logging).toBe(true);
  });

  it("should support loose truthy values 'yes' for booleans (edge case)", async () => {
    process.env.DB_SYNCHRONIZE = "yes";
    const cfg = (await import("../configuration")).default;
    expect(cfg.db.synchronize).toBe(true);
  });

  it("should fallback for invalid numeric values (negative scenario)", async () => {
    process.env.DB_MAX_CONNECTIONS = "not-a-number";
    const cfg = (await import("../configuration")).default;
    expect(cfg.db.poolsize).toBe(10);
  });

  it("should treat unknown boolean strings as false (negative scenario)", async () => {
    process.env.DB_LOGGING = "maybe";
    const cfg = (await import("../configuration")).default;
    expect(cfg.db.logging).toBe(false);
  });
});
