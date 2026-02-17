import { Body, Controller, Headers, Post } from '@nestjs/common';
import { IsEmail, MinLength } from 'class-validator';
import { PlatformBootstrapService } from './platform-bootstrap.service';
import { ApiTags } from '@nestjs/swagger';

class BootstrapDto {
  @IsEmail()
  email: string;

  @MinLength(12)
  password: string;
}

@Controller('platform/bootstrap')
@ApiTags('platform-bootstrap')
export class PlatformBootstrapController {
  constructor(private readonly bootstrapService: PlatformBootstrapService) {}

  @Post()
  bootstrap(
    @Body() dto: BootstrapDto,
    @Headers('x-bootstrap-token') token?: string,
  ) {
    return this.bootstrapService.bootstrap(dto.email, dto.password, token);
  }
}

