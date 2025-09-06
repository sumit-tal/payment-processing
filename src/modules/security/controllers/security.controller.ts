import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PciComplianceService } from '../services/pci-compliance.service';
import { ApiKeyAuthGuard } from '../../../common/guards/api-key-auth.guard';
import { RequirePermissions, Permissions } from '../../../common/decorators/auth.decorator';

@ApiTags('Security')
@Controller('security')
@UseGuards(ApiKeyAuthGuard)
@ApiBearerAuth()
export class SecurityController {
  constructor(private readonly pciComplianceService: PciComplianceService) {}

  @Get('compliance/check')
  @RequirePermissions(Permissions.ADMIN_SYSTEM)
  @ApiOperation({ summary: 'Check PCI DSS compliance status' })
  @ApiResponse({
    status: 200,
    description: 'Compliance check completed successfully',
    schema: {
      type: 'object',
      properties: {
        compliant: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'string' } },
        recommendations: { type: 'array', items: { type: 'string' } },
        score: { type: 'number' },
      },
    },
  })
  async checkCompliance() {
    return this.pciComplianceService.validateCompliance();
  }

  @Get('compliance/report')
  @RequirePermissions(Permissions.ADMIN_SYSTEM)
  @ApiOperation({ summary: 'Generate PCI DSS compliance report' })
  @ApiResponse({
    status: 200,
    description: 'Compliance report generated successfully',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string' },
        compliance: { type: 'object' },
        systemInfo: { type: 'object' },
        recommendations: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async generateComplianceReport() {
    return this.pciComplianceService.generateComplianceReport();
  }
}
