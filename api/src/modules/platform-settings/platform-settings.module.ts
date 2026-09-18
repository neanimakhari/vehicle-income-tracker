import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSetting } from './platform-setting.entity';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSetting])],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService, TypeOrmModule],
})
export class PlatformSettingsModule {}
