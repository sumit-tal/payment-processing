# Payment Processing System

Enterprise-grade payment processing system built with NestJS, TypeScript, and PostgreSQL.

## Features

- 🚀 **NestJS Framework** - Scalable Node.js server-side applications
- 🔒 **TypeScript** - Type-safe development with strict typing
- 🗄️ **PostgreSQL** - Robust relational database with TypeORM
- 🔐 **Security & Compliance** - PCI DSS compliant with API keys, rate limiting, audit logging
- 📡 **Webhook Processing** - Asynchronous webhook handling with AWS SQS and Authorize.Net integration
- 📈 **Observability & Metrics** - Prometheus metrics, distributed tracing, structured logging
- 🔄 **Redis Integration** - Caching and rate limiting backend
- 📊 **Health Checks** - Comprehensive application monitoring
- 🐳 **Docker Support** - Containerized development and deployment
- 📝 **API Documentation** - Swagger/OpenAPI integration
- 🧪 **Testing** - Jest unit and e2e testing setup
- 🔍 **Code Quality** - ESLint and Prettier configuration

## Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Docker and Docker Compose
- PostgreSQL 15+ (if running locally)

## Quick Start

### Using Docker (Recommended)

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd payment-processing-system
   cp .env.example .env
   ```

2. **Start services**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - API: http://localhost:3000
   - Documentation: http://localhost:3000/api/docs
   - Health Check: http://localhost:3000/api/v1/health

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start PostgreSQL**
   ```bash
   docker-compose up -d postgres redis
   ```

4. **Run migrations**
   ```bash
   npm run migration:run
   ```

5. **Start development server**
   ```bash
   npm run start:dev
   ```

## Available Scripts

- `npm run build` - Build the application
- `npm run start` - Start production server
- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start server in debug mode
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage
- `npm run test:e2e` - Run end-to-end tests

## Project Structure

```
src/
├── common/           # Shared utilities and decorators
│   ├── decorators/   # Custom decorators
│   ├── filters/      # Exception filters
│   ├── guards/       # Authentication guards
│   ├── interceptors/ # Request/response interceptors
│   └── pipes/        # Validation pipes
├── config/           # Configuration files
│   └── database.config.ts
├── modules/          # Feature modules
│   ├── audit/        # Audit logging module
│   ├── auth/         # Authentication module
│   ├── health/       # Health check module
│   ├── observability/# Observability and metrics module
│   ├── payments/     # Payment processing
│   ├── users/        # User management
│   └── webhooks/     # Webhook processing module
├── app.controller.ts # Root controller
├── app.module.ts     # Root module
├── app.service.ts    # Root service
└── main.ts          # Application entry point
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Application port | `3000` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `password` |
| `DB_NAME` | Database name | `payment_processing` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT secret key | (required) |
| `STRIPE_SECRET_KEY` | Stripe secret key | (required) |
| `AUTHORIZENET_API_LOGIN_ID` | Authorize.Net API login ID | (required) |
| `AWS_REGION` | AWS region | `us-east-1` |
| `SQS_WEBHOOK_QUEUE_URL` | SQS webhook queue URL | (required) |
| `WEBHOOK_SECRET_KEY` | Webhook secret key | (required) |

## API Documentation

The API documentation is automatically generated using Swagger and available at:
- Development: http://localhost:3000/api/docs
- Production: https://your-domain.com/api/docs

### Key Endpoints

- **Security**: `/api-keys`, `/audit-logs`, `/security/compliance`
- **Webhooks**: `/webhooks/authorize-net`, `/webhooks/events`
- **Observability**: `/observability/metrics`, `/observability/health`

## Health Checks

Health check endpoints are available at:
- `/api/v1/health` - Overall application health
- `/api/v1/health/database` - Database connectivity

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Database Migrations

```bash
# Generate migration
npm run migration:generate -- src/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

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

## Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Rebuild and start
docker-compose up -d --build
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
