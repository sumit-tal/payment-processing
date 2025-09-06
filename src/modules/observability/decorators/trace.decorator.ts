import { SetMetadata } from '@nestjs/common';

export const TRACE_METADATA = 'trace_metadata';

export interface TraceOptions {
  operationName?: string;
  component?: string;
  tags?: Record<string, any>;
}

/**
 * Decorator to enable distributed tracing for methods
 */
export const Trace = (options?: TraceOptions) => {
  return SetMetadata(TRACE_METADATA, options || {});
};

/**
 * Decorator to mark payment operations for enhanced tracing
 */
export const TracePayment = (operationType: string) => {
  return Trace({
    operationName: `payment.${operationType}`,
    component: 'payment',
    tags: { 'payment.type': operationType },
  });
};

/**
 * Decorator to mark security operations for enhanced tracing
 */
export const TraceSecurity = (operationType: string) => {
  return Trace({
    operationName: `security.${operationType}`,
    component: 'security',
    tags: { 'security.type': operationType },
  });
};
