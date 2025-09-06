import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware to generate and propagate correlation IDs for distributed tracing
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly CORRELATION_ID_HEADER = 'x-correlation-id';

  use(req: Request, res: Response, next: NextFunction): void {
    // Get correlation ID from header or generate new one
    const correlationId = req.headers[this.CORRELATION_ID_HEADER] as string || randomUUID();
    
    // Store correlation ID in request for access throughout the request lifecycle
    req['correlationId'] = correlationId;
    
    // Set correlation ID in response header
    res.setHeader(this.CORRELATION_ID_HEADER, correlationId);
    
    // Continue to next middleware
    next();
  }
}
