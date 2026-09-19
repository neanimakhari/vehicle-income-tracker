import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CommercialService } from '../commercial/commercial.service';
import { TenantEventsService } from '../tenant-events/tenant-events.service';
import { BrandKit } from './brand-kit.entity';
import {
  BrandPayload,
  BrandPolicyDto,
  MAX_BRAND_ASSET_BYTES,
  brandFieldsFromTenant,
  buildBrandTokens,
  hasLoginBgAsset,
  hasLogoAsset,
  normalizeBorderRadius,
  normalizeDensity,
  normalizeDisplayName,
  normalizeFontFamily,
  relativeLuminance,
  validateBrandColors,
} from './brand.util';
import { Tenant } from './tenant.entity';
import { TenantBrandPreviewToken } from './tenant-brand-preview-token.entity';
import { TenantBrandSnapshot } from './tenant-brand-snapshot.entity';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = MAX_BRAND_ASSET_BYTES;

export type BrandDraftInput = {
  displayName?: string | null;
  primaryHex?: string | null;
  accentHex?: string | null;
  primaryDarkHex?: string | null;
  sidebarStyle?: 'colored' | 'neutral';
  fontFamily?: string | null;
  borderRadius?: string | null;
  density?: string | null;
};

export type BrandAssetBytes = { buffer: Buffer; mime: string };

@Injectable()
export class BrandService {
  private readonly uploadsRoot = path.join(
    process.cwd(),
    'uploads',
    'tenant-branding',
  );
  private readonly kitsRoot = path.join(process.cwd(), 'uploads', 'brand-kits');

  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(BrandKit)
    private readonly kits: Repository<BrandKit>,
    @InjectRepository(TenantBrandSnapshot)
    private readonly snapshots: Repository<TenantBrandSnapshot>,
    @InjectRepository(TenantBrandPreviewToken)
    private readonly previewTokens: Repository<TenantBrandPreviewToken>,
    private readonly commercial: CommercialService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly tenantEvents: TenantEventsService,
  ) {
    for (const dir of [this.uploadsRoot, this.kitsRoot]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  }

  private apiPublicBase(): string {
    const raw =
      this.config.get<string>('ops.apiPublicUrl') ??
      process.env.API_PUBLIC_URL ??
      'http://127.0.0.1:3000/v1';
    return raw.replace(/\/$/, '');
  }

  private cacheBust(tenant: Tenant): string {
    const t = tenant.brandUpdatedAt?.getTime() ?? 0;
    return String(t || Date.now());
  }

  async isBrandingEntitled(slug: string): Promise<boolean> {
    return this.commercial.hasModule(slug, 'branding');
  }

  buildLivePolicy(tenant: Tenant, entitled: boolean): BrandPolicyDto {
    if (!entitled || tenant.brandMode !== 'custom') {
      return { mode: 'vit_default', entitled };
    }
    const v = this.cacheBust(tenant);
    const dto: BrandPolicyDto = {
      mode: 'custom',
      entitled: true,
      sidebarStyle:
        tenant.brandSidebarStyle === 'neutral' ? 'neutral' : 'colored',
    };
    if (tenant.brandDisplayName) dto.displayName = tenant.brandDisplayName;
    if (tenant.brandPrimaryHex) dto.primaryColor = tenant.brandPrimaryHex;
    if (tenant.brandAccentHex) dto.accentColor = tenant.brandAccentHex;
    if (tenant.brandPrimaryDarkHex) {
      dto.primaryDarkColor = tenant.brandPrimaryDarkHex;
    }
    if (tenant.brandFontFamily) {
      dto.fontFamily = tenant.brandFontFamily as BrandPolicyDto['fontFamily'];
    }
    if (tenant.brandBorderRadius) {
      dto.borderRadius =
        tenant.brandBorderRadius as BrandPolicyDto['borderRadius'];
    }
    if (tenant.brandDensity) {
      dto.density = tenant.brandDensity as BrandPolicyDto['density'];
    }
    if (hasLogoAsset({
      logoData: tenant.brandLogoData,
      logoPath: tenant.brandLogoPath,
    })) {
      dto.logoUrl = `${this.apiPublicBase()}/public/tenants/${tenant.slug}/logo?v=${v}`;
    }
    if (hasLoginBgAsset({
      loginBgData: tenant.brandLoginBgData,
      loginBgPath: tenant.brandLoginBgPath,
    })) {
      dto.loginBackgroundUrl = `${this.apiPublicBase()}/public/tenants/${tenant.slug}/login-bg?v=${v}`;
    }
    return dto;
  }

  async policyForSlug(slug: string): Promise<BrandPolicyDto> {
    const tenant = await this.tenants.findOne({ where: { slug } });
    if (!tenant) return { mode: 'vit_default', entitled: false };
    const entitled = await this.isBrandingEntitled(slug);
    return this.buildLivePolicy(tenant, entitled);
  }

  getDraft(tenant: Tenant): BrandPayload & { mode?: string } {
    if (tenant.brandDraftJson && typeof tenant.brandDraftJson === 'object') {
      return tenant.brandDraftJson as BrandPayload & { mode?: string };
    }
    return brandFieldsFromTenant(tenant);
  }

  async getBrandStudio(tenantId: string) {
    const tenant = await this.findTenant(tenantId);
    const entitled = await this.isBrandingEntitled(tenant.slug);
    const draft = this.getDraft(tenant);
    const v = this.cacheBust(tenant);
    const draftOut: BrandPayload & {
      logoUrl?: string;
      loginBackgroundUrl?: string;
    } = { ...draft };
    // Never leak base64 in studio JSON responses — use URL endpoints
    delete (draftOut as { logoData?: string }).logoData;
    delete (draftOut as { loginBgData?: string }).loginBgData;
    if (hasLogoAsset(draft)) {
      draftOut.logoUrl = `${this.apiPublicBase()}/tenants/${tenant.id}/brand/logo-file?v=${v}`;
    }
    if (hasLoginBgAsset(draft)) {
      draftOut.loginBackgroundUrl = `${this.apiPublicBase()}/tenants/${tenant.id}/brand/login-bg-file?v=${v}`;
    }
    const primaryForWarn = draft.primaryHex || tenant.brandPrimaryHex;
    let primaryLuminance: number | null = null;
    let primaryContrastWarning: string | null = null;
    if (primaryForWarn && /^#[0-9A-Fa-f]{6}$/.test(primaryForWarn)) {
      primaryLuminance = relativeLuminance(primaryForWarn);
      if (primaryLuminance > 0.7) {
        primaryContrastWarning =
          'Primary color is quite light — buttons and links may be hard to read on white backgrounds.';
      }
    }
    return {
      entitled,
      brandMode: tenant.brandMode,
      live: this.buildLivePolicy(tenant, entitled),
      draft: draftOut,
      liveFields: brandFieldsFromTenant(tenant),
      brandKitId: tenant.brandKitId,
      brandUpdatedAt: tenant.brandUpdatedAt,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      primaryLuminance,
      primaryContrastWarning,
    };
  }

  async saveDraft(
    tenantId: string,
    input: BrandDraftInput,
    actorUserId: string | null,
  ) {
    const tenant = await this.findTenant(tenantId);
    const colors = validateBrandColors({
      primaryHex: input.primaryHex,
      accentHex: input.accentHex,
      primaryDarkHex: input.primaryDarkHex,
    });
    const prev = this.getDraft(tenant);
    const draft: BrandPayload = {
      ...prev,
      displayName:
        input.displayName !== undefined
          ? normalizeDisplayName(input.displayName)
          : prev.displayName ?? null,
      primaryHex:
        input.primaryHex !== undefined ? colors.primaryHex : prev.primaryHex,
      accentHex:
        input.accentHex !== undefined ? colors.accentHex : prev.accentHex,
      primaryDarkHex:
        input.primaryDarkHex !== undefined
          ? colors.primaryDarkHex
          : prev.primaryDarkHex ?? null,
      sidebarStyle:
        input.sidebarStyle ??
        (prev.sidebarStyle === 'neutral' ? 'neutral' : 'colored'),
      fontFamily:
        input.fontFamily !== undefined
          ? normalizeFontFamily(input.fontFamily)
          : prev.fontFamily ?? null,
      borderRadius:
        input.borderRadius !== undefined
          ? normalizeBorderRadius(input.borderRadius)
          : prev.borderRadius ?? null,
      density:
        input.density !== undefined
          ? normalizeDensity(input.density)
          : prev.density ?? null,
    };
    tenant.brandDraftJson = draft as Record<string, unknown>;
    await this.tenants.save(tenant);
    await this.audit.log({
      action: 'tenant.brand.draft_save',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: {
        slug: tenant.slug,
        draft: {
          ...draft,
          logoData: draft.logoData ? '[base64]' : null,
          loginBgData: draft.loginBgData ? '[base64]' : null,
        },
      },
    });
    return this.getBrandStudio(tenantId);
  }

  async publishDraft(tenantId: string, actorUserId: string | null) {
    const tenant = await this.findTenant(tenantId);
    const entitled = await this.isBrandingEntitled(tenant.slug);
    if (!entitled) {
      throw new BadRequestException(
        'Enable the White-label branding module before publishing',
      );
    }
    const draft = this.getDraft(tenant);
    const colors = validateBrandColors({
      primaryHex: draft.primaryHex ?? null,
      accentHex: draft.accentHex ?? null,
      primaryDarkHex: draft.primaryDarkHex ?? null,
    });
    if (!colors.primaryHex) {
      throw new BadRequestException('Draft needs a primary color to publish');
    }
    tenant.brandMode = 'custom';
    tenant.brandDisplayName = draft.displayName ?? null;
    tenant.brandPrimaryHex = colors.primaryHex;
    tenant.brandAccentHex = colors.accentHex;
    tenant.brandPrimaryDarkHex = colors.primaryDarkHex;
    tenant.brandSidebarStyle =
      draft.sidebarStyle === 'neutral' ? 'neutral' : 'colored';
    tenant.brandFontFamily = draft.fontFamily ?? null;
    tenant.brandBorderRadius = draft.borderRadius ?? null;
    tenant.brandDensity = draft.density ?? null;
    if (hasLogoAsset(draft)) {
      tenant.brandLogoData = draft.logoData ?? tenant.brandLogoData;
      tenant.brandLogoMime = draft.logoMime ?? tenant.brandLogoMime;
      tenant.brandLogoPath = draft.logoPath ?? null;
      if (draft.logoData) {
        tenant.brandLogoData = draft.logoData;
        tenant.brandLogoPath = null;
      }
    }
    if (hasLoginBgAsset(draft)) {
      tenant.brandLoginBgMime = draft.loginBgMime ?? tenant.brandLoginBgMime;
      tenant.brandLoginBgPath = draft.loginBgPath ?? null;
      if (draft.loginBgData) {
        tenant.brandLoginBgData = draft.loginBgData;
        tenant.brandLoginBgPath = null;
      } else if (draft.loginBgPath) {
        tenant.brandLoginBgPath = draft.loginBgPath;
      }
    }
    tenant.brandUpdatedAt = new Date();
    await this.tenants.save(tenant);
    await this.audit.log({
      action: 'tenant.brand.publish',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug: tenant.slug },
    });
    this.tenantEvents.notifyBrandUpdated({
      tenantId: tenant.id,
      slug: tenant.slug,
      action: 'publish',
    });
    return this.getBrandStudio(tenantId);
  }

  async resetToVit(
    tenantId: string,
    actorUserId: string | null,
    wipeDraft = false,
  ) {
    const tenant = await this.findTenant(tenantId);
    tenant.brandMode = 'vit_default';
    tenant.brandDisplayName = null;
    tenant.brandPrimaryHex = null;
    tenant.brandAccentHex = null;
    tenant.brandPrimaryDarkHex = null;
    tenant.brandSidebarStyle = 'colored';
    tenant.brandFontFamily = null;
    tenant.brandBorderRadius = null;
    tenant.brandDensity = null;
    tenant.brandLogoPath = null;
    tenant.brandLogoMime = null;
    tenant.brandLogoData = null;
    tenant.brandLoginBgPath = null;
    tenant.brandLoginBgMime = null;
    tenant.brandLoginBgData = null;
    tenant.brandKitId = null;
    tenant.brandUpdatedAt = new Date();
    if (wipeDraft) tenant.brandDraftJson = null;
    await this.tenants.save(tenant);
    await this.audit.log({
      action: 'tenant.brand.reset',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug: tenant.slug, wipeDraft },
    });
    this.tenantEvents.notifyBrandUpdated({
      tenantId: tenant.id,
      slug: tenant.slug,
      action: 'reset',
    });
    return this.getBrandStudio(tenantId);
  }

  async replaceBrand(
    tenantId: string,
    input: BrandDraftInput & { snapshotLabel?: string },
    actorUserId: string | null,
  ) {
    const tenant = await this.findTenant(tenantId);
    await this.createSnapshot(
      tenant,
      input.snapshotLabel ?? `Before replace ${new Date().toISOString().slice(0, 10)}`,
      actorUserId,
    );
    await this.saveDraft(tenantId, input, actorUserId);
    const entitled = await this.isBrandingEntitled(tenant.slug);
    let result;
    if (entitled) {
      result = await this.publishDraft(tenantId, actorUserId);
    } else {
      result = await this.getBrandStudio(tenantId);
    }
    await this.audit.log({
      action: 'tenant.brand.replace',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: {
        slug: tenant.slug,
        published: entitled,
        displayName: input.displayName ?? null,
        primaryHex: input.primaryHex ?? null,
      },
    });
    return result;
  }

  async uploadAsset(
    tenantId: string,
    kind: 'logo' | 'login-bg',
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    actorUserId: string | null,
    target: 'draft' | 'live' = 'draft',
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Image must be png, jpeg, or webp');
    }
    if (file.size > MAX_BYTES || file.buffer.length > MAX_BYTES) {
      throw new BadRequestException('Image must be 2MB or smaller');
    }
    const tenant = await this.findTenant(tenantId);
    const b64 = file.buffer.toString('base64');
    const draft = this.getDraft(tenant);
    if (kind === 'logo') {
      draft.logoData = b64;
      draft.logoMime = file.mimetype;
      draft.logoPath = null;
      if (target === 'live') {
        tenant.brandLogoData = b64;
        tenant.brandLogoMime = file.mimetype;
        tenant.brandLogoPath = null;
      }
    } else {
      draft.loginBgData = b64;
      draft.loginBgMime = file.mimetype;
      draft.loginBgPath = null;
      if (target === 'live') {
        tenant.brandLoginBgData = b64;
        tenant.brandLoginBgMime = file.mimetype;
        tenant.brandLoginBgPath = null;
      }
    }
    tenant.brandDraftJson = draft as Record<string, unknown>;
    tenant.brandUpdatedAt = new Date();
    await this.tenants.save(tenant);
    await this.audit.log({
      action: 'tenant.brand.asset_upload',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: {
        slug: tenant.slug,
        kind,
        bytes: file.buffer.length,
        mime: file.mimetype,
      },
    });
    return this.getBrandStudio(tenantId);
  }

  async clearAsset(
    tenantId: string,
    kind: 'logo' | 'login-bg',
    actorUserId: string | null,
  ) {
    const tenant = await this.findTenant(tenantId);
    const draft = this.getDraft(tenant);
    if (kind === 'logo') {
      draft.logoPath = null;
      draft.logoMime = null;
      draft.logoData = null;
      tenant.brandLogoPath = null;
      tenant.brandLogoMime = null;
      tenant.brandLogoData = null;
    } else {
      draft.loginBgPath = null;
      draft.loginBgMime = null;
      draft.loginBgData = null;
      tenant.brandLoginBgPath = null;
      tenant.brandLoginBgMime = null;
      tenant.brandLoginBgData = null;
    }
    tenant.brandDraftJson = draft as Record<string, unknown>;
    tenant.brandUpdatedAt = new Date();
    await this.tenants.save(tenant);
    await this.audit.log({
      action: 'tenant.brand.asset_clear',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug: tenant.slug, kind },
    });
    return this.getBrandStudio(tenantId);
  }

  /** Resolve logo/login-bg bytes from DB base64, with filesystem fallback. */
  resolveTenantAsset(
    tenant: Tenant,
    kind: 'logo' | 'login-bg',
    preferDraft = false,
  ): BrandAssetBytes | null {
    const draft = preferDraft ? this.getDraft(tenant) : null;
    let data: string | null | undefined;
    let mime: string | null | undefined;
    let relPath: string | null | undefined;
    if (kind === 'logo') {
      data = preferDraft
        ? draft?.logoData ?? tenant.brandLogoData
        : tenant.brandLogoData;
      mime = preferDraft
        ? draft?.logoMime ?? tenant.brandLogoMime
        : tenant.brandLogoMime;
      relPath = preferDraft
        ? draft?.logoPath ?? tenant.brandLogoPath
        : tenant.brandLogoPath;
    } else {
      data = preferDraft
        ? draft?.loginBgData ?? tenant.brandLoginBgData
        : tenant.brandLoginBgData;
      mime = preferDraft
        ? draft?.loginBgMime ?? tenant.brandLoginBgMime
        : tenant.brandLoginBgMime;
      relPath = preferDraft
        ? draft?.loginBgPath ?? tenant.brandLoginBgPath
        : tenant.brandLoginBgPath;
    }
    if (data && mime) {
      return { buffer: Buffer.from(data, 'base64'), mime };
    }
    if (relPath && mime) {
      const abs = path.join(process.cwd(), 'uploads', relPath);
      if (fs.existsSync(abs)) {
        return { buffer: fs.readFileSync(abs), mime };
      }
    }
    return null;
  }

  /** @deprecated use resolveTenantAsset */
  resolveTenantAssetPath(
    tenant: Tenant,
    kind: 'logo' | 'login-bg',
    preferDraft = false,
  ): { absPath: string; mime: string } | null {
    const asset = this.resolveTenantAsset(tenant, kind, preferDraft);
    if (!asset) return null;
    // Controllers now prefer buffer; keep shim for any leftover sendFile callers
    const tmpDir = path.join(process.cwd(), 'uploads', '.tmp-brand');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmp = path.join(
      tmpDir,
      `${tenant.slug}-${kind}-${Date.now()}.${asset.mime.split('/')[1] || 'bin'}`,
    );
    fs.writeFileSync(tmp, asset.buffer);
    return { absPath: tmp, mime: asset.mime };
  }

  async servePublicLogo(slug: string, kind: 'logo' | 'login-bg') {
    const tenant = await this.tenants.findOne({ where: { slug } });
    if (!tenant?.isActive) throw new NotFoundException();
    const entitled = await this.isBrandingEntitled(slug);
    if (!entitled || tenant.brandMode !== 'custom') {
      throw new NotFoundException();
    }
    const asset = this.resolveTenantAsset(tenant, kind, false);
    if (!asset) throw new NotFoundException();
    return asset;
  }

  // --- Snapshots ---

  async listSnapshots(tenantId: string) {
    const tenant = await this.findTenant(tenantId);
    return this.snapshots.find({
      where: { tenantSlug: tenant.slug },
      order: { createdAt: 'DESC' },
    });
  }

  async createSnapshot(
    tenant: Tenant,
    label: string,
    actorUserId: string | null,
  ) {
    const payload = {
      brandMode: tenant.brandMode,
      ...brandFieldsFromTenant(tenant),
      draft: tenant.brandDraftJson,
    };
    const row = this.snapshots.create({
      tenantSlug: tenant.slug,
      label,
      payload,
      createdBy: actorUserId,
    });
    const saved = await this.snapshots.save(row);
    await this.audit.log({
      action: 'tenant.brand.snapshot',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug: tenant.slug, snapshotId: saved.id, label },
    });
    return saved;
  }

  async saveSnapshot(tenantId: string, label: string, actorUserId: string | null) {
    const tenant = await this.findTenant(tenantId);
    return this.createSnapshot(tenant, label || 'Manual snapshot', actorUserId);
  }

  async deleteSnapshot(
    tenantId: string,
    snapshotId: string,
    actorUserId: string | null,
  ) {
    const tenant = await this.findTenant(tenantId);
    const snap = await this.snapshots.findOne({ where: { id: snapshotId } });
    if (!snap || snap.tenantSlug !== tenant.slug) {
      throw new NotFoundException('Snapshot not found');
    }
    await this.snapshots.remove(snap);
    await this.audit.log({
      action: 'tenant.brand.snapshot_delete',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug: tenant.slug, snapshotId, label: snap.label },
    });
    return { deleted: true };
  }

  async restoreSnapshot(
    tenantId: string,
    snapshotId: string,
    actorUserId: string | null,
  ) {
    const tenant = await this.findTenant(tenantId);
    const snap = await this.snapshots.findOne({ where: { id: snapshotId } });
    if (!snap || snap.tenantSlug !== tenant.slug) {
      throw new NotFoundException('Snapshot not found');
    }
    const p = snap.payload as BrandPayload & { brandMode?: string; draft?: unknown };
    const colors = validateBrandColors({
      primaryHex: p.primaryHex ?? null,
      accentHex: p.accentHex ?? null,
      primaryDarkHex: p.primaryDarkHex ?? null,
    });
    tenant.brandMode = p.brandMode === 'custom' ? 'custom' : 'vit_default';
    tenant.brandDisplayName = p.displayName ?? null;
    tenant.brandPrimaryHex = colors.primaryHex;
    tenant.brandAccentHex = colors.accentHex;
    tenant.brandPrimaryDarkHex = colors.primaryDarkHex;
    tenant.brandSidebarStyle =
      p.sidebarStyle === 'neutral' ? 'neutral' : 'colored';
    tenant.brandFontFamily = p.fontFamily ?? null;
    tenant.brandBorderRadius = p.borderRadius ?? null;
    tenant.brandDensity = p.density ?? null;
    tenant.brandLogoPath = p.logoPath ?? null;
    tenant.brandLogoMime = p.logoMime ?? null;
    tenant.brandLogoData = p.logoData ?? null;
    tenant.brandLoginBgPath = p.loginBgPath ?? null;
    tenant.brandLoginBgMime = p.loginBgMime ?? null;
    tenant.brandLoginBgData = p.loginBgData ?? null;
    if (p.draft && typeof p.draft === 'object') {
      tenant.brandDraftJson = p.draft as Record<string, unknown>;
    } else {
      tenant.brandDraftJson = brandFieldsFromTenant(tenant) as Record<
        string,
        unknown
      >;
    }
    tenant.brandUpdatedAt = new Date();
    await this.tenants.save(tenant);
    await this.audit.log({
      action: 'tenant.brand.restore_snapshot',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug: tenant.slug, snapshotId },
    });
    return this.getBrandStudio(tenantId);
  }

  // --- Kits ---

  listKits() {
    return this.kits.find({ order: { isStarter: 'DESC', name: 'ASC' } });
  }

  async getKit(id: string) {
    const kit = await this.kits.findOne({ where: { id } });
    if (!kit) throw new NotFoundException('Kit not found');
    return kit;
  }

  async saveKitFromTenant(
    tenantId: string,
    body: { name: string; description?: string; tags?: string[]; includeLogo?: boolean },
    actorUserId: string | null,
  ) {
    const tenant = await this.findTenant(tenantId);
    const draft = this.getDraft(tenant);
    const colors = validateBrandColors({
      primaryHex: draft.primaryHex ?? tenant.brandPrimaryHex,
      accentHex: draft.accentHex ?? tenant.brandAccentHex,
    });
    if (!colors.primaryHex) {
      throw new BadRequestException('Need a primary color before saving a kit');
    }
    const kit = this.kits.create({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      tags: body.tags ?? [],
      payload: {
        primaryHex: colors.primaryHex,
        accentHex: colors.accentHex,
        primaryDarkHex: draft.primaryDarkHex ?? null,
        sidebarStyle: draft.sidebarStyle ?? 'colored',
        displayName: draft.displayName ?? null,
        fontFamily: draft.fontFamily ?? null,
        borderRadius: draft.borderRadius ?? null,
        density: draft.density ?? null,
      },
      isStarter: false,
      createdBy: actorUserId,
    });
    const saved = await this.kits.save(kit);
    if (body.includeLogo && hasLogoAsset(draft)) {
      const bytes = this.resolveTenantAsset(tenant, 'logo', true);
      if (bytes) {
        saved.logoData = bytes.buffer.toString('base64');
        saved.logoMime = bytes.mime;
        saved.logoPath = null;
        await this.kits.save(saved);
      }
    }
    await this.audit.log({
      action: 'tenant.brand.kit_save',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'brand_kit',
      targetId: saved.id,
      metadata: { fromTenant: tenant.slug, name: saved.name },
    });
    return saved;
  }

  async createKit(
    body: {
      name: string;
      description?: string;
      tags?: string[];
      primaryHex: string;
      accentHex?: string | null;
      primaryDarkHex?: string | null;
      sidebarStyle?: 'colored' | 'neutral';
      displayName?: string | null;
      fontFamily?: string | null;
      borderRadius?: string | null;
      density?: string | null;
    },
    actorUserId: string | null,
  ) {
    const colors = validateBrandColors({
      primaryHex: body.primaryHex,
      accentHex: body.accentHex ?? null,
      primaryDarkHex: body.primaryDarkHex ?? null,
    });
    if (!colors.primaryHex) {
      throw new BadRequestException('primaryHex required');
    }
    const kit = this.kits.create({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      tags: body.tags ?? [],
      payload: {
        primaryHex: colors.primaryHex,
        accentHex: colors.accentHex,
        primaryDarkHex: colors.primaryDarkHex,
        sidebarStyle: body.sidebarStyle ?? 'colored',
        displayName: normalizeDisplayName(body.displayName) ?? null,
        fontFamily: normalizeFontFamily(body.fontFamily ?? null),
        borderRadius: normalizeBorderRadius(body.borderRadius ?? null),
        density: normalizeDensity(body.density ?? null),
      },
      isStarter: false,
      createdBy: actorUserId,
    });
    return this.kits.save(kit);
  }

  async cloneKit(id: string, actorUserId: string | null) {
    const kit = await this.getKit(id);
    const clone = this.kits.create({
      name: `${kit.name} (copy)`,
      description: kit.description,
      tags: kit.tags,
      payload: { ...kit.payload },
      logoPath: null,
      logoMime: kit.logoMime,
      logoData: kit.logoData,
      loginBgPath: null,
      loginBgMime: kit.loginBgMime,
      loginBgData: kit.loginBgData,
      isStarter: false,
      createdBy: actorUserId,
    });
    return this.kits.save(clone);
  }

  async deleteKit(id: string) {
    const kit = await this.getKit(id);
    if (kit.isStarter) {
      throw new BadRequestException('Cannot delete starter kits');
    }
    await this.kits.remove(kit);
    return { deleted: true };
  }

  async exportKit(id: string) {
    const kit = await this.getKit(id);
    let logoBase64: string | null = kit.logoData ?? null;
    if (!logoBase64 && kit.logoPath) {
      const abs = path.join(process.cwd(), 'uploads', kit.logoPath);
      if (fs.existsSync(abs)) {
        logoBase64 = fs.readFileSync(abs).toString('base64');
      }
    }
    return {
      version: 2,
      name: kit.name,
      description: kit.description,
      tags: kit.tags,
      payload: kit.payload,
      logoMime: kit.logoMime,
      logoBase64,
    };
  }

  async importKit(
    body: {
      name?: string;
      description?: string | null;
      tags?: string[];
      payload: Record<string, unknown>;
      logoMime?: string | null;
      logoBase64?: string | null;
    },
    actorUserId: string | null,
  ) {
    const p = body.payload || {};
    const colors = validateBrandColors({
      primaryHex: (p.primaryHex as string) ?? null,
      accentHex: (p.accentHex as string) ?? null,
      primaryDarkHex: (p.primaryDarkHex as string) ?? null,
    });
    if (!colors.primaryHex) {
      throw new BadRequestException('Import payload needs primaryHex');
    }
    const kit = this.kits.create({
      name: (body.name || 'Imported kit').trim(),
      description: body.description?.trim() || null,
      tags: body.tags ?? ['imported'],
      payload: {
        primaryHex: colors.primaryHex,
        accentHex: colors.accentHex,
        primaryDarkHex: colors.primaryDarkHex,
        sidebarStyle: p.sidebarStyle === 'neutral' ? 'neutral' : 'colored',
        displayName: (p.displayName as string) ?? null,
        fontFamily: (p.fontFamily as string) ?? null,
        borderRadius: (p.borderRadius as string) ?? null,
        density: (p.density as string) ?? null,
      },
      isStarter: false,
      createdBy: actorUserId,
    });
    const saved = await this.kits.save(kit);
    if (body.logoBase64 && body.logoMime && ALLOWED_MIME.has(body.logoMime)) {
      const buf = Buffer.from(body.logoBase64, 'base64');
      if (buf.length > 0 && buf.length <= MAX_BYTES) {
        saved.logoData = body.logoBase64;
        saved.logoMime = body.logoMime;
        saved.logoPath = null;
        await this.kits.save(saved);
      }
    }
    await this.audit.log({
      action: 'tenant.brand.kit_import',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'brand_kit',
      targetId: saved.id,
      metadata: { name: saved.name },
    });
    return saved;
  }

  async applyKitBulk(
    kitId: string,
    opts: {
      tenantIds: string[];
      target?: 'draft' | 'live';
      includeLogo?: boolean;
      setDisplayName?: boolean;
    },
    actorUserId: string | null,
  ) {
    if (!opts.tenantIds?.length) {
      throw new BadRequestException('tenantIds required');
    }
    const results: Array<{ tenantId: string; ok: boolean; error?: string }> = [];
    for (const tenantId of opts.tenantIds) {
      try {
        await this.applyKitToTenant(
          tenantId,
          kitId,
          {
            includeLogo: opts.includeLogo === true,
            setDisplayName: opts.setDisplayName === true,
            publish: opts.target === 'live',
          },
          actorUserId,
        );
        results.push({ tenantId, ok: true });
      } catch (e) {
        results.push({
          tenantId,
          ok: false,
          error: e instanceof Error ? e.message : 'failed',
        });
      }
    }
    return {
      applied: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  async applyKitToTenant(
    tenantId: string,
    kitId: string,
    opts: {
      includeLogo?: boolean;
      setDisplayName?: boolean;
      publish?: boolean;
    },
    actorUserId: string | null,
  ) {
    const tenant = await this.findTenant(tenantId);
    const kit = await this.getKit(kitId);
    const p = kit.payload as BrandPayload;
    const colors = validateBrandColors({
      primaryHex: (p.primaryHex as string) ?? null,
      accentHex: (p.accentHex as string) ?? null,
    });
    const draft = this.getDraft(tenant);
    draft.primaryHex = colors.primaryHex;
    draft.accentHex = colors.accentHex;
    draft.primaryDarkHex = (p.primaryDarkHex as string) ?? null;
    draft.sidebarStyle =
      p.sidebarStyle === 'neutral' ? 'neutral' : 'colored';
    draft.fontFamily = (p.fontFamily as BrandPayload['fontFamily']) ?? null;
    draft.borderRadius =
      (p.borderRadius as BrandPayload['borderRadius']) ?? null;
    draft.density = (p.density as BrandPayload['density']) ?? null;
    if (opts.setDisplayName && p.displayName) {
      draft.displayName = String(p.displayName);
    }
    if (opts.includeLogo && (kit.logoData || kit.logoPath)) {
      if (kit.logoData) {
        draft.logoData = kit.logoData;
        draft.logoMime = kit.logoMime ?? 'image/png';
        draft.logoPath = null;
      } else if (kit.logoPath) {
        const src = path.join(process.cwd(), 'uploads', kit.logoPath);
        if (fs.existsSync(src)) {
          draft.logoData = fs.readFileSync(src).toString('base64');
          draft.logoMime = kit.logoMime ?? 'image/png';
          draft.logoPath = null;
        }
      }
    }
    tenant.brandDraftJson = draft as Record<string, unknown>;
    tenant.brandKitId = kit.id;
    await this.tenants.save(tenant);
    await this.audit.log({
      action: 'tenant.brand.kit_apply',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug: tenant.slug, kitId: kit.id, opts },
    });
    if (opts.publish) {
      return this.publishDraft(tenantId, actorUserId);
    }
    return this.getBrandStudio(tenantId);
  }

  // --- Preview tokens ---

  async createPreviewToken(
    opts: {
      tenantId?: string;
      kitId?: string;
      source?: string;
      snapshotId?: string;
      days?: number;
    },
    actorUserId: string | null,
  ) {
    let tenantSlug: string | null = null;
    if (opts.tenantId) {
      const tenant = await this.findTenant(opts.tenantId);
      tenantSlug = tenant.slug;
    }
    if (opts.kitId) await this.getKit(opts.kitId);
    const token = randomBytes(24).toString('base64url');
    const days = opts.days && opts.days > 0 ? Math.min(opts.days, 30) : 7;
    const expiresAt = new Date(Date.now() + days * 86400000);
    const row = this.previewTokens.create({
      token,
      tenantSlug,
      kitId: opts.kitId ?? null,
      source: opts.source ?? (opts.kitId ? 'kit' : 'draft'),
      snapshotId: opts.snapshotId ?? null,
      expiresAt,
      createdBy: actorUserId,
    });
    const saved = await this.previewTokens.save(row);
    await this.audit.log({
      action: 'tenant.brand.preview_link',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'brand_preview',
      targetId: saved.id,
      metadata: { tenantSlug, kitId: opts.kitId, source: saved.source },
    });
    return saved;
  }

  async revokePreviewToken(id: string) {
    const row = await this.previewTokens.findOne({ where: { id } });
    if (!row) throw new NotFoundException();
    row.revokedAt = new Date();
    return this.previewTokens.save(row);
  }

  async listPreviewTokens(tenantId: string) {
    const tenant = await this.findTenant(tenantId);
    return this.previewTokens.find({
      where: { tenantSlug: tenant.slug },
      order: { createdAt: 'DESC' },
    });
  }

  async resolvePreview(token: string): Promise<{
    brand: BrandPolicyDto & { tokens?: ReturnType<typeof buildBrandTokens> };
    meta: { source: string; tenantSlug: string | null; kitId: string | null; watermark: string };
  }> {
    const row = await this.previewTokens.findOne({ where: { token } });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('Preview link invalid or expired');
    }

    if (row.kitId && !row.tenantSlug) {
      const kit = await this.getKit(row.kitId);
      const p = kit.payload as BrandPayload;
      const primary = (p.primaryHex as string) || '#0d9488';
      const accent = (p.accentHex as string) || null;
      return {
        brand: {
          mode: 'custom',
          entitled: true,
          displayName: (p.displayName as string) || kit.name,
          primaryColor: primary,
          accentColor: accent ?? undefined,
          sidebarStyle:
            p.sidebarStyle === 'neutral' ? 'neutral' : 'colored',
          tokens: buildBrandTokens(primary, accent),
        },
        meta: {
          source: 'kit',
          tenantSlug: null,
          kitId: kit.id,
          watermark: 'Preview — kit only (not live)',
        },
      };
    }

    if (!row.tenantSlug) throw new NotFoundException();
    const tenant = await this.tenants.findOne({
      where: { slug: row.tenantSlug },
    });
    if (!tenant) throw new NotFoundException();

    let payload: BrandPayload = brandFieldsFromTenant(tenant);
    let source = row.source;
    if (row.source === 'draft') {
      payload = this.getDraft(tenant);
    } else if (row.source === 'snapshot' && row.snapshotId) {
      const snap = await this.snapshots.findOne({
        where: { id: row.snapshotId },
      });
      if (snap) payload = snap.payload as BrandPayload;
    } else if (row.source === 'live') {
      payload = brandFieldsFromTenant(tenant);
    }

    const primary = payload.primaryHex || '#0d9488';
    const accent = payload.accentHex || null;
    const v = createHash('sha1')
      .update(JSON.stringify({
        ...payload,
        logoData: payload.logoData ? '1' : null,
        loginBgData: payload.loginBgData ? '1' : null,
      }))
      .digest('hex')
      .slice(0, 8);
    const brand: BrandPolicyDto & {
      tokens?: ReturnType<typeof buildBrandTokens>;
    } = {
      mode: 'custom',
      entitled: true,
      displayName: payload.displayName || tenant.name,
      primaryColor: primary,
      accentColor: accent ?? undefined,
      primaryDarkColor: payload.primaryDarkHex ?? undefined,
      sidebarStyle:
        payload.sidebarStyle === 'neutral' ? 'neutral' : 'colored',
      fontFamily: payload.fontFamily ?? undefined,
      borderRadius: payload.borderRadius ?? undefined,
      density: payload.density ?? undefined,
      tokens: buildBrandTokens(primary, accent),
    };
    if (hasLogoAsset(payload)) {
      brand.logoUrl = `${this.apiPublicBase()}/public/brand-preview/${token}/logo?v=${v}`;
    }
    if (hasLoginBgAsset(payload)) {
      brand.loginBackgroundUrl = `${this.apiPublicBase()}/public/tenants/${tenant.slug}/login-bg?v=${v}`;
    }
    return {
      brand,
      meta: {
        source,
        tenantSlug: tenant.slug,
        kitId: row.kitId,
        watermark: 'Preview — not live',
      },
    };
  }

  async servePreviewLogo(token: string): Promise<BrandAssetBytes> {
    const row = await this.previewTokens.findOne({ where: { token } });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException();
    }
    if (row.kitId && !row.tenantSlug) {
      const kit = await this.getKit(row.kitId);
      if (kit.logoData && kit.logoMime) {
        return { buffer: Buffer.from(kit.logoData, 'base64'), mime: kit.logoMime };
      }
      if (!kit.logoPath || !kit.logoMime) throw new NotFoundException();
      const abs = path.join(process.cwd(), 'uploads', kit.logoPath);
      if (!fs.existsSync(abs)) throw new NotFoundException();
      return { buffer: fs.readFileSync(abs), mime: kit.logoMime };
    }
    if (!row.tenantSlug) throw new NotFoundException();
    const tenant = await this.tenants.findOne({
      where: { slug: row.tenantSlug },
    });
    if (!tenant) throw new NotFoundException();
    const preferDraft = row.source === 'draft';
    const asset = this.resolveTenantAsset(tenant, 'logo', preferDraft);
    if (!asset) throw new NotFoundException();
    return asset;
  }

  async serveStudioLogo(tenantId: string): Promise<BrandAssetBytes> {
    const tenant = await this.findTenant(tenantId);
    const asset = this.resolveTenantAsset(tenant, 'logo', true);
    if (!asset) throw new NotFoundException();
    return asset;
  }

  async serveStudioLoginBg(tenantId: string): Promise<BrandAssetBytes> {
    const tenant = await this.findTenant(tenantId);
    const asset = this.resolveTenantAsset(tenant, 'login-bg', true);
    if (!asset) throw new NotFoundException();
    return asset;
  }

  private async findTenant(id: string): Promise<Tenant> {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }
}
