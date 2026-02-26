import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters and include uppercase, lowercase and a symbol',
  })
  newPassword: string;
}

