import { IsBoolean } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

import { RegisterDto } from './register.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(RegisterDto) {
  @ApiProperty()
  @IsBoolean()
  active: boolean;
}
