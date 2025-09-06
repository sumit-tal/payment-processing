import { Injectable } from '@nestjs/common';

/**
 * Application root service
 */
@Injectable()
export class AppService {
  /**
   * Get application information
   */
  getHello(): { message: string; version: string; timestamp: string } {
    return {
      message: 'Payment Processing System API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
