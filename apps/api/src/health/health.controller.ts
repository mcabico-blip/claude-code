import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/rbac';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health(): { status: string; service: string; at: string } {
    return { status: 'ok', service: 'ubi-suite-api', at: new Date().toISOString() };
  }
}
