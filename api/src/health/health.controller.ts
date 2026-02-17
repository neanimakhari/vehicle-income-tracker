import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  status() {
    return this.healthService.getBasic();
  }

  @Get('detailed')
  async detailed() {
    return this.healthService.getDetailed();
  }
}



