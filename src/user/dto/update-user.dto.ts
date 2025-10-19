import { IsBoolean } from "class-validator";

import { ApiProperty, PartialType } from "@nestjs/swagger";

import { RegisterDto } from "./register.dto";

export class UpdateUserDto extends PartialType(RegisterDto) {
  @ApiProperty()
  @IsBoolean()
  active: boolean;
}
