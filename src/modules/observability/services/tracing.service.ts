import { Injectable } from '@nestjs/common';
import { Request } from 'express';

export interface TraceContext {
  correlationId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: Date;
    level: string;
    message: string;
    fields?: Record<string, any>;
  }>;
}

/**
 * Service for managing distributed tracing and span context
 */
@Injectable()
export class TracingService {
  private readonly activeSpans = new Map<string, TraceContext>();

  /**
   * Extract correlation ID from request
   */
  getCorrelationId(req: Request): string {
    return req['correlationId'] || 'unknown';
  }

  /**
   * Start a new trace span
   */
  startSpan(operationName: string, correlationId: string, parentSpanId?: string): TraceContext {
    const spanId = this.generateSpanId();
    const traceId = parentSpanId ? this.getTraceId(parentSpanId) : this.generateTraceId();
    
    const span: TraceContext = {
      correlationId,
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: new Date(),
      tags: {},
      logs: [],
    };

    this.activeSpans.set(spanId, span);
    return span;
  }

  /**
   * Finish a trace span
   */
  finishSpan(spanId: string): TraceContext | null {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      return null;
    }

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    
    this.activeSpans.delete(spanId);
    return span;
  }

  /**
   * Add tags to a span
   */
  setSpanTags(spanId: string, tags: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags = { ...span.tags, ...tags };
    }
  }

  /**
   * Add log entry to a span
   */
  logToSpan(spanId: string, level: string, message: string, fields?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: new Date(),
        level,
        message,
        fields,
      });
    }
  }

  /**
   * Get active span by ID
   */
  getSpan(spanId: string): TraceContext | undefined {
    return this.activeSpans.get(spanId);
  }

  /**
   * Generate unique span ID
   */
  private generateSpanId(): string {
    return Math.random().toString(16).substr(2, 16);
  }

  /**
   * Generate unique trace ID
   */
  private generateTraceId(): string {
    return Math.random().toString(16).substr(2, 32);
  }

  /**
   * Extract trace ID from parent span
   */
  private getTraceId(parentSpanId: string): string {
    const parentSpan = this.activeSpans.get(parentSpanId);
    return parentSpan?.traceId || this.generateTraceId();
  }
}
