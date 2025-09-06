import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyService } from './services/api-key.service';
import { ApiKeyController } from './controllers/api-key.controller';
import { SecurityModule } from '../security/security.module';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey]),
    SecurityModule,
    AuditModule,
  ],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class AuthModule {}
