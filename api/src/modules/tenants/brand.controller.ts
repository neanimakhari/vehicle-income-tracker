import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { BrandService } from './brand.service';
import { MAX_BRAND_ASSET_BYTES } from './brand.util';

const brandUpload = FileInterceptor('file', {
  limits: { fileSize: MAX_BRAND_ASSET_BYTES },
});

class BrandDraftDto {
  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsString()
  primaryHex?: string | null;

  @IsOptional()
  @IsString()
  accentHex?: string | null;

  @IsOptional()
  @IsString()
  primaryDarkHex?: string | null;

  @IsOptional()
  @IsIn(['colored', 'neutral'])
  sidebarStyle?: 'colored' | 'neutral';

  @IsOptional()
  @IsIn(['inter', 'source_sans_3', 'nunito', 'roboto', 'system'])
  fontFamily?: string | null;

  @IsOptional()
  @IsIn(['sm', 'md', 'lg'])
  borderRadius?: string | null;

  @IsOptional()
  @IsIn(['comfortable', 'compact'])
  density?: string | null;
}

class ReplaceBrandDto extends BrandDraftDto {
  @IsOptional()
  @IsString()
  snapshotLabel?: string;
}

class SaveKitDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  includeLogo?: boolean;
}

class CreateKitDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  primaryHex: string;

  @IsOptional()
  @IsString()
  accentHex?: string | null;

  @IsOptional()
  @IsString()
  primaryDarkHex?: string | null;

  @IsOptional()
  @IsIn(['colored', 'neutral'])
  sidebarStyle?: 'colored' | 'neutral';

  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsIn(['inter', 'source_sans_3', 'nunito', 'roboto', 'system'])
  fontFamily?: string | null;

  @IsOptional()
  @IsIn(['sm', 'md', 'lg'])
  borderRadius?: string | null;

  @IsOptional()
  @IsIn(['comfortable', 'compact'])
  density?: string | null;
}

class ApplyKitDto {
  @IsOptional()
  @IsBoolean()
  includeLogo?: boolean;

  @IsOptional()
  @IsBoolean()
  setDisplayName?: boolean;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

class PreviewTokenDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  kitId?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsUUID()
  snapshotId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number;
}

@Controller()
@ApiTags('branding')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  // --- Tenant brand studio ---

  @Get('tenants/:id/brand')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  getStudio(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brandService.getBrandStudio(id);
  }

  @Get('tenants/:id/brand/logo-file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  async draftLogoFile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const asset = await this.brandService.serveStudioLogo(id);
    res.setHeader('Content-Type', asset.mime);
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.send(asset.buffer);
  }

  @Get('tenants/:id/brand/login-bg-file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  async draftLoginBgFile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const asset = await this.brandService.serveStudioLoginBg(id);
    res.setHeader('Content-Type', asset.mime);
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.send(asset.buffer);
  }

  @Put('tenants/:id/brand/draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  saveDraft(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: BrandDraftDto,
    @Req() req: Request,
  ) {
    return this.brandService.saveDraft(id, dto, (req.user as { sub?: string } | undefined)?.sub ?? null);
  }

  @Post('tenants/:id/brand/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.brandService.publishDraft(id, (req.user as { sub?: string } | undefined)?.sub ?? null);
  }

  @Post('tenants/:id/brand/reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  reset(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { wipeDraft?: boolean },
    @Req() req: Request,
  ) {
    return this.brandService.resetToVit(
      id,
      (req.user as { sub?: string } | undefined)?.sub ?? null,
      body?.wipeDraft === true,
    );
  }

  @Post('tenants/:id/brand/replace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  replace(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReplaceBrandDto,
    @Req() req: Request,
  ) {
    return this.brandService.replaceBrand(id, dto, (req.user as { sub?: string } | undefined)?.sub ?? null);
  }

  @Post('tenants/:id/brand/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  @UseInterceptors(brandUpload)
  uploadLogo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    @Req() req: Request,
  ) {
    return this.brandService.uploadAsset(
      id,
      'logo',
      file,
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  @Delete('tenants/:id/brand/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  clearLogo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.brandService.clearAsset(id, 'logo', (req.user as { sub?: string } | undefined)?.sub ?? null);
  }

  @Post('tenants/:id/brand/login-bg')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  @UseInterceptors(brandUpload)
  uploadLoginBg(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    @Req() req: Request,
  ) {
    return this.brandService.uploadAsset(
      id,
      'login-bg',
      file,
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  @Delete('tenants/:id/brand/login-bg')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  clearLoginBg(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.brandService.clearAsset(
      id,
      'login-bg',
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  @Get('tenants/:id/brand/snapshots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  listSnapshots(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brandService.listSnapshots(id);
  }

  @Post('tenants/:id/brand/snapshots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  saveSnapshot(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { label?: string },
    @Req() req: Request,
  ) {
    return this.brandService.saveSnapshot(
      id,
      body?.label ?? 'Manual snapshot',
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  @Post('tenants/:id/brand/snapshots/:snapshotId/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  restoreSnapshot(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('snapshotId', new ParseUUIDPipe()) snapshotId: string,
    @Req() req: Request,
  ) {
    return this.brandService.restoreSnapshot(
      id,
      snapshotId,
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  @Delete('tenants/:id/brand/snapshots/:snapshotId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  deleteSnapshot(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('snapshotId', new ParseUUIDPipe()) snapshotId: string,
    @Req() req: Request,
  ) {
    return this.brandService.deleteSnapshot(
      id,
      snapshotId,
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  @Post('tenants/:id/brand/save-kit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  saveKit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SaveKitDto,
    @Req() req: Request,
  ) {
    return this.brandService.saveKitFromTenant(
      id,
      dto,
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  @Post('tenants/:id/brand/apply-kit/:kitId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  applyKit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('kitId', new ParseUUIDPipe()) kitId: string,
    @Body() dto: ApplyKitDto,
    @Req() req: Request,
  ) {
    return this.brandService.applyKitToTenant(
      id,
      kitId,
      dto ?? {},
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  @Get('tenants/:id/brand/preview-tokens')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  listTokens(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brandService.listPreviewTokens(id);
  }

  @Post('tenants/:id/brand/preview-tokens')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  createTenantPreview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PreviewTokenDto,
    @Req() req: Request,
  ) {
    return this.brandService.createPreviewToken(
      { ...dto, tenantId: id },
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  // --- Kits gallery ---

  @Get('brand-kits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  listKits() {
    return this.brandService.listKits();
  }

  @Post('brand-kits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  createKit(@Body() dto: CreateKitDto, @Req() req: Request) {
    return this.brandService.createKit(dto, (req.user as { sub?: string } | undefined)?.sub ?? null);
  }

  @Post('brand-kits/:id/clone')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  cloneKit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.brandService.cloneKit(id, (req.user as { sub?: string } | undefined)?.sub ?? null);
  }

  @Get('brand-kits/:id/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  exportKit(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brandService.exportKit(id);
  }

  @Post('brand-kits/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  importKit(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.brandService.importKit(
      body as {
        name?: string;
        description?: string | null;
        tags?: string[];
        payload: Record<string, unknown>;
        logoMime?: string | null;
        logoBase64?: string | null;
      },
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  @Post('brand-kits/:id/apply-bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  applyKitBulk(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body()
    body: {
      tenantIds: string[];
      target?: 'draft' | 'live';
      includeLogo?: boolean;
      setDisplayName?: boolean;
    },
    @Req() req: Request,
  ) {
    return this.brandService.applyKitBulk(
      id,
      body ?? { tenantIds: [] },
      (req.user as { sub?: string } | undefined)?.sub ?? null,
    );
  }

  @Delete('brand-kits/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  deleteKit(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brandService.deleteKit(id);
  }

  @Post('brand-preview-tokens')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  createPreview(@Body() dto: PreviewTokenDto, @Req() req: Request) {
    return this.brandService.createPreviewToken(dto, (req.user as { sub?: string } | undefined)?.sub ?? null);
  }

  @Delete('brand-preview-tokens/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  revokePreview(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brandService.revokePreviewToken(id);
  }

  // --- Public ---

  @Get('public/tenants/:slug/brand-chrome')
  async publicBrandChrome(@Param('slug') slug: string) {
    return this.brandService.policyForSlug(slug);
  }

  @Get('public/tenants/:slug/logo')
  async publicLogo(
    @Param('slug') slug: string,
    @Res() res: Response,
  ) {
    const asset = await this.brandService.servePublicLogo(slug, 'logo');
    res.setHeader('Content-Type', asset.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(asset.buffer);
  }

  @Get('public/tenants/:slug/login-bg')
  async publicLoginBg(
    @Param('slug') slug: string,
    @Res() res: Response,
  ) {
    const asset = await this.brandService.servePublicLogo(slug, 'login-bg');
    res.setHeader('Content-Type', asset.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(asset.buffer);
  }

  @Get('public/brand-preview/:token')
  resolvePreview(@Param('token') token: string) {
    return this.brandService.resolvePreview(token);
  }

  @Get('public/brand-preview/:token/logo')
  async previewLogo(@Param('token') token: string, @Res() res: Response) {
    const asset = await this.brandService.servePreviewLogo(token);
    res.setHeader('Content-Type', asset.mime);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(asset.buffer);
  }
}
