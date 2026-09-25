import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { EmailService } from './email.service';

class DeletionRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}

@Controller('public/privacy')
@ApiTags('public-privacy')
export class PublicPrivacyController {
  constructor(private readonly emailService: EmailService) {}

  @Post('deletion-request')
  @Throttle({ default: { limit: 5, ttl: 3600_000 } })
  @ApiOperation({ summary: 'Submit a POPIA data deletion request (emails support)' })
  async deletionRequest(@Body() dto: DeletionRequestDto) {
    const result = await this.emailService.sendDeletionRequestNotice({
      requesterName: dto.name.trim(),
      requesterEmail: dto.email.trim().toLowerCase(),
      company: dto.company?.trim() || null,
      details: dto.details?.trim() || null,
    });
    return {
      ok: true,
      sent: result.sent,
      message: result.sent
        ? 'Your request was sent. We aim to respond within 30 days.'
        : 'Your request was recorded but email could not be sent right now. Please email support@vehinc.co.za.',
    };
  }
}
