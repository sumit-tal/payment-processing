# Payment Processing System

Enterprise-grade payment processing system built with NestJS, TypeScript, and PostgreSQL.

## Features

- 🚀 **NestJS Framework** - Scalable Node.js server-side applications
- 🔒 **TypeScript** - Type-safe development with strict typing
- 🗄️ **PostgreSQL** - Robust relational database with TypeORM
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
│   ├── health/       # Health check module
│   ├── payments/     # Payment processing
│   └── users/        # User management
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

## API Documentation

The API documentation is automatically generated using Swagger and available at:
- Development: http://localhost:3000/api/docs
- Production: https://your-domain.com/api/docs

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
