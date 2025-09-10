import { Test, TestingModule } from '@nestjs/testing';
import { TracingService, TraceContext } from '../tracing.service';
import { Request } from 'express';

describe('TracingService', () => {
  let service: TracingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TracingService],
    }).compile();

    service = module.get<TracingService>(TracingService);
  });

  describe('When extracting correlation ID from request', () => {
    it('Then should return correlation ID from request', () => {
      const mockRequest = {
        correlationId: 'test-correlation-id',
      } as unknown as Request;

      const correlationId = service.getCorrelationId(mockRequest);

      expect(correlationId).toBe('test-correlation-id');
    });

    it('Then should return unknown when correlation ID is missing', () => {
      const mockRequest = {} as unknown as Request;

      const correlationId = service.getCorrelationId(mockRequest);

      expect(correlationId).toBe('unknown');
    });
  });

  describe('When starting a span', () => {
    it('Then should create a new span with proper context', () => {
      const span = service.startSpan('test-operation', 'correlation-123');

      expect(span).toEqual({
        correlationId: 'correlation-123',
        traceId: expect.any(String),
        spanId: expect.any(String),
        parentSpanId: undefined,
        operationName: 'test-operation',
        startTime: expect.any(Date),
        tags: {},
        logs: [],
      });
    });

    it('Then should create child span with parent context', () => {
      const parentSpan = service.startSpan(
        'parent-operation',
        'correlation-123',
      );
      const childSpan = service.startSpan(
        'child-operation',
        'correlation-123',
        parentSpan.spanId,
      );

      expect(childSpan.parentSpanId).toBe(parentSpan.spanId);
      expect(childSpan.traceId).toBe(parentSpan.traceId);
      expect(childSpan.correlationId).toBe('correlation-123');
    });
  });

  describe('When finishing a span', () => {
    it('Then should complete span with duration', done => {
      const span = service.startSpan('test-operation', 'correlation-123');

      // Wait a small amount to ensure duration > 0
      setTimeout(() => {
        const finishedSpan = service.finishSpan(span.spanId);

        expect(finishedSpan).toBeDefined();
        expect(finishedSpan!.endTime).toBeDefined();
        expect(finishedSpan!.duration).toBeGreaterThan(0);
        done();
      }, 1);
    });

    it('Then should return null for non-existent span', () => {
      const result = service.finishSpan('non-existent-span-id');

      expect(result).toBeNull();
    });
  });

  describe('When managing span tags', () => {
    it('Then should set tags on existing span', () => {
      const span = service.startSpan('test-operation', 'correlation-123');

      service.setSpanTags(span.spanId, {
        'http.method': 'POST',
        'http.status_code': 200,
      });

      const retrievedSpan = service.getSpan(span.spanId);
      expect(retrievedSpan!.tags).toEqual({
        'http.method': 'POST',
        'http.status_code': 200,
      });
    });

    it('Then should merge tags with existing tags', () => {
      const span = service.startSpan('test-operation', 'correlation-123');

      service.setSpanTags(span.spanId, { tag1: 'value1' });
      service.setSpanTags(span.spanId, { tag2: 'value2' });

      const retrievedSpan = service.getSpan(span.spanId);
      expect(retrievedSpan!.tags).toEqual({
        tag1: 'value1',
        tag2: 'value2',
      });
    });

    it('Then should not fail for non-existent span', () => {
      expect(() => {
        service.setSpanTags('non-existent-span', { tag: 'value' });
      }).not.toThrow();
    });
  });

  describe('When logging to span', () => {
    it('Then should add log entry to span', () => {
      const span = service.startSpan('test-operation', 'correlation-123');

      service.logToSpan(span.spanId, 'info', 'Test log message', {
        key: 'value',
      });

      const retrievedSpan = service.getSpan(span.spanId);
      expect(retrievedSpan!.logs).toHaveLength(1);
      expect(retrievedSpan!.logs[0]).toEqual({
        timestamp: expect.any(Date),
        level: 'info',
        message: 'Test log message',
        fields: { key: 'value' },
      });
    });

    it('Then should add multiple log entries', () => {
      const span = service.startSpan('test-operation', 'correlation-123');

      service.logToSpan(span.spanId, 'info', 'First log');
      service.logToSpan(span.spanId, 'error', 'Second log');

      const retrievedSpan = service.getSpan(span.spanId);
      expect(retrievedSpan!.logs).toHaveLength(2);
    });

    it('Then should not fail for non-existent span', () => {
      expect(() => {
        service.logToSpan('non-existent-span', 'info', 'Test message');
      }).not.toThrow();
    });
  });

  describe('When retrieving spans', () => {
    it('Then should return span by ID', () => {
      const span = service.startSpan('test-operation', 'correlation-123');

      const retrievedSpan = service.getSpan(span.spanId);

      expect(retrievedSpan).toEqual(span);
    });

    it('Then should return undefined for non-existent span', () => {
      const result = service.getSpan('non-existent-span-id');

      expect(result).toBeUndefined();
    });
  });

  describe('When generating IDs', () => {
    it('Then should generate unique span IDs', () => {
      const span1 = service.startSpan('operation1', 'correlation-123');
      const span2 = service.startSpan('operation2', 'correlation-123');

      expect(span1.spanId).not.toBe(span2.spanId);
    });

    it('Then should generate unique trace IDs for root spans', () => {
      const span1 = service.startSpan('operation1', 'correlation-123');
      const span2 = service.startSpan('operation2', 'correlation-456');

      expect(span1.traceId).not.toBe(span2.traceId);
    });
  });
});
