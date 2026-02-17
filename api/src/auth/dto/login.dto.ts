import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'demo', required: false, description: 'Tenant slug for tenant admin login' })
  @IsString()
  @IsOptional()
  tenantSlug?: string;

  @ApiProperty({ example: 'admin@vit.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '123456', required: false })
  @IsString()
  @IsOptional()
  mfaToken?: string;

  @ApiProperty({ example: 'device-uuid', required: false })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({ example: 'Samsung SM-G998B', required: false })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiProperty({ example: 'push-token', required: false })
  @IsString()
  @IsOptional()
  pushToken?: string;
}

