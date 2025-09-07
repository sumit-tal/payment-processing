/*
 * Application configuration with strong typing.
 */
type DbConfig = {
  readonly dbConnectionString: string;
  readonly synchronize: boolean;
  readonly poolsize: number;
  readonly logging: boolean;
};
type AppConfiguration = {
  readonly db: DbConfig;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
};

const toNum = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const buildDbConnectionString = (): string => {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 5432);
  const username = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'password';
  const database = process.env.DB_NAME || 'payment_processing';
  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

const configuration: AppConfiguration = {
  db: {
    dbConnectionString: process.env.DB_URL || buildDbConnectionString(),
    synchronize: toBool(process.env.DB_SYNCHRONIZE, false),
    poolsize: toNum(process.env.DB_MAX_CONNECTIONS, 10),
    logging: toBool(process.env.DB_LOGGING, false),
  },
};

export default configuration;
