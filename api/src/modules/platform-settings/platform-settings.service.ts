import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from './platform-setting.entity';

export type NewTenantDefaults = {
  recommendMfa: boolean;
  recommendDriverMfa: boolean;
  recommendBiometrics: boolean;
  maxDrivers: number | null;
  maxStorageMb: number | null;
  defaultPlanCode: string | null;
};

export type PlatformAnnouncement = {
  enabled: boolean;
  severity: 'info' | 'maintenance';
  message: string;
  startsAt: string | null;
  endsAt: string | null;
  blockWrites: boolean;
};

const DEFAULT_DEFAULTS: NewTenantDefaults = {
  recommendMfa: true,
  recommendDriverMfa: true,
  recommendBiometrics: false,
  maxDrivers: null,
  maxStorageMb: null,
  defaultPlanCode: null,
};

const DEFAULT_ANNOUNCEMENT: PlatformAnnouncement = {
  enabled: false,
  severity: 'info',
  message: '',
  startsAt: null,
  endsAt: null,
  blockWrites: false,
};

@Injectable()
export class PlatformSettingsService {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly repo: Repository<PlatformSetting>,
  ) {}

  private async getJson<T extends object>(key: string, fallback: T): Promise<T> {
    const row = await this.repo.findOne({ where: { key } });
    if (!row?.value || typeof row.value !== 'object') return { ...fallback };
    return { ...fallback, ...(row.value as T) };
  }

  private async setJson(
    key: string,
    value: object,
    updatedBy?: string | null,
  ): Promise<object> {
    let row = await this.repo.findOne({ where: { key } });
    if (!row) {
      row = this.repo.create({ key, value: {}, updatedBy: updatedBy ?? null });
    }
    row.value = value as Record<string, unknown>;
    row.updatedBy = updatedBy ?? null;
    await this.repo.save(row);
    return row.value;
  }

  getNewTenantDefaults(): Promise<NewTenantDefaults> {
    return this.getJson('new_tenant_defaults', DEFAULT_DEFAULTS);
  }

  async updateNewTenantDefaults(
    patch: Partial<NewTenantDefaults>,
    updatedBy?: string | null,
  ): Promise<NewTenantDefaults> {
    const current = await this.getNewTenantDefaults();
    const next: NewTenantDefaults = {
      recommendMfa: patch.recommendMfa ?? current.recommendMfa,
      recommendDriverMfa: patch.recommendDriverMfa ?? current.recommendDriverMfa,
      recommendBiometrics: patch.recommendBiometrics ?? current.recommendBiometrics,
      maxDrivers:
        patch.maxDrivers !== undefined ? patch.maxDrivers : current.maxDrivers,
      maxStorageMb:
        patch.maxStorageMb !== undefined
          ? patch.maxStorageMb
          : current.maxStorageMb,
      defaultPlanCode:
        patch.defaultPlanCode !== undefined
          ? patch.defaultPlanCode
          : current.defaultPlanCode,
    };
    await this.setJson('new_tenant_defaults', next, updatedBy);
    return next;
  }

  getAnnouncement(): Promise<PlatformAnnouncement> {
    return this.getJson('announcement', DEFAULT_ANNOUNCEMENT);
  }

  async updateAnnouncement(
    patch: Partial<PlatformAnnouncement>,
    updatedBy?: string | null,
  ): Promise<PlatformAnnouncement> {
    const current = await this.getAnnouncement();
    const next: PlatformAnnouncement = {
      enabled: patch.enabled ?? current.enabled,
      severity: patch.severity ?? current.severity,
      message: patch.message ?? current.message,
      startsAt: patch.startsAt !== undefined ? patch.startsAt : current.startsAt,
      endsAt: patch.endsAt !== undefined ? patch.endsAt : current.endsAt,
      blockWrites: patch.blockWrites ?? current.blockWrites,
    };
    await this.setJson('announcement', next, updatedBy);
    return next;
  }

  /** Active banner for clients (honours schedule). */
  async getActiveAnnouncement(): Promise<PlatformAnnouncement | null> {
    const a = await this.getAnnouncement();
    if (!a.enabled || !a.message?.trim()) return null;
    const now = Date.now();
    if (a.startsAt && new Date(a.startsAt).getTime() > now) return null;
    if (a.endsAt && new Date(a.endsAt).getTime() < now) return null;
    return a;
  }
}
