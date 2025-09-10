import securityConfigFactory from "../security.config";

/**
 * Unit tests for security.config.ts
 */

describe("security.config (registerAs factory)", () => {
  const originalEnv: NodeJS.ProcessEnv = process.env;

  const getConfig = () => securityConfigFactory();

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should provide sane defaults (happy path)", () => {
    delete process.env.BCRYPT_ROUNDS;
    delete process.env.RATE_LIMIT_TTL;
    delete process.env.RATE_LIMIT_LIMIT;
    delete process.env.ENCRYPTION_KEY;
    delete process.env.CORS_ENABLED;
    delete process.env.ALLOWED_ORIGINS;

    const cfg = getConfig();

    expect(cfg.apiKey).toEqual({ saltRounds: 12, keyLength: 64, keyPrefix: "pk_live_" });
    expect(cfg.rateLimit.ttl).toBe(60);
    expect(cfg.rateLimit.limit).toBe(100);
    expect(cfg.cors.enabled).toBe(false);
    expect(cfg.cors.origin).toEqual(["http://localhost:3000"]);
    expect(cfg.encryption.algorithm).toBe("aes-256-gcm");
    expect(cfg.session.cookie.sameSite).toBe("strict");
    expect(cfg.audit.enabled).toBe(true);
  });

  it("should parse numeric envs and booleans correctly (happy path)", () => {
    process.env.BCRYPT_ROUNDS = "14";
    process.env.RATE_LIMIT_TTL = "120";
    process.env.RATE_LIMIT_LIMIT = "250";
    process.env.CORS_ENABLED = "true";
    process.env.ALLOWED_ORIGINS = "http://a.com,http://b.com";
    process.env.WEBHOOK_TIMEOUT = "40000";

    const cfg = getConfig();

    expect(cfg.apiKey.saltRounds).toBe(14);
    expect(cfg.rateLimit.ttl).toBe(120);
    expect(cfg.rateLimit.limit).toBe(250);
    expect(cfg.cors.enabled).toBe(true);
    expect(cfg.cors.origin).toEqual(["http://a.com", "http://b.com"]);
    expect(cfg.webhook.timeout).toBe(40000);
  });

  it("should fallback for invalid numbers (negative scenario)", () => {
    process.env.BCRYPT_ROUNDS = "NaN";
    process.env.RATE_LIMIT_TTL = "oops";
    process.env.RATE_LIMIT_LIMIT = "";

    const cfg = getConfig();

    expect(cfg.apiKey.saltRounds).toBe(12);
    expect(cfg.rateLimit.ttl).toBe(60);
    expect(cfg.rateLimit.limit).toBe(100);
  });

  it("should derive production flags from NODE_ENV (edge case)", () => {
    process.env.NODE_ENV = "production";
    const cfg = getConfig();

    expect(cfg.session.cookie.secure).toBe(true);
    expect(cfg.pciDss.requirements.requireTwoFactor).toBe(true);
    expect(cfg.monitoring.metrics.authentication).toBe(true);
    expect(cfg.audit.realTimeAlerts.enabled).toBe(true);
  });

  it("should respect IP whitelist envs and headers (happy path)", () => {
    process.env.IP_WHITELIST_ENABLED = "true";
    process.env.ALLOWED_IPS = "1.1.1.1,2.2.2.2";
    process.env.ADMIN_IPS = "3.3.3.3";
    process.env.WEBHOOK_SIGNATURE_HEADER = "X-Custom";

    const cfg = getConfig();

    expect(cfg.ipWhitelist.enabled).toBe(true);
    expect(cfg.ipWhitelist.allowedIps).toEqual(["1.1.1.1", "2.2.2.2"]);
    expect(cfg.ipWhitelist.adminIps).toEqual(["3.3.3.3"]);
    expect(cfg.webhook.signatureHeader).toBe("X-Custom");
  });
});
