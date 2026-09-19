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
import { BrandKit } from './brand-kit.entity';
import {
  BrandPayload,
  BrandPolicyDto,
  brandFieldsFromTenant,
  buildBrandTokens,
  validateBrandColors,
} from './brand.util';
import { Tenant } from './tenant.entity';
import { TenantBrandPreviewToken } from './tenant-brand-preview-token.entity';
import { TenantBrandSnapshot } from './tenant-brand-snapshot.entity';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 1_000_000;

export type BrandDraftInput = {
  displayName?: string | null;
  primaryHex?: string | null;
  accentHex?: string | null;
  sidebarStyle?: 'colored' | 'neutral';
};

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
    if (tenant.brandLogoPath) {
      dto.logoUrl = `${this.apiPublicBase()}/public/tenants/${tenant.slug}/logo?v=${v}`;
    }
    if (tenant.brandLoginBgPath) {
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
    if (draft.logoPath) {
      draftOut.logoUrl = `${this.apiPublicBase()}/tenants/${tenant.id}/brand/logo-file?v=${v}`;
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
    });
    const prev = this.getDraft(tenant);
    const draft: BrandPayload = {
      ...prev,
      displayName:
        input.displayName !== undefined
          ? input.displayName?.trim() || null
          : prev.displayName ?? null,
      primaryHex:
        input.primaryHex !== undefined ? colors.primaryHex : prev.primaryHex,
      accentHex:
        input.accentHex !== undefined ? colors.accentHex : prev.accentHex,
      sidebarStyle:
        input.sidebarStyle ??
        (prev.sidebarStyle === 'neutral' ? 'neutral' : 'colored'),
    };
    tenant.brandDraftJson = draft as Record<string, unknown>;
    await this.tenants.save(tenant);
    await this.audit.log({
      action: 'tenant.brand.draft_save',
      actorUserId,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug: tenant.slug, draft },
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
    });
    if (!colors.primaryHex) {
      throw new BadRequestException('Draft needs a primary color to publish');
    }
    tenant.brandMode = 'custom';
    tenant.brandDisplayName = draft.displayName ?? null;
    tenant.brandPrimaryHex = colors.primaryHex;
    tenant.brandAccentHex = colors.accentHex;
    tenant.brandSidebarStyle =
      draft.sidebarStyle === 'neutral' ? 'neutral' : 'colored';
    if (draft.logoPath) {
      tenant.brandLogoPath = draft.logoPath;
      tenant.brandLogoMime = draft.logoMime ?? null;
    }
    if (draft.loginBgPath) {
      tenant.brandLoginBgPath = draft.loginBgPath;
      tenant.brandLoginBgMime = draft.loginBgMime ?? null;
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
    tenant.brandSidebarStyle = 'colored';
    tenant.brandLogoPath = null;
    tenant.brandLogoMime = null;
    tenant.brandLoginBgPath = null;
    tenant.brandLoginBgMime = null;
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
    if (entitled) {
      return this.publishDraft(tenantId, actorUserId);
    }
    return this.getBrandStudio(tenantId);
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
      throw new BadRequestException('Logo must be png, jpeg, or webp');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Image must be 1MB or smaller');
    }
    const tenant = await this.findTenant(tenantId);
    const ext =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : 'jpg';
    const dir = path.join(this.uploadsRoot, tenant.slug);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${kind === 'logo' ? 'logo' : 'login-bg'}-draft.${ext}`;
    const abs = path.join(dir, filename);
    fs.writeFileSync(abs, file.buffer);
    const rel = path.join('tenant-branding', tenant.slug, filename).replace(/\\/g, '/');

    const draft = this.getDraft(tenant);
    if (kind === 'logo') {
      draft.logoPath = rel;
      draft.logoMime = file.mimetype;
      if (target === 'live') {
        tenant.brandLogoPath = rel;
        tenant.brandLogoMime = file.mimetype;
      }
    } else {
      draft.loginBgPath = rel;
      draft.loginBgMime = file.mimetype;
      if (target === 'live') {
        tenant.brandLoginBgPath = rel;
        tenant.brandLoginBgMime = file.mimetype;
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
      metadata: { slug: tenant.slug, kind, rel },
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
      tenant.brandLogoPath = null;
      tenant.brandLogoMime = null;
    } else {
      draft.loginBgPath = null;
      draft.loginBgMime = null;
      tenant.brandLoginBgPath = null;
      tenant.brandLoginBgMime = null;
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

  resolveTenantAssetPath(
    tenant: Tenant,
    kind: 'logo' | 'login-bg',
    preferDraft = false,
  ): { absPath: string; mime: string } | null {
    const draft = preferDraft ? this.getDraft(tenant) : null;
    const rel =
      kind === 'logo'
        ? preferDraft
          ? draft?.logoPath ?? tenant.brandLogoPath
          : tenant.brandLogoPath
        : preferDraft
          ? draft?.loginBgPath ?? tenant.brandLoginBgPath
          : tenant.brandLoginBgPath;
    const mime =
      kind === 'logo'
        ? preferDraft
          ? draft?.logoMime ?? tenant.brandLogoMime
          : tenant.brandLogoMime
        : preferDraft
          ? draft?.loginBgMime ?? tenant.brandLoginBgMime
          : tenant.brandLoginBgMime;
    if (!rel || !mime) return null;
    const abs = path.join(process.cwd(), 'uploads', rel);
    if (!fs.existsSync(abs)) return null;
    return { absPath: abs, mime };
  }

  async servePublicLogo(slug: string, kind: 'logo' | 'login-bg') {
    const tenant = await this.tenants.findOne({ where: { slug } });
    if (!tenant?.isActive) throw new NotFoundException();
    const entitled = await this.isBrandingEntitled(slug);
    if (!entitled || tenant.brandMode !== 'custom') {
      throw new NotFoundException();
    }
    const asset = this.resolveTenantAssetPath(tenant, kind, false);
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
    });
    tenant.brandMode = p.brandMode === 'custom' ? 'custom' : 'vit_default';
    tenant.brandDisplayName = p.displayName ?? null;
    tenant.brandPrimaryHex = colors.primaryHex;
    tenant.brandAccentHex = colors.accentHex;
    tenant.brandSidebarStyle =
      p.sidebarStyle === 'neutral' ? 'neutral' : 'colored';
    tenant.brandLogoPath = p.logoPath ?? null;
    tenant.brandLogoMime = p.logoMime ?? null;
    tenant.brandLoginBgPath = p.loginBgPath ?? null;
    tenant.brandLoginBgMime = p.loginBgMime ?? null;
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
        sidebarStyle: draft.sidebarStyle ?? 'colored',
        displayName: draft.displayName ?? null,
      },
      isStarter: false,
      createdBy: actorUserId,
    });
    const saved = await this.kits.save(kit);
    if (body.includeLogo && draft.logoPath) {
      const src = path.join(process.cwd(), 'uploads', draft.logoPath);
      if (fs.existsSync(src)) {
        const kitDir = path.join(this.kitsRoot, saved.id);
        fs.mkdirSync(kitDir, { recursive: true });
        const ext = path.extname(src) || '.png';
        const destRel = path
          .join('brand-kits', saved.id, `logo${ext}`)
          .replace(/\\/g, '/');
        fs.copyFileSync(src, path.join(process.cwd(), 'uploads', destRel));
        saved.logoPath = destRel;
        saved.logoMime = draft.logoMime ?? 'image/png';
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
      sidebarStyle?: 'colored' | 'neutral';
      displayName?: string | null;
    },
    actorUserId: string | null,
  ) {
    const colors = validateBrandColors({
      primaryHex: body.primaryHex,
      accentHex: body.accentHex ?? null,
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
        sidebarStyle: body.sidebarStyle ?? 'colored',
        displayName: body.displayName ?? null,
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
      logoPath: kit.logoPath,
      logoMime: kit.logoMime,
      loginBgPath: kit.loginBgPath,
      loginBgMime: kit.loginBgMime,
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
    draft.sidebarStyle =
      p.sidebarStyle === 'neutral' ? 'neutral' : 'colored';
    if (opts.setDisplayName && p.displayName) {
      draft.displayName = String(p.displayName);
    }
    if (opts.includeLogo && kit.logoPath) {
      const src = path.join(process.cwd(), 'uploads', kit.logoPath);
      if (fs.existsSync(src)) {
        const dir = path.join(this.uploadsRoot, tenant.slug);
        fs.mkdirSync(dir, { recursive: true });
        const ext = path.extname(kit.logoPath) || '.png';
        const destRel = path
          .join('tenant-branding', tenant.slug, `logo-draft${ext}`)
          .replace(/\\/g, '/');
        fs.copyFileSync(src, path.join(process.cwd(), 'uploads', destRel));
        draft.logoPath = destRel;
        draft.logoMime = kit.logoMime ?? 'image/png';
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
      .update(JSON.stringify(payload))
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
      sidebarStyle:
        payload.sidebarStyle === 'neutral' ? 'neutral' : 'colored',
      tokens: buildBrandTokens(primary, accent),
    };
    if (payload.logoPath) {
      brand.logoUrl = `${this.apiPublicBase()}/public/brand-preview/${token}/logo?v=${v}`;
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

  async servePreviewLogo(token: string) {
    const row = await this.previewTokens.findOne({ where: { token } });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException();
    }
    if (row.kitId && !row.tenantSlug) {
      const kit = await this.getKit(row.kitId);
      if (!kit.logoPath || !kit.logoMime) throw new NotFoundException();
      const abs = path.join(process.cwd(), 'uploads', kit.logoPath);
      if (!fs.existsSync(abs)) throw new NotFoundException();
      return { absPath: abs, mime: kit.logoMime };
    }
    if (!row.tenantSlug) throw new NotFoundException();
    const tenant = await this.tenants.findOne({
      where: { slug: row.tenantSlug },
    });
    if (!tenant) throw new NotFoundException();
    const preferDraft = row.source === 'draft';
    const asset = this.resolveTenantAssetPath(tenant, 'logo', preferDraft);
    if (!asset) throw new NotFoundException();
    return asset;
  }

  async serveStudioLogo(tenantId: string) {
    const tenant = await this.findTenant(tenantId);
    const asset = this.resolveTenantAssetPath(tenant, 'logo', true);
    if (!asset) throw new NotFoundException();
    return asset;
  }

  private async findTenant(id: string): Promise<Tenant> {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }
}
