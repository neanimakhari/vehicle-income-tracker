import { Body, Controller, ForbiddenException, Post, Headers } from '@nestjs/common';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

class SendTestEmailDto {
  @ApiProperty({ example: 'you@example.com', description: 'Recipient email address' })
  @IsEmail()
  to: string;
}

class SendTrackingAlertTestDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  to: string;

  @ApiProperty({ example: 'nei-m', required: false })
  @IsOptional()
  @IsString()
  tenantSlug?: string;

  @ApiProperty({ example: 'Nei-M Transport', required: false })
  @IsOptional()
  @IsString()
  tenantName?: string;

  @ApiProperty({ example: '#0d9488', required: false })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiProperty({ example: '#14b8a6', required: false })
  @IsOptional()
  @IsString()
  accentColor?: string;
}

@Controller('email')
@ApiTags('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private static readonly DEFAULT_TEST_SECRET = 'vit-test-email-secret';

  @Post('test')
  @ApiOperation({
    summary: 'Send test email',
    description:
      'Sends a simple test email to the given address. Requires X-Email-Test-Secret header (default: vit-test-email-secret if EMAIL_TEST_SECRET is not set).',
  })
  @ApiHeader({
    name: 'X-Email-Test-Secret',
    description: 'Secret to authorize the test (set EMAIL_TEST_SECRET or use default)',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Result of send attempt', schema: { properties: { sent: { type: 'boolean' } } } })
  @ApiResponse({ status: 403, description: 'Invalid or missing X-Email-Test-Secret' })
  async sendTest(@Body() dto: SendTestEmailDto, @Headers('x-email-test-secret') secret: string) {
    const expected =
      this.configService.get<string>('email.testSecret') ??
      process.env.EMAIL_TEST_SECRET ??
      EmailController.DEFAULT_TEST_SECRET;
    if (secret !== expected) {
      throw new ForbiddenException('Invalid or missing X-Email-Test-Secret header.');
    }
    const result = await this.emailService.sendTestEmail(dto.to);
    return result;
  }

  @Post('test-tracking-alert')
  @ApiOperation({
    summary: 'Send sample branded tracking alert email',
    description:
      'Sends a preview fleet tracking alert (vehicle + map link) using tenant brand colors when provided.',
  })
  @ApiHeader({
    name: 'X-Email-Test-Secret',
    required: true,
  })
  async sendTrackingAlertTest(
    @Body() dto: SendTrackingAlertTestDto,
    @Headers('x-email-test-secret') secret: string,
  ) {
    const expected =
      this.configService.get<string>('email.testSecret') ??
      process.env.EMAIL_TEST_SECRET ??
      EmailController.DEFAULT_TEST_SECRET;
    if (secret !== expected) {
      throw new ForbiddenException('Invalid or missing X-Email-Test-Secret header.');
    }
    const primary = dto.primaryColor || '#0d9488';
    const accent = dto.accentColor || '#14b8a6';
    const tenantSlug = dto.tenantSlug || 'demo';
    const tenantName = dto.tenantName || 'Demo Fleet';
    return this.emailService.sendTrackingAlert({
      to: dto.to,
      tenantSlug,
      tenantName,
      trigger: 'engine_start',
      message: 'Engine / ACC on',
      ruleName: 'Vehicle started',
      severity: 'info',
      vehicleLabel: 'Quantum',
      registrationNumber: 'DEMO 123 GP',
      vehicleId: 'ed1035ae-ce73-42bf-84b4-a5ad68efb225',
      latitude: -25.7461,
      longitude: 28.1881,
      speedKph: 0,
      recordedAt: new Date(),
      brand: {
        displayName: tenantName,
        primaryColor: primary,
        accentColor: accent,
      },
    });
  }
}
