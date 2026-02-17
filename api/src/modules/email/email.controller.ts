import { Body, Controller, ForbiddenException, Post, Headers } from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

class SendTestEmailDto {
  @ApiProperty({ example: 'you@example.com', description: 'Recipient email address' })
  @IsEmail()
  to: string;
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
}
