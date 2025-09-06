# Subscription Module Documentation

## Overview

The Subscription Module provides comprehensive recurring billing functionality using Authorize.Net's Automated Recurring Billing (ARB) service. This module follows industry standards for subscription management and includes robust error handling, retry mechanisms, and comprehensive audit trails.

## Features

### Core Functionality
- **Subscription Plans Management**: Create, update, and manage subscription plans with flexible billing intervals
- **Customer Subscriptions**: Enroll customers in subscription plans with trial periods and custom start dates
- **Automated Billing**: Process recurring payments automatically with configurable schedules
- **Payment Retry Logic**: Intelligent retry mechanism for failed payments with exponential backoff
- **Subscription Lifecycle**: Handle subscription states (active, cancelled, expired, past due, etc.)
- **Audit Trail**: Complete transaction history and subscription event logging

### Industry Standards Compliance
- **PCI DSS**: No sensitive card data stored locally
- **Idempotency**: Prevent duplicate charges with unique transaction keys
- **Data Integrity**: ACID-compliant database transactions
- **Error Handling**: Comprehensive error responses with proper HTTP status codes
- **Logging**: Detailed audit logs for compliance and debugging

## Architecture

### Database Entities

#### SubscriptionPlan
- Defines billing amounts, intervals, and plan metadata
- Supports daily, weekly, monthly, quarterly, and yearly billing
- Configurable trial periods and setup fees
- Maximum billing cycles for finite subscriptions

#### Subscription
- Links customers to subscription plans and payment methods
- Tracks billing cycles, payment history, and subscription status
- Maintains current period information and next billing dates
- Stores gateway subscription IDs for external system sync

#### SubscriptionPayment
- Records individual billing attempts and outcomes
- Tracks retry attempts and failure reasons
- Links to transaction records for payment processing
- Supports partial payment tracking and reconciliation

### Services

#### SubscriptionPlanService
- CRUD operations for subscription plans
- Plan availability validation
- Business logic for plan lifecycle management

#### SubscriptionService
- Core subscription management functionality
- Authorize.Net ARB integration for recurring billing setup
- Subscription lifecycle event handling (creation, updates, cancellation)

#### SubscriptionBillingService
- Automated recurring payment processing
- Failed payment retry logic with exponential backoff
- Subscription status updates based on payment outcomes
- Billing cycle management and period calculations

## API Endpoints

### Subscription Plans
```
POST   /subscription-plans              # Create new plan
GET    /subscription-plans              # List all plans (with filters)
GET    /subscription-plans/:id          # Get plan details
PUT    /subscription-plans/:id          # Update plan
PUT    /subscription-plans/:id/deactivate # Deactivate plan
PUT    /subscription-plans/:id/archive  # Archive plan
DELETE /subscription-plans/:id          # Delete plan (permanent)
```

### Subscriptions
```
POST   /subscriptions                   # Create new subscription
GET    /subscriptions/:id               # Get subscription details
GET    /subscriptions?customerId=:id    # Get customer subscriptions
PUT    /subscriptions/:id               # Update subscription
PUT    /subscriptions/:id/cancel        # Cancel subscription
```

## Usage Examples

### Creating a Subscription Plan
```typescript
const planDto: CreateSubscriptionPlanDto = {
  name: "Premium Monthly",
  description: "Premium features with monthly billing",
  amount: 29.99,
  currency: "USD",
  billingInterval: BillingInterval.MONTHLY,
  billingIntervalCount: 1,
  trialPeriodDays: 14,
  setupFee: 0,
  metadata: {
    features: ["feature1", "feature2"],
    tier: "premium"
  }
};

const plan = await subscriptionPlanService.createPlan(planDto);
```

### Creating a Subscription
```typescript
const subscriptionDto: CreateSubscriptionDto = {
  customerId: "customer-uuid",
  subscriptionPlanId: "plan-uuid",
  paymentMethodId: "payment-method-uuid",
  startDate: "2024-01-01T00:00:00Z",
  metadata: {
    source: "web",
    campaign: "holiday-promo"
  }
};

const subscription = await subscriptionService.createSubscription(subscriptionDto);
```

### Processing Recurring Billing
```typescript
// Manual trigger for billing processing
await subscriptionBillingService.processRecurringBilling();

// Process failed payment retries
await subscriptionBillingService.processFailedPaymentRetries();

// Process specific subscription
await subscriptionBillingService.processSubscriptionBillingManual(subscriptionId);
```

## Configuration

### Environment Variables
```env
AUTHORIZENET_API_LOGIN_ID=your_api_login_id
AUTHORIZENET_TRANSACTION_KEY=your_transaction_key
AUTHORIZENET_ENVIRONMENT=sandbox  # or 'production'
```

### Database Migration
Run the subscription tables migration:
```bash
npm run migration:run
```

## Error Handling

### Common Error Scenarios
- **Invalid Payment Method**: Returns 404 when payment method not found or inactive
- **Plan Unavailable**: Returns 400 when subscription plan is inactive or archived
- **Gateway Errors**: Handles Authorize.Net API errors with appropriate retry logic
- **Duplicate Subscriptions**: Prevents duplicate active subscriptions per customer/plan

### Retry Logic
- **Failed Payments**: Up to 3 retry attempts with exponential backoff (30min, 1hr, 2hr, 4hr)
- **Gateway Timeouts**: Automatic retry for network-related failures
- **Subscription Status**: Updates to "past_due" after multiple failed attempts

## Monitoring and Observability

### Logging
- All subscription operations logged with correlation IDs
- Payment processing events with detailed gateway responses
- Error conditions with stack traces for debugging

### Metrics
- Subscription creation/cancellation rates
- Payment success/failure rates
- Retry attempt statistics
- Revenue tracking per subscription plan

## Security Considerations

### Data Protection
- No sensitive payment data stored in application database
- Payment methods reference gateway tokens only
- Subscription metadata encrypted at rest

### Access Control
- API endpoints require proper authentication
- Customer data isolation enforced at service level
- Admin operations require elevated privileges

## Testing

### Unit Tests
- Comprehensive test coverage for all services (80%+ target)
- Mock external dependencies (Authorize.Net API)
- Test error conditions and edge cases

### Integration Tests
- End-to-end subscription lifecycle testing
- Payment processing workflow validation
- Database transaction integrity verification

## Deployment Considerations

### Production Setup
1. Configure Authorize.Net production credentials
2. Set up monitoring and alerting for failed payments
3. Schedule recurring billing job (recommended: hourly)
4. Configure backup and disaster recovery procedures

### Scaling
- Database indexes optimized for subscription queries
- Async processing for bulk billing operations
- Horizontal scaling support for high-volume scenarios

## Future Enhancements

### Planned Features
- Proration support for plan changes
- Usage-based billing integration
- Multi-currency support
- Subscription analytics dashboard
- Webhook notifications for subscription events

### Integration Opportunities
- Email notifications for billing events
- Customer portal for subscription management
- Revenue recognition and reporting
- Tax calculation integration
