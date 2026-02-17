import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../auth/auth-user.entity';

@Injectable()
export class PlatformBootstrapService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(AuthUser)
    private readonly authUserRepository: Repository<AuthUser>,
  ) {}

  async bootstrap(email: string, password: string, token?: string) {
    const bootstrapToken = this.configService.get<string>('bootstrap.token') ?? '';
    if (!bootstrapToken || token !== bootstrapToken) {
      throw new ForbiddenException('Invalid bootstrap token');
    }

    const existing = await this.authUserRepository.findOne({
      where: { role: 'PLATFORM_ADMIN' },
    });
    if (existing) {
      throw new ConflictException('Platform admin already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.authUserRepository.create({
      email,
      passwordHash,
      role: 'PLATFORM_ADMIN',
      tenantId: null,
      isActive: true,
    });
    return this.authUserRepository.save(user);
  }
}



