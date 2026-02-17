import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';

export type HealthDetail = {
  status: 'ok' | 'degraded' | 'error';
  db: 'ok' | 'error';
  dbMessage?: string;
  disk?: { path: string; usedMb: number; totalMb: number; freeMb: number };
  diskError?: string;
};

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async getBasic(): Promise<{ status: string }> {
    return { status: 'ok' };
  }

  async getDetailed(): Promise<HealthDetail> {
    const result: HealthDetail = {
      status: 'ok',
      db: 'ok',
    };

    try {
      if (!this.dataSource.isInitialized) {
        result.db = 'error';
        result.dbMessage = 'DataSource not initialized';
        result.status = 'error';
      } else {
        await this.dataSource.query('SELECT 1');
      }
    } catch (e) {
      result.db = 'error';
      result.dbMessage = e instanceof Error ? e.message : 'Database check failed';
      result.status = 'error';
    }

    const uploadsPath =
      this.configService.get<string>('uploads.path') ??
      process.env.UPLOADS_PATH ??
      './uploads';
    try {
      const stat = await fs.stat(uploadsPath).catch(() => null);
      if (stat?.isDirectory()) {
        const usedMb = await this.getDirSizeMb(uploadsPath);
        result.disk = {
          path: uploadsPath,
          usedMb: Math.round(usedMb * 100) / 100,
          totalMb: 0,
          freeMb: 0,
        };
      }
    } catch (e) {
      result.diskError = e instanceof Error ? e.message : 'Disk check failed';
    }

    return result;
  }

  private async getDirSizeMb(dir: string): Promise<number> {
    let total = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const ent of entries) {
      const full = `${dir}/${ent.name}`;
      if (ent.isDirectory()) {
        total += await this.getDirSizeMb(full);
      } else {
        const s = await fs.stat(full).catch(() => null);
        if (s) total += s.size;
      }
    }
    return total / (1024 * 1024);
  }
}
