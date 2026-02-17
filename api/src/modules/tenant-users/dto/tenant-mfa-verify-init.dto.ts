import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class TenantMfaVerifyInitDto {
  @ApiProperty({ example: 'driver@tenant.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  token: string;
}


