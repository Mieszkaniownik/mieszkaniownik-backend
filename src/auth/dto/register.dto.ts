import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

import { LoginDto } from "./login.dto";

export class RegisterDto extends LoginDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  surname?: string;
}
