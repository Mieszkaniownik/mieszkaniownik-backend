import { Role } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { NicePassword } from "../../validators/password.validator";

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
  @IsEnum(Role)
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
