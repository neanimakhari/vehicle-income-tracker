import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token from email link' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'NewSecurePassword123!',
    minLength: 8,
    description:
      'At least 8 characters, including uppercase, lowercase and a symbol',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters and include uppercase, lowercase and a symbol',
  })
  newPassword: string;
}
