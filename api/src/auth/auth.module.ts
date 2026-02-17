import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthUser } from './auth-user.entity';
import { Tenant } from '../modules/tenants/tenant.entity';
import { RefreshToken } from './refresh-token.entity';
import { DeviceBinding } from './device-binding.entity';
import { JwtStrategy } from './jwt.strategy';
import { AuditModule } from '../modules/audit/audit.module';
import { EmailModule } from '../modules/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthUser, Tenant, RefreshToken, DeviceBinding]),
    AuditModule,
    EmailModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwtSecret') ?? '',
        signOptions: {
          expiresIn: (configService.get<string>('auth.jwtExpiresIn') ?? '1h') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}


