# Payment Processing Module

This module implements core payment flows using Authorize.Net as the payment gateway, following industry standards for security, reliability, and maintainability.

## Features

### Core Payment Flows

- **Purchase (Auth + Capture)**: Single-step payment processing
- **Authorization + Capture**: Two-step payment processing for delayed capture
- **Cancel/Void**: Cancel authorized transactions before capture
- **Refund**: Full and partial refunds for completed transactions

### Enterprise Features

- **Idempotency**: Prevents duplicate transactions using idempotency keys
- **Database Transactions**: Ensures data consistency with ACID properties
- **Comprehensive Logging**: Detailed logging for audit and debugging
- **Error Handling**: Robust error handling with proper HTTP status codes
- **Type Safety**: Full TypeScript support with strict typing
- **Validation**: Input validation using class-validator decorators
- **API Documentation**: OpenAPI/Swagger documentation

## Architecture

### Database Entities

- `Transaction`: Core transaction records with status tracking
- `PaymentMethod`: Stored payment method information

### Services

- `PaymentService`: Main orchestration service with business logic
- `AuthorizeNetService`: Gateway-specific implementation for Authorize.Net

### Controllers

- `PaymentController`: RESTful API endpoints with proper HTTP semantics

## API Endpoints

### POST /payments/purchase

Create a purchase transaction (auth + capture in one step).

```typescript
{
  "amount": 99.99,
  "currency": "USD",
  "paymentMethod": "credit_card",
  "creditCard": {
    "cardNumber": "4111111111111111",
    "expiryMonth": 12,
    "expiryYear": 2025,
    "cvv": "123",
    "cardholderName": "John Doe",
    "billingAddress": {
      "address": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "zip": "12345",
      "country": "US"
    }
  },
  "idempotencyKey": "unique-key-123"
}
```

### POST /payments/authorize

Create an authorization transaction (hold funds without capture).

### POST /payments/capture

Capture a previously authorized transaction.

```typescript
{
  "transactionId": "transaction-uuid",
  "amount": 50.00, // Optional: partial capture
  "idempotencyKey": "capture-key-123"
}
```

### POST /payments/refund

Refund a completed transaction (full or partial).

```typescript
{
  "transactionId": "transaction-uuid",
  "amount": 25.00, // Optional: partial refund
  "reason": "Customer request",
  "idempotencyKey": "refund-key-123"
}
```

### POST /payments/cancel

Cancel/void an authorized transaction before capture.

```typescript
{
  "transactionId": "transaction-uuid",
  "reason": "Order cancelled",
  "idempotencyKey": "cancel-key-123"
}
```

### GET /payments/:id

Retrieve transaction details by ID.

## Configuration

Add these environment variables to your `.env` file:

```bash
# Authorize.Net Configuration
AUTHORIZENET_API_LOGIN_ID=your_api_login_id
AUTHORIZENET_TRANSACTION_KEY=your_transaction_key
AUTHORIZENET_ENVIRONMENT=sandbox
```

## Transaction States

```
PENDING → PROCESSING → COMPLETED
                   ↘ FAILED

COMPLETED → PARTIALLY_REFUNDED → REFUNDED
         ↘ CANCELLED (for auth-only)
```

## Idempotency

All payment operations require an `idempotencyKey` to prevent duplicate processing:

- Same key with same parameters: Returns existing transaction
- Same key with different parameters: Returns 409 Conflict
- Key already processing: Returns 409 Conflict

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Success (capture, refund, cancel)
- `201`: Created (purchase, authorization)
- `400`: Bad Request (validation errors, business rule violations)
- `404`: Not Found (transaction not found)
- `409`: Conflict (idempotency violations)
- `500`: Internal Server Error (system errors)

## Security Considerations

- Credit card data is not stored in the database
- All sensitive data is masked in logs
- Input validation prevents injection attacks
- Database transactions ensure data consistency
- Proper error messages prevent information leakage

## Testing

Run the test suite:

```bash
npm test src/modules/payments
```

The tests cover:

- All payment flows (purchase, auth/capture, refund, cancel)
- Idempotency mechanisms
- Error scenarios
- Database transaction rollbacks
- Gateway integration scenarios

## Usage Examples

### Basic Purchase

```typescript
const paymentService = new PaymentService(/* dependencies */);

const result = await paymentService.createPurchase({
  amount: 100.0,
  currency: 'USD',
  paymentMethod: PaymentMethodType.CREDIT_CARD,
  creditCard: {
    /* card details */
  },
  idempotencyKey: 'unique-purchase-key',
});
```

### Authorization + Capture Flow

```typescript
// Step 1: Authorize
const authResult = await paymentService.createAuthorization({
  amount: 100.0,
  currency: 'USD',
  paymentMethod: PaymentMethodType.CREDIT_CARD,
  creditCard: {
    /* card details */
  },
  idempotencyKey: 'auth-key',
});

// Step 2: Capture (can be partial)
const captureResult = await paymentService.capturePayment({
  transactionId: authResult.transactionId,
  amount: 75.0, // Partial capture
  idempotencyKey: 'capture-key',
});
```

## Database Schema

The module creates two main tables:

- `transactions`: Core transaction records with full audit trail
- `payment_methods`: Stored payment method information (optional)

Indexes are created for optimal query performance on frequently accessed columns.

## Monitoring and Observability

- All operations are logged with correlation IDs
- Transaction states are tracked for monitoring
- Gateway responses are stored for debugging
- Metrics can be extracted from transaction status changes
