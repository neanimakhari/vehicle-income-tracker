import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../auth/auth-user.entity';
import { AuditService } from '../modules/audit/audit.service';

@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectRepository(AuthUser)
    private readonly authUserRepository: Repository<AuthUser>,
    private readonly auditService: AuditService,
  ) {}

  async create(email: string, password: string): Promise<AuthUser> {
    const existing = await this.authUserRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.authUserRepository.create({
      email,
      passwordHash,
      role: 'PLATFORM_ADMIN',
      tenantId: null,
      isActive: true,
    });
    const saved = await this.authUserRepository.save(user);
    await this.auditService.log({
      action: 'platform.admin.create',
      actorUserId: null,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'platform_admin',
      targetId: saved.id,
      metadata: { email: saved.email },
    });
    return saved;
  }

  findAll(): Promise<AuthUser[]> {
    return this.authUserRepository.find({ where: { role: 'PLATFORM_ADMIN' } });
  }
}

