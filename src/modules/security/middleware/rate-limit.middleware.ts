import { Injectable, NestMiddleware, HttpException, HttpStatus, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';

interface RateLimitInfo {
  count: number;
  resetTime: number;
  limit: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly defaultLimit: number;
  private readonly defaultTtl: number;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.defaultLimit = this.configService.get<number>('RATE_LIMIT_LIMIT', 100);
    this.defaultTtl = this.configService.get<number>('RATE_LIMIT_TTL', 60);
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Skip rate limiting if Redis is not available
      if (!this.redis) {
        next();
        return;
      }

      const identifier = this.getIdentifier(req);
      const limit = this.getLimit(req);
      const ttl = this.getTtl(req);

      const rateLimitInfo = await this.checkRateLimit(identifier, limit, ttl);

      if (rateLimitInfo.count > rateLimitInfo.limit) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      
      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If Redis is down, allow the request to proceed
      next();
    }
  }

  private getIdentifier(req: Request): string {
    // Use API key if available, otherwise fall back to IP
    const apiKey = this.extractApiKey(req);
    if (apiKey) {
      return `api_key:${apiKey}`;
    }
    
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  private extractApiKey(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    const apiKeyHeader = req.headers['x-api-key'] as string;
    if (apiKeyHeader) {
      return apiKeyHeader;
    }
    
    return null;
  }

  private getLimit(req: Request): number {
    // Check if there's a custom limit set for this API key
    const customLimit = (req as any).rateLimitOverride;
    return customLimit || this.defaultLimit;
  }

  private getTtl(req: Request): number {
    return this.defaultTtl;
  }

  private async checkRateLimit(identifier: string, limit: number, ttlSeconds: number): Promise<RateLimitInfo> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = Math.floor(now / (ttlSeconds * 1000)) * (ttlSeconds * 1000);
    const resetTime = windowStart + (ttlSeconds * 1000);
    
    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, ttlSeconds);
      
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number || 0;
      
      return {
        count,
        resetTime,
        limit,
      };
    } catch (error) {
      // If Redis is unavailable, return a safe default
      return {
        count: 0,
        resetTime,
        limit,
      };
    }
  }
}
