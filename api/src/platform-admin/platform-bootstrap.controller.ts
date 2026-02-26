import { Body, Controller, Headers, Post } from '@nestjs/common';
import { IsEmail, Matches, MinLength } from 'class-validator';
import { PlatformBootstrapService } from './platform-bootstrap.service';
import { ApiTags } from '@nestjs/swagger';

class BootstrapDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters and include uppercase, lowercase and a symbol',
  })
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

