import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { MobileAppDownloadService } from '../tenant-users/mobile-app-download.service';

@ApiTags('public-mobile-app')
@Controller('public/mobile-app')
export class PublicMobileAppController {
  constructor(
    private readonly configService: ConfigService,
    private readonly downloads: MobileAppDownloadService,
  ) {}

  @Get('latest')
  latest(@Query('channel') channel?: string) {
    const remote =
      this.configService.get<string>('ops.mobileAppLatestUrl') ??
      process.env.MOBILE_APP_LATEST_URL;
    if (remote) {
      return fetch(remote, { cache: 'no-store' })
        .then(async (res) => {
          if (res.ok) return res.json();
          return this.downloads.getLatestMeta(channel === 'staging' ? 'staging' : 'prod');
        })
        .catch(() =>
          this.downloads.getLatestMeta(channel === 'staging' ? 'staging' : 'prod'),
        );
    }
    // No public apkUrl — clients must authenticate for a download ticket
    const meta = this.downloads.getLatestMeta(channel === 'staging' ? 'staging' : 'prod');
    return meta;
  }
}
