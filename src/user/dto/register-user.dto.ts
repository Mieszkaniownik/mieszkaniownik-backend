import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @ApiProperty()
  email: string;

  @IsString()
  @ApiProperty()
  @MaxLength(50)
  password: string;

  @IsOptional()
  @MaxLength(50)
  @IsString()
  @ApiPropertyOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  surname?: string;
}
