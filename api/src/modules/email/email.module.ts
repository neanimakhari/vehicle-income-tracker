import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import { PublicPrivacyController } from './public-privacy.controller';
import { EmailService } from './email.service';

@Module({
  controllers: [EmailController, PublicPrivacyController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

