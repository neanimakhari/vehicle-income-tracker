import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsNotEmpty, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPassword123!' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters and include uppercase, lowercase and a symbol',
  })
  newPassword: string;
}

