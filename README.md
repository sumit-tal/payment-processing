# Payment Processing System

Enterprise-grade payment processing system built with NestJS, TypeScript, and PostgreSQL. This system provides secure, scalable payment processing capabilities with comprehensive webhook handling, audit logging, and PCI DSS compliance features.

## 🏗️ Architecture Overview

The system is designed as a modular, microservices-ready application with the following key components:

- **Payment Processing Engine** - Core payment transaction handling with multiple gateway support
- **Webhook Processing System** - Asynchronous event processing with AWS SQS integration
- **Security & Compliance Module** - PCI DSS compliant API key management and audit logging
- **Subscription Management** - Recurring payment and subscription lifecycle management
- **Observability Stack** - Comprehensive monitoring, metrics, and distributed tracing

## ✨ Key Features

- 🚀 **NestJS Framework** - Scalable Node.js server-side applications with dependency injection
- 🔒 **TypeScript** - Type-safe development with strict typing and comprehensive interfaces
- 🗄️ **PostgreSQL** - Robust relational database with TypeORM and automated migrations
- 🔐 **Security & Compliance** - PCI DSS compliant with API keys, rate limiting, comprehensive audit logging
- 📡 **Webhook Processing** - Asynchronous webhook handling with AWS SQS, dead letter queues, and retry logic
- 📈 **Observability & Metrics** - Prometheus metrics, distributed tracing, structured logging with correlation IDs
- 🔄 **Redis Integration** - High-performance caching and rate limiting backend
- 📊 **Health Checks** - Comprehensive application and dependency monitoring
- 🐳 **Docker Support** - Containerized development and production deployment
- 📝 **API Documentation** - Auto-generated Swagger/OpenAPI documentation
- 🧪 **Testing** - Comprehensive Jest unit and e2e testing with 90%+ coverage
- 🔍 **Code Quality** - ESLint, Prettier, and TypeScript strict mode configuration
- ⚡ **Background Workers** - Scalable webhook processing with exponential backoff and failure handling

## Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Docker and Docker Compose
- PostgreSQL 15+ (if running locally)

## 🚀 Quick Start

### Using Docker (Recommended)

1. **Clone and setup environment**

   ```bash
   git clone <repository-url>
   cd payment-processing-system
   cp .env.example .env
   ```

2. **Configure environment variables**
   Edit `.env` file with your specific configuration:

   ```bash
   # Required: Update these values
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ENCRYPTION_KEY=your-encryption-key-change-this-in-production
   WEBHOOK_SECRET_KEY=your-webhook-secret-key-change-this-in-production

   # Optional: Payment gateway credentials (for testing)
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   AUTHORIZENET_API_LOGIN_ID=your_api_login_id
   AUTHORIZENET_TRANSACTION_KEY=your_transaction_key
   ```

3. **Start all services**

   ```bash
   docker-compose up -d
   ```

4. **Verify deployment**

   ```bash
   # Check service health
   curl http://localhost:3000/api/v1/health

   # View logs
   docker-compose logs -f app
   ```

5. **Access the application**
   - **API**: http://localhost:3000
   - **Documentation**: http://localhost:3000/api/docs
   - **Health Check**: http://localhost:3000/api/v1/health
   - **Metrics**: http://localhost:3000/metrics

### Local Development Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Setup environment**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration (see Docker section above)
   ```

3. **Start infrastructure services**

   ```bash
   # Start PostgreSQL and Redis only
   docker-compose up -d postgres redis

   # Wait for services to be ready
   docker-compose logs postgres redis
   ```

4. **Initialize database**

   ```bash
   # Run database migrations
   npm run migration:run

   # Verify database setup
   npm run typeorm -- query "SELECT version();"
   ```

5. **Start development server**

   ```bash
   # Start with hot reload
   npm run start:dev

   # Or start in debug mode
   npm run start:debug
   ```

6. **Start background workers** (in separate terminal)
   ```bash
   # The webhook worker starts automatically with the main application
   # Monitor worker logs in the application output
   ```

## 📋 Available Scripts

### Development

- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start server in debug mode with inspector
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run start:prod` - Start production server (alternative)

### Database Management

- `npm run migration:generate -- src/migrations/MigrationName` - Generate new migration
- `npm run migration:run` - Run pending migrations
- `npm run migration:revert` - Revert last migration
- `npm run typeorm -- query "SELECT * FROM users LIMIT 5;"` - Execute raw SQL queries

### Testing

- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage report
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:debug` - Run tests in debug mode

### Code Quality

- `npm run lint` - Run ESLint linter
- `npm run format` - Format code with Prettier
- `npm run lint -- --fix` - Auto-fix linting issues

## 🗄️ Database Setup & Configuration

### Automated Setup (Docker)

The Docker setup automatically initializes the database with:

- PostgreSQL 15 with required extensions (`uuid-ossp`, `pgcrypto`)
- Audit logging schema and triggers
- Initial database structure via `scripts/init-db.sql`

### Manual Database Setup

1. **Create database and user**

   ```sql
   -- Connect as postgres superuser
   CREATE DATABASE payment_processing;
   CREATE USER payment_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE payment_processing TO payment_user;
   ```

2. **Run initialization script**

   ```bash
   # Execute the initialization script
   psql -h localhost -U postgres -d payment_processing -f scripts/init-db.sql
   ```

3. **Run migrations**

   ```bash
   npm run migration:run
   ```

4. **Verify setup**

   ```bash
   # Check database connection
   npm run typeorm -- query "SELECT current_database(), current_user;"

   # List all tables
   npm run typeorm -- query "SELECT tablename FROM pg_tables WHERE schemaname = 'payment_processing';"
   ```

### Database Features

- **Audit Logging**: Automatic change tracking for all entities
- **UUID Primary Keys**: Using `uuid-ossp` extension for secure identifiers
- **Encryption Support**: `pgcrypto` extension for sensitive data
- **Connection Pooling**: Configurable connection limits and timeouts
- **Migration System**: Version-controlled schema changes

## ⚡ Background Workers & Queue Management

### Webhook Processing System

The system includes a sophisticated webhook processing worker that:

- **Polls AWS SQS** for incoming webhook events
- **Processes events asynchronously** with configurable concurrency
- **Implements retry logic** with exponential backoff
- **Handles dead letter queues** for failed events
- **Provides comprehensive logging** and monitoring

### Worker Configuration

```bash
# Environment variables for worker tuning
WEBHOOK_POLLING_INTERVAL_MS=5000        # How often to poll SQS (ms)
WEBHOOK_MAX_CONCURRENT_MESSAGES=10      # Max concurrent message processing
WEBHOOK_TIMEOUT=30000                   # Processing timeout per message (ms)
SQS_VISIBILITY_TIMEOUT=300              # SQS message visibility timeout
SQS_MAX_RECEIVE_COUNT=3                 # Max retries before DLQ
```

### Starting Workers

**Docker Environment:**

```bash
# Workers start automatically with the application
docker-compose up -d

# Monitor worker logs
docker-compose logs -f app | grep "WebhookWorkerService"
```

**Local Development:**

```bash
# Workers start with the main application
npm run start:dev

# Monitor in application logs:
# [WebhookWorkerService] Starting webhook worker service
# [WebhookWorkerService] Processing webhook messages { messageCount: 5 }
```

### Worker Management Commands

```bash
# Check worker health via API
curl http://localhost:3000/api/v1/health

# View webhook processing stats
curl http://localhost:3000/api/v1/webhooks/stats

# Monitor SQS queue status (requires AWS CLI)
aws sqs get-queue-attributes --queue-url $SQS_WEBHOOK_QUEUE_URL --attribute-names All
```

### Supported Webhook Events

- `PAYMENT_AUTHORIZED` - Payment authorization received
- `PAYMENT_CAPTURED` - Payment successfully captured
- `PAYMENT_SETTLED` - Payment settled by gateway
- `PAYMENT_FAILED` - Payment processing failed
- `PAYMENT_REFUNDED` - Refund processed
- `PAYMENT_VOIDED` - Payment authorization voided
- `SUBSCRIPTION_CREATED` - New subscription created
- `SUBSCRIPTION_UPDATED` - Subscription modified
- `SUBSCRIPTION_CANCELLED` - Subscription cancelled
- `SUBSCRIPTION_EXPIRED` - Subscription expired
- `SUBSCRIPTION_PAYMENT_SUCCESS` - Recurring payment succeeded
- `SUBSCRIPTION_PAYMENT_FAILED` - Recurring payment failed

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

### Core Application

| Variable          | Description          | Default                 | Required |
| ----------------- | -------------------- | ----------------------- | -------- |
| `NODE_ENV`        | Environment mode     | `development`           | ✅       |
| `PORT`            | Application port     | `3000`                  | ✅       |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:3000` | ✅       |

### Database Configuration

| Variable             | Description           | Default              | Required |
| -------------------- | --------------------- | -------------------- | -------- |
| `DB_HOST`            | Database host         | `localhost`          | ✅       |
| `DB_PORT`            | Database port         | `5432`               | ✅       |
| `DB_USERNAME`        | Database username     | `postgres`           | ✅       |
| `DB_PASSWORD`        | Database password     | `password`           | ✅       |
| `DB_NAME`            | Database name         | `payment_processing` | ✅       |
| `DB_SSL`             | Enable SSL connection | `false`              | ❌       |
| `DB_MAX_CONNECTIONS` | Connection pool size  | `10`                 | ❌       |

### Security & Authentication

| Variable         | Description             | Default | Required |
| ---------------- | ----------------------- | ------- | -------- |
| `JWT_SECRET`     | JWT signing secret      | -       | ✅       |
| `JWT_EXPIRES_IN` | JWT expiration time     | `1d`    | ❌       |
| `ENCRYPTION_KEY` | Data encryption key     | -       | ✅       |
| `BCRYPT_ROUNDS`  | Password hashing rounds | `12`    | ❌       |

### Payment Gateways

| Variable                       | Description                   | Default   | Required |
| ------------------------------ | ----------------------------- | --------- | -------- |
| `STRIPE_SECRET_KEY`            | Stripe secret key             | -         | ❌       |
| `STRIPE_WEBHOOK_SECRET`        | Stripe webhook secret         | -         | ❌       |
| `AUTHORIZENET_API_LOGIN_ID`    | Authorize.Net API login       | -         | ❌       |
| `AUTHORIZENET_TRANSACTION_KEY` | Authorize.Net transaction key | -         | ❌       |
| `AUTHORIZENET_ENVIRONMENT`     | Authorize.Net environment     | `sandbox` | ❌       |

### AWS & Queue Configuration

| Variable                | Description               | Default     | Required |
| ----------------------- | ------------------------- | ----------- | -------- |
| `AWS_REGION`            | AWS region                | `us-east-1` | ✅       |
| `AWS_ACCESS_KEY_ID`     | AWS access key            | -           | ✅       |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key            | -           | ✅       |
| `SQS_WEBHOOK_QUEUE_URL` | SQS webhook queue URL     | -           | ✅       |
| `SQS_WEBHOOK_DLQ_URL`   | SQS dead letter queue URL | -           | ✅       |

## API Documentation

The API documentation is automatically generated using Swagger and available at:

- Development: http://localhost:3000/api/docs
- Production: https://your-domain.com/api/docs

### Key Endpoints

- **Security**: `/api/v1/api-keys`, `/api/v1/audit-logs`, `/api/v1/security/compliance`
- **Webhooks**: `/api/v1/webhooks/authorize-net`, `/api/v1/webhooks/events`
- **Observability**: `/api/v1/observability/metrics`, `/api/v1/health`
- **Payments**: `/api/v1/payments`, `/api/v1/subscriptions`

## 🏥 Health Checks & Monitoring

### Health Check Endpoints

- `/api/v1/health` - Overall application health status
- `/api/v1/health/database` - Database connectivity check
- `/api/v1/health/redis` - Redis connectivity check
- `/api/v1/health/sqs` - AWS SQS connectivity check

### Monitoring & Metrics

- `/metrics` - Prometheus metrics endpoint
- `/api/v1/observability/metrics` - Application-specific metrics
- `/api/v1/observability/traces` - Distributed tracing information

### Health Check Response Format

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "sqs": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "sqs": { "status": "up" }
  }
}
```

## 🧪 Testing

### Running Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:cov

# Run end-to-end tests
npm run test:e2e

# Run tests in debug mode
npm run test:debug
```

### Test Coverage

The project maintains high test coverage with comprehensive unit and integration tests:

- **Unit Tests**: Individual service and controller testing
- **Integration Tests**: Database and external service integration
- **E2E Tests**: Full application workflow testing
- **Coverage Target**: 90%+ code coverage

## 🗃️ Database Migrations

### Migration Commands

```bash
# Generate a new migration
npm run migration:generate -- src/migrations/MigrationName

# Run pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert

# Show migration status
npm run typeorm -- migration:show
```

### Migration Best Practices

- Always review generated migrations before running
- Test migrations on development data first
- Use descriptive migration names
- Include both up and down migration logic
- Never modify existing migrations in production

## Security & Compliance

- PCI DSS SAQ A compliant implementation
- API key authentication with secure generation and validation
- Rate limiting with Redis backend to prevent API abuse
- Comprehensive audit logging with data retention policies
- Data encryption using AES-256-GCM for sensitive information
- Security guards and decorators for endpoint protection
- Automated PCI DSS compliance validation and reporting

## Webhook Processing

- AWS SQS integration for reliable asynchronous event handling
- Authorize.Net webhook validation with HMAC-SHA512 signature verification
- Comprehensive webhook endpoint with payload validation and timestamp checking
- Asynchronous worker service with exponential backoff and retry logic
- Dead letter queue handling for failed events
- Multi-layer idempotency mechanisms to prevent duplicate processing

## Observability & Metrics

- Prometheus metrics endpoint for system performance monitoring
- Distributed tracing with correlation IDs for request tracking
- Structured logging with PCI-compliant sensitive data masking
- Automatic request/response logging and metrics collection
- Tracing service for end-to-end request tracking with span management
- Real-time system performance monitoring with comprehensive indicators
- Security event logging with severity levels and audit trails

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Rebuild and start
docker-compose up -d --build

# View specific service logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Execute commands in running containers
docker-compose exec app npm run migration:run
docker-compose exec postgres psql -U postgres -d payment_processing
```

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test database connection
npm run typeorm -- query "SELECT 1;"
```

#### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli ping
```

#### Migration Issues

```bash
# Check migration status
npm run typeorm -- migration:show

# Reset database (development only)
docker-compose down -v
docker-compose up -d postgres redis
npm run migration:run
```

#### Worker Not Processing Events

```bash
# Check SQS queue status
aws sqs get-queue-attributes --queue-url $SQS_WEBHOOK_QUEUE_URL --attribute-names All

# Check worker logs
docker-compose logs -f app | grep "WebhookWorkerService"

# Verify AWS credentials
aws sts get-caller-identity
```

#### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process using port
kill -9 $(lsof -t -i:3000)
```

### Performance Optimization

#### Database Performance

- Monitor connection pool usage via health checks
- Use database indexes for frequently queried fields
- Enable query logging in development: `DB_LOGGING=true`

#### Redis Performance

- Monitor Redis memory usage
- Configure appropriate eviction policies
- Use Redis clustering for high availability

#### Worker Performance

- Adjust `WEBHOOK_MAX_CONCURRENT_MESSAGES` based on load
- Monitor SQS queue depth and processing times
- Scale workers horizontally if needed

### Debugging

#### Enable Debug Logging

```bash
# Set log level to debug
LOG_LEVEL=debug npm run start:dev

# Enable TypeORM query logging
DB_LOGGING=true npm run start:dev
```

#### Debug Database Queries

```bash
# Enable SQL query logging
DB_LOGGING=true

# Run specific queries
npm run typeorm -- query "SELECT * FROM audit.audit_log ORDER BY created_at DESC LIMIT 10;"
```

#### Monitor Application Metrics

```bash
# View Prometheus metrics
curl http://localhost:3000/metrics

# Check application health
curl http://localhost:3000/api/v1/health
```

## Code Quality

The project enforces code quality through:

- **ESLint** - Code linting with TypeScript rules
- **Prettier** - Code formatting
- **TypeScript** - Strict type checking
- **Jest** - Unit and integration testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.
