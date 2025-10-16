import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  Validate,
  IsOptional,
} from 'class-validator';

import { NicePassword } from '../../validators/password.validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  email: string;

  @Validate(NicePassword)
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  role?: Role;

  @IsOptional()
  @MaxLength(255)
  @IsString()
  @ApiPropertyOptional()
  username?: string;

  @IsOptional()
  @MaxLength(50)
  @IsString()
  @ApiPropertyOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  surname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(25)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  googleId?: string;
}
