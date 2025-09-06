import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './services/crypto.service';
import { PciComplianceService } from './services/pci-compliance.service';
import { SecurityController } from './controllers/security.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SecurityController],
  providers: [CryptoService, PciComplianceService],
  exports: [CryptoService, PciComplianceService],
})
export class SecurityModule {}
