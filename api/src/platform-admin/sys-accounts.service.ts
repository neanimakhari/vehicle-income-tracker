import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../auth/auth-user.entity';
import { AuditService } from '../modules/audit/audit.service';

@Injectable()
export class SysAccountsService {
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
      role: 'SYS',
      tenantId: null,
      isActive: true,
    });
    const saved = await this.authUserRepository.save(user);
    await this.auditService.log({
      action: 'sys.account.create',
      actorUserId: null,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'sys_account',
      targetId: saved.id,
      metadata: { email: saved.email },
    });
    return saved;
  }

  findAll(): Promise<AuthUser[]> {
    return this.authUserRepository.find({
      where: { role: 'SYS' },
      order: { createdAt: 'DESC' },
    });
  }

  async setActive(id: string, isActive: boolean): Promise<AuthUser> {
    const user = await this.authUserRepository.findOne({
      where: { id, role: 'SYS' },
    });
    if (!user) throw new NotFoundException('SYS account not found');
    user.isActive = isActive;
    return this.authUserRepository.save(user);
  }
}
