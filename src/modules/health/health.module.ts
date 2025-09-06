import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';

/**
 * Health check module
 */
@Module({
  imports: [TerminusModule, HttpModule, TypeOrmModule],
  controllers: [HealthController],
})
export class HealthModule {}
